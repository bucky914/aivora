// execute-code  ("Run Code")
//
// Runs the participant's function against ONLY the public test cases for
// the question. Never touches scoring or is_solved — see submit-code for
// that. Hidden tests are never fetched by this function (it calls
// get_public_tests, not get_judge_context), so there is no code path here
// that could leak them even by accident.
//
// Body: { attempt_id, token, question_id, language, code }
//
// DIAGNOSTICS: each of the three steps below (fetch public tests, judge
// the code, record the audit log) is wrapped in its own try/catch with a
// distinct error_code, so a failure at any one step is both clearly
// logged server-side (with the real Supabase/Judge0 error detail) and
// clearly identifiable from the client's error_code — instead of every
// failure collapsing into one generic 500 with no way to tell which step
// broke. Nothing logged here ever includes participant code, the
// attempt's access token, Judge0 credentials, or hidden test data.

import { fail, handle, json, readCredentials, rpcResult, UUID_RE } from "../_shared/util.ts";
import { loadJudge0Config, SupportedLanguage } from "../_shared/judge0.ts";
import { judge, validateCode } from "../_shared/judge.ts";
import { CodingConfig, TestCase } from "../_shared/drivers.ts";

const LANGUAGES: SupportedLanguage[] = ["python3", "java", "cpp", "c"];

// Supabase/PostgREST errors carry code/message/details/hint; this pulls
// out only those four fields for logging, never the full error object
// (which could otherwise carry request internals we don't want to log).
function logSupabaseError(label: string, error: unknown): void {
  const e = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  console.error(label, {
    code: e?.code ?? null,
    message: e?.message ?? null,
    details: e?.details ?? null,
    hint: e?.hint ?? null,
  });
}

handle(async (body, db, reqCtx) => {
  const creds = readCredentials(body);
  if (!creds) return fail(reqCtx, "not_found", "Contest session not found.", 404);

  const questionId = typeof body.question_id === "string" ? body.question_id : "";
  if (!UUID_RE.test(questionId)) return fail(reqCtx, "invalid_input", "Unknown question.", 400);

  const language = typeof body.language === "string" ? body.language : "";
  if (LANGUAGES.indexOf(language as SupportedLanguage) === -1) {
    return fail(reqCtx, "invalid_input", "Unsupported language.", 400);
  }

  const code = typeof body.code === "string" ? body.code : "";
  const codeError = validateCode(code);
  if (codeError) return fail(reqCtx, "invalid_input", codeError, 400);

  // ---------------------------------------------------------------
  // Step 1: fetch the question's signature + PUBLIC tests only.
  // Hidden tests are never reachable from this Edge Function — this
  // calls get_public_tests, never get_judge_context.
  // ---------------------------------------------------------------
  let ctx: Record<string, unknown>;
  try {
    const { data, error } = await db.rpc("get_public_tests", {
      p_attempt_id: creds.attemptId,
      p_token: creds.token,
      p_question_id: questionId,
    });
    if (error) {
      logSupabaseError("execute-code: get_public_tests failed", error);
      return fail(reqCtx, "public_tests_failed", "Could not load this question's tests. Please try again.", 502);
    }
    if (!data || !data.ok) return rpcResult(reqCtx, data);
    ctx = data;
  } catch (error) {
    // A thrown (rather than returned) error from the RPC call itself —
    // e.g. a network failure talking to Postgres — lands here.
    logSupabaseError("execute-code: get_public_tests failed", error);
    return fail(reqCtx, "public_tests_failed", "Could not load this question's tests. Please try again.", 502);
  }

  const codingCfg: CodingConfig & { unordered_result?: boolean; float_tolerance?: number | null } = {
    function_name: ctx.function_name as string,
    params: (ctx.params as CodingConfig["params"]) || [],
    return_type: ctx.return_type as string,
    unordered_result: !!ctx.unordered_result,
    float_tolerance: (ctx.float_tolerance as number | null) ?? null,
  };
  const publicTests: TestCase[] = ((ctx.public_tests as { input: Record<string, unknown>; expected: unknown }[]) || [])
    .map((t) => ({ input: t.input, expected: t.expected }));
  const timeLimitMs = (ctx.time_limit_ms as number) || 2000;
  const memoryLimitKb = (ctx.memory_limit_kb as number) || 262144;

  // Temporary diagnostics: shape of the request only — never the
  // participant's code, and never the attempt token.
  console.log("execute-code: request", {
    question_id: questionId,
    language,
    public_test_count: publicTests.length,
    memory_limit_kb: memoryLimitKb,
    time_limit_ms: timeLimitMs,
  });

  let judge0Cfg;
  try {
    judge0Cfg = loadJudge0Config();
  } catch (e) {
    console.error("Judge0 not configured:", e);
    return fail(reqCtx, "execution_unavailable", "The code execution service is not configured. Please tell an organiser.", 503);
  }

  // ---------------------------------------------------------------
  // Step 2: actually judge the code (build the driver, call Judge0,
  // compare against the public tests).
  // ---------------------------------------------------------------
  let result: Awaited<ReturnType<typeof judge>>;
  try {
    result = await judge(judge0Cfg, language as SupportedLanguage, codingCfg, code, publicTests, {
      timeLimitMs,
      memoryLimitKb,
    });
  } catch (error) {
    const e = error as Error;
    console.error("execute-code: judge failed", e?.message ?? String(error));
    // Stack trace is logged server-side only — never sent to the client.
    if (e?.stack) console.error(e.stack);
    return fail(reqCtx, "execution_failed", "Could not run your code right now. Please try again.", 502);
  }

  // ---------------------------------------------------------------
  // Step 3: record the run in the audit log. This is best-effort —
  // execution already succeeded by this point, so a failure here must
  // NEVER turn a real result into a 500. It's logged and the actual
  // execution result is still returned to the participant.
  //
  // "run_audit_failed" is the error_code this step would use if it
  // could ever fail before returning a result — but per the
  // requirement above, it deliberately never reaches the client: a
  // failure here is caught, logged, and swallowed, falling through to
  // the normal success response below instead.
  // ---------------------------------------------------------------
  try {
    const { error } = await db.rpc("record_run_result", {
      p_attempt_id: creds.attemptId,
      p_token: creds.token,
      p_question_id: questionId,
      p_language: language,
      p_status: result.status,
      p_passed: result.passed,
      p_total: result.total,
      p_execution_ms: result.executionMs,
      p_error_message: result.errorMessage,
      p_code_length: code.length,
    });
    if (error) {
      logSupabaseError("execute-code: record_run_result failed", error);
      // Deliberately NOT returned to the client as an error — see the
      // comment above. Falls through to the normal success response.
    }
  } catch (error) {
    // Same reasoning: a thrown error auditing the run must not mask a
    // real execution result behind a 500.
    logSupabaseError("execute-code: record_run_result failed", error);
  }

  return json(reqCtx, {
    ok: true,
    kind: "run",
    status: result.status,
    passed_tests: result.passed,
    total_tests: result.total,
    execution_ms: result.executionMs,
    error_message: result.errorMessage,
    // Per-test detail for the UI. Only ever built from PUBLIC tests here.
    tests: result.perTest.map((t, i) => ({
      index: i,
      verdict: t.verdict,
      input: publicTests[i]?.input ?? null,
      expected: publicTests[i]?.expected ?? null,
      actual: t.actual,
      error: t.error || null,
    })),
  });
});

