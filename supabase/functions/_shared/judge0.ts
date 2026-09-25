// Judge0 client. Reads all connection details from Supabase Edge Function
// secrets — NEVER from request bodies or frontend code.
//
// Default target: the official public Judge0 CE instance at
// https://ce.judge0.com, which needs NO API key and NO RapidAPI account —
// authentication is entirely optional here. The same client also works
// against Judge0 on RapidAPI, or a self-hosted instance, by setting the
// optional secrets below; nothing in this file assumes RapidAPI.
//
// Secrets (see README for how to set these):
//   JUDGE0_API_URL        Default: https://ce.judge0.com
//                          Set to a RapidAPI or self-hosted URL instead if
//                          you'd rather use one of those.
//   JUDGE0_API_KEY         Optional. Only needed for RapidAPI (sent as
//                          X-RapidAPI-Key) or a self-hosted instance that
//                          requires one. Leave unset for ce.judge0.com.
//   JUDGE0_API_HOST        Optional. Only needed for RapidAPI (sent as
//                          X-RapidAPI-Host, e.g. judge0-ce.p.rapidapi.com).
//                          Leave unset for ce.judge0.com.
//   JUDGE0_AUTH_TOKEN      Optional. X-Auth-Token, for a self-hosted Judge0
//                          with AUTHN_HEADER enabled.
//
// Language IDs are the standard Judge0 CE ids and can be overridden via
// secrets if your instance uses different ones:
//   JUDGE0_LANG_PYTHON3 (default 71 — Python 3.8.1)
//   JUDGE0_LANG_JAVA    (default 62 — Java OpenJDK 13.0.1)
//   JUDGE0_LANG_CPP     (default 54 — C++ GCC 9.2.0)
//   JUDGE0_LANG_C       (default 50 — C GCC 9.2.0)
//
// EXECUTION MODEL — standard asynchronous Judge0 flow, not `wait=true`:
// the public ce.judge0.com instance is shared and can queue submissions
// under load, so a single long-blocking `wait=true` HTTP call is fragile
// there (it ties up the Edge Function's own request for however long
// Judge0 takes, with no visibility into whether it's queued or running).
// Instead this client:
//   1. POSTs the submission (returns immediately with a token),
//   2. polls GET /submissions/{token} on a short interval,
//   3. stops polling once the submission reaches a terminal status
//      (anything other than "In Queue" / "Processing"),
//   4. gives up with a clear internal_error after a bounded number of
//      polls, rather than looping forever against a stuck submission.
//
// REQUEST LIMITS: memory_limit, stack_limit, cpu_time_limit and
// wall_time_limit are all clamped to Judge0 CE's documented ceilings
// before every submission (see clampSubmissionLimits below), so a
// question's coding_config can never accidentally ask for more than
// Judge0 will accept — which Judge0 would otherwise reject outright.

export type SupportedLanguage = "python3" | "java" | "cpp" | "c";

export interface Judge0Config {
  apiUrl: string;
  apiKey?: string;
  apiHost?: string;
  authToken?: string;
  languageIds: Record<SupportedLanguage, number>;
}

const DEFAULT_API_URL = "https://ce.judge0.com";

export function loadJudge0Config(): Judge0Config {
  const apiUrl = Deno.env.get("JUDGE0_API_URL") || DEFAULT_API_URL;
  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    // All optional: ce.judge0.com needs none of these. They only matter
    // for RapidAPI or a self-hosted instance that requires auth.
    apiKey: Deno.env.get("JUDGE0_API_KEY") ?? undefined,
    apiHost: Deno.env.get("JUDGE0_API_HOST") ?? undefined,
    authToken: Deno.env.get("JUDGE0_AUTH_TOKEN") ?? undefined,
    languageIds: {
      python3: Number(Deno.env.get("JUDGE0_LANG_PYTHON3") ?? 71),
      java: Number(Deno.env.get("JUDGE0_LANG_JAVA") ?? 62),
      cpp: Number(Deno.env.get("JUDGE0_LANG_CPP") ?? 54),
      c: Number(Deno.env.get("JUDGE0_LANG_C") ?? 50),
    },
  };
}

// Judge0 status ids: 1=In Queue 2=Processing 3=Accepted(ran ok) 4=Wrong Answer
// 5=TLE 6=Compilation Error 7-12=Runtime Error variants 13=Internal Error 14=Exec Format Error
// We never send `expected_output` to Judge0 (we compare ourselves), so from
// Judge0's point of view "Accepted" (3) just means "ran without crashing".
const STATUS_IN_QUEUE = 1;
const STATUS_PROCESSING = 2;

export type Judge0Outcome =
  | "ran_ok"            // status 3 — program ran to completion (we still check stdout ourselves)
  | "compile_error"     // status 6
  | "runtime_error"     // status 7-12
  | "time_limit"        // status 5
  | "memory_limit"      // heuristic: runtime error + memory near/over limit, or wall time signal
  | "internal_error";   // status 13, 14, a polling timeout, or anything unexpected

export interface Judge0Result {
  outcome: Judge0Outcome;
  stdout: string;
  stderr: string;
  compileOutput: string;
  message: string;
  timeMs: number | null;
  memoryKb: number | null;
}

function classify(statusId: number, memory: number | null, memoryLimitKb: number): Judge0Outcome {
  if (statusId === 3) return "ran_ok";
  if (statusId === 5) return "time_limit";
  if (statusId === 6) return "compile_error";
  if (statusId >= 7 && statusId <= 12) {
    if (memory != null && memoryLimitKb && memory >= memoryLimitKb) return "memory_limit";
    return "runtime_error";
  }
  return "internal_error";
}

function b64encode(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}
function b64decode(s: string | null): string {
  if (!s) return "";
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
}

function headers(cfg: Judge0Config): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  // Every one of these is optional and omitted entirely when unset — the
  // default target (ce.judge0.com) needs none of them. They only apply
  // when JUDGE0_API_KEY/HOST/AUTH_TOKEN are explicitly configured, e.g.
  // for RapidAPI or an authenticated self-hosted instance.
  if (cfg.apiKey) h["X-RapidAPI-Key"] = cfg.apiKey;
  if (cfg.apiHost) h["X-RapidAPI-Host"] = cfg.apiHost;
  if (cfg.authToken) h["X-Auth-Token"] = cfg.authToken;
  return h;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polling schedule: fairly frequent at first (most submissions on a free
// shared instance finish within a second or two once they start running),
// backing off for anything that's queued behind other work. Total budget
// is capped so a stuck/unreachable Judge0 instance can't hang an Edge
// Function invocation indefinitely.
const POLL_INTERVALS_MS = [300, 300, 500, 500, 1000, 1000, 1500, 2000, 2000, 3000];
const MAX_POLL_ATTEMPTS = 40;          // hard ceiling regardless of the schedule above
const MAX_TOTAL_WAIT_MS = 60_000;      // give up after this long even mid-schedule

function pollDelayFor(attempt: number): number {
  const idx = Math.min(attempt, POLL_INTERVALS_MS.length - 1);
  return POLL_INTERVALS_MS[idx];
}

// Judge0 CE enforces server-side ceilings on the limits a submission can
// request (configurable per-instance via judge0.conf's max_* variables,
// but these are the documented values for the public ce.judge0.com
// instance). A request that asks for MORE than the ceiling is rejected
// outright by Judge0 — which previously surfaced here as an opaque 500,
// since our old memory/stack/time values could exceed them (in
// particular, stack_limit was mistakenly sent as the FULL memory limit,
// e.g. 262144 KB, when Judge0 CE's stack ceiling is 128000 KB). Clamping
// here only ever tightens what we request — it never raises a limit
// beyond what a question's coding_config asks for.
const JUDGE0_MAX_MEMORY_LIMIT_KB = 256000;
const JUDGE0_MAX_STACK_LIMIT_KB = 128000;
const JUDGE0_MAX_CPU_TIME_LIMIT_SEC = 15;
const JUDGE0_MAX_WALL_TIME_LIMIT_SEC = 20;

function clampSubmissionLimits(opts: { cpuTimeLimitSec: number; memoryLimitKb: number }): {
  cpuTimeLimitSec: number;
  wallTimeLimitSec: number;
  memoryLimitKb: number;
  stackLimitKb: number;
} {
  const cpuTimeLimitSec = Math.min(opts.cpuTimeLimitSec, JUDGE0_MAX_CPU_TIME_LIMIT_SEC);
  const wallTimeLimitSec = Math.min(Math.max(cpuTimeLimitSec + 2, 5), JUDGE0_MAX_WALL_TIME_LIMIT_SEC);
  const memoryLimitKb = Math.min(opts.memoryLimitKb, JUDGE0_MAX_MEMORY_LIMIT_KB);
  // Stack is its own, separate ceiling from memory — and can never be
  // larger than whatever memory limit we ended up requesting either.
  const stackLimitKb = Math.min(memoryLimitKb, JUDGE0_MAX_STACK_LIMIT_KB);
  return { cpuTimeLimitSec, wallTimeLimitSec, memoryLimitKb, stackLimitKb };
}

async function createSubmission(
  cfg: Judge0Config,
  languageId: number,
  sourceCode: string,
  opts: { cpuTimeLimitSec: number; memoryLimitKb: number },
): Promise<string> {
  const limits = clampSubmissionLimits(opts);
  const body = {
    language_id: languageId,
    source_code: b64encode(sourceCode),
    cpu_time_limit: limits.cpuTimeLimitSec,
    wall_time_limit: limits.wallTimeLimitSec,
    memory_limit: limits.memoryLimitKb,
    stack_limit: limits.stackLimitKb,
    enable_network: false,
  };

  const res = await fetch(
    `${cfg.apiUrl}/submissions?base64_encoded=true`,
    { method: "POST", headers: headers(cfg), body: JSON.stringify(body) },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Always logged in full server-side — the real Judge0 response body
    // (which often names exactly which field/limit was rejected) never
    // reaches the browser, but it must not be thrown away either.
    console.error(`Judge0 submission failed (HTTP ${res.status}). Request limits:`, limits, "Response:", text.slice(0, 1000));
    throw judge0HttpError(res.status, text, "submission");
  }

  const data = await res.json();
  const token: string | undefined = data?.token;
  if (!token) {
    console.error("Judge0 accepted the submission but returned no token. Response:", JSON.stringify(data).slice(0, 500));
    throw new Error("Judge0 did not return a submission token.");
  }
  return token;
}

// Turns a non-2xx Judge0 response into an Error with a message that is
// safe to show the participant (no raw Judge0 internals, no stack
// traces, no server details) but still tells them something useful and
// distinguishes "try again" conditions from "this looks like a Judge0
// configuration problem" ones. The FULL response is always logged by the
// caller before this is thrown, so nothing about the real failure is
// lost — it just doesn't cross the network to the browser.
function judge0HttpError(status: number, _rawBody: string, stage: "submission" | "status check"): Error {
  if (status === 429) {
    return new Error("Judge0 is rate-limiting requests right now. Please try again in a moment.");
  }
  if (status === 422) {
    // Unprocessable Entity: Judge0's own validation rejected a field in
    // the request (commonly a limit above its configured ceiling). This
    // should not happen now that limits are clamped above, but if it
    // still does — a different instance with tighter ceilings than
    // documented, for example — say so plainly rather than a bare 500.
    return new Error("The execution service rejected this request's settings. Please tell an organiser (see the function logs for details).");
  }
  if (status >= 500) {
    return new Error("The execution service is temporarily unavailable. Please try again in a moment.");
  }
  return new Error(`The execution service could not process this ${stage} (HTTP ${status}). Please try again.`);
}

async function fetchSubmission(cfg: Judge0Config, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${cfg.apiUrl}/submissions/${encodeURIComponent(token)}?base64_encoded=true&fields=*`,
    { method: "GET", headers: headers(cfg) },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Judge0 status check failed (HTTP ${res.status}) for token ${token}. Response:`, text.slice(0, 1000));
    throw judge0HttpError(res.status, text, "status check");
  }
  return await res.json();
}

// Submits one program (with all test inputs embedded in the source by the
// driver generator — see _shared/drivers.ts), then polls until it reaches
// a terminal status or the polling budget runs out. One Judge0 submission
// = one compile + one run, covering every test case in a single process
// invocation, so N test cases cost one Judge0 submission, not N.
export async function runSource(
  cfg: Judge0Config,
  language: SupportedLanguage,
  sourceCode: string,
  opts: { timeLimitMs: number; memoryLimitKb: number },
): Promise<Judge0Result> {
  const languageId = cfg.languageIds[language];
  const cpuTimeLimitSec = Math.max(1, Math.ceil(opts.timeLimitMs / 1000));

  const token = await createSubmission(cfg, languageId, sourceCode, {
    cpuTimeLimitSec,
    memoryLimitKb: opts.memoryLimitKb,
  });

  const startedAt = Date.now();
  let data: Record<string, unknown> | null = null;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(pollDelayFor(attempt));

    data = await fetchSubmission(cfg, token);
    const statusId = (data?.status as { id?: number } | undefined)?.id ?? STATUS_IN_QUEUE;

    if (statusId !== STATUS_IN_QUEUE && statusId !== STATUS_PROCESSING) {
      // Terminal status reached — compile error, runtime error, TLE,
      // accepted, or anything else Judge0 considers "done".
      break;
    }
    if (Date.now() - startedAt > MAX_TOTAL_WAIT_MS) {
      data = null; // treat as a timeout below, distinct from a real Judge0 result
      break;
    }
  }

  if (!data) {
    // Either we never got a terminal status in time, or the wait budget
    // ran out. This is a polling/infrastructure timeout, not a judgement
    // about the participant's code — surfaced as internal_error so
    // execute-code/submit-code report it as a "try again" condition
    // rather than any kind of wrong-answer or TLE verdict.
    console.error(`Judge0 polling timed out for token ${token} after ${MAX_POLL_ATTEMPTS} attempts.`);
    return {
      outcome: "internal_error",
      stdout: "", stderr: "", compileOutput: "",
      message: "Judge0 did not finish in time. Please try again.",
      timeMs: null, memoryKb: null,
    };
  }

  const statusId: number = (data.status as { id?: number } | undefined)?.id ?? 13;
  const memory: number | null = (data.memory as number | null | undefined) ?? null;
  const outcome = classify(statusId, memory, opts.memoryLimitKb);

  return {
    outcome,
    stdout: b64decode(data.stdout as string | null),
    stderr: b64decode(data.stderr as string | null),
    compileOutput: b64decode(data.compile_output as string | null),
    message: b64decode(data.message as string | null) || (data.status as { description?: string } | undefined)?.description || "",
    timeMs: data.time != null ? Math.round(parseFloat(data.time as string) * 1000) : null,
    memoryKb: memory,
  };
}
