// Orchestrates one Run/Submit: build the driver, call Judge0 once, parse
// the per-test JSON lines the driver printed, and compare each one against
// its expected value. Shared by execute-code (public tests) and
// submit-code (public + hidden tests) — callers decide which tests to pass
// in; this module has no idea whether a test is "hidden".

import { buildDriverSource, CodingConfig, TestCase, validateCodingConfig } from "./drivers.ts";
import { Judge0Config, runSource, SupportedLanguage } from "./judge0.ts";
import { normalizedEqual } from "./compare.ts";

export type TestVerdict = "passed" | "failed" | "error";

export interface TestOutcome {
  index: number;
  verdict: TestVerdict;
  actual: unknown;
  error?: string;
}

export type JudgeStatus =
  | "accepted"
  | "wrong_answer"
  | "compile_error"
  | "runtime_error"
  | "time_limit"
  | "memory_limit"
  | "internal_error";

export interface JudgeRunResult {
  status: JudgeStatus;
  passed: number;
  total: number;
  executionMs: number | null;
  errorMessage: string | null;    // safe to show for PUBLIC-test failures; caller decides what to reveal
  perTest: TestOutcome[];         // one entry per test passed in, same order
}

const MAX_CODE_LENGTH = 20000;
const MAX_TESTS_PER_RUN = 60; // guards against a misconfigured question with an enormous test list

export function validateCode(code: string): string | null {
  if (typeof code !== "string" || code.trim().length === 0) return "Code cannot be empty.";
  if (code.length > MAX_CODE_LENGTH) return `Code is too long (${MAX_CODE_LENGTH.toLocaleString()} characters maximum).`;
  return null;
}

export async function judge(
  judge0Cfg: Judge0Config,
  language: SupportedLanguage,
  codingCfg: CodingConfig,
  code: string,
  tests: TestCase[],
  limits: { timeLimitMs: number; memoryLimitKb: number },
): Promise<JudgeRunResult> {
  const configError = validateCodingConfig(codingCfg);
  if (configError) {
    return {
      status: "internal_error", passed: 0, total: tests.length, executionMs: null,
      errorMessage: `Question is misconfigured: ${configError}`, perTest: [],
    };
  }
  if (tests.length === 0) {
    return { status: "internal_error", passed: 0, total: 0, executionMs: null, errorMessage: "No test cases configured.", perTest: [] };
  }
  if (tests.length > MAX_TESTS_PER_RUN) tests = tests.slice(0, MAX_TESTS_PER_RUN);

  let source: string;
  try {
    source = buildDriverSource(language, codingCfg, code, tests);
  } catch (e) {
    return {
      status: "internal_error", passed: 0, total: tests.length, executionMs: null,
      errorMessage: "Could not prepare your code for execution.", perTest: [],
    };
  }

  const result = await runSource(judge0Cfg, language, source, limits);

  if (result.outcome === "compile_error") {
    return {
      status: "compile_error", passed: 0, total: tests.length, executionMs: result.timeMs,
      errorMessage: truncate(result.compileOutput || result.message || "Compilation failed."), perTest: [],
    };
  }
  if (result.outcome === "time_limit") {
    return {
      status: "time_limit", passed: 0, total: tests.length, executionMs: result.timeMs,
      errorMessage: "Your code took too long to run.", perTest: [],
    };
  }
  if (result.outcome === "memory_limit") {
    return {
      status: "memory_limit", passed: 0, total: tests.length, executionMs: result.timeMs,
      errorMessage: "Your code used too much memory.", perTest: [],
    };
  }
  if (result.outcome === "runtime_error") {
    return {
      status: "runtime_error", passed: 0, total: tests.length, executionMs: result.timeMs,
      errorMessage: truncate(result.stderr || result.message || "Your code crashed while running."), perTest: [],
    };
  }
  if (result.outcome === "internal_error") {
    return {
      status: "internal_error", passed: 0, total: tests.length, executionMs: result.timeMs,
      errorMessage: "The execution service is unavailable. Please try again.", perTest: [],
    };
  }

  // outcome === "ran_ok": parse one JSON line per test, tolerating a
  // participant crash partway through (fewer lines than tests => the
  // remaining tests are marked as errored, not silently dropped).
  const lines = result.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  const perTest: TestOutcome[] = [];
  let passed = 0;

  for (let i = 0; i < tests.length; i++) {
    const line = lines[i];
    if (!line) {
      perTest.push({ index: i, verdict: "error", actual: null, error: "No output produced for this test." });
      continue;
    }
    let parsed: { ok: boolean; result?: unknown; error?: string };
    try {
      parsed = JSON.parse(line);
    } catch {
      perTest.push({ index: i, verdict: "error", actual: null, error: "Could not parse program output." });
      continue;
    }
    if (!parsed.ok) {
      perTest.push({ index: i, verdict: "error", actual: null, error: truncate(parsed.error || "Runtime error") });
      continue;
    }
    const cmpOpts = {
      unordered_result: (codingCfg as unknown as { unordered_result?: boolean }).unordered_result,
      float_tolerance: (codingCfg as unknown as { float_tolerance?: number | null }).float_tolerance ?? null,
    };
    const ok = normalizedEqual(parsed.result, tests[i].expected, cmpOpts);
    if (ok) passed++;
    perTest.push({ index: i, verdict: ok ? "passed" : "failed", actual: parsed.result });
  }

  const allPassed = passed === tests.length;
  const anyRuntimeErrors = perTest.some((t) => t.verdict === "error");

  return {
    status: allPassed ? "accepted" : (anyRuntimeErrors ? "runtime_error" : "wrong_answer"),
    passed,
    total: tests.length,
    executionMs: result.timeMs,
    errorMessage: anyRuntimeErrors
      ? truncate(perTest.find((t) => t.verdict === "error")?.error || "Runtime error")
      : null,
    perTest,
  };
}

function truncate(s: string, max = 4000): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n… (truncated)";
}
