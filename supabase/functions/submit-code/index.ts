// submit-code  ("Submit")
//
// Runs the participant's function against PUBLIC + HIDDEN test cases.
// Hidden test input/expected values are fetched here (via
// get_judge_context, service_role only) and used ONLY to grade — they are
// never echoed back to the browser. A hidden-test failure is reported as
// "Hidden test case failed." with no further detail.
//
// Scoring: record_code_result() is the single source of truth for
// is_solved/score — it derives the score from the question's category + difficulty
// and only the FIRST accepted submission awards points (resubmitting an
// already-solved question changes nothing). The server clock (not this
// function) decides whether the attempt is still active.
//
// Body: { attempt_id, token, question_id, language, code }

import { fail, handle, json, readCredentials, rpcResult, UUID_RE } from "../_shared/util.ts";
import { loadJudge0Config, SupportedLanguage } from "../_shared/judge0.ts";
import { judge, validateCode } from "../_shared/judge.ts";
import { CodingConfig, TestCase } from "../_shared/drivers.ts";

const LANGUAGES: SupportedLanguage[] = ["python3", "java", "cpp", "c"];

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

  // service_role-only RPC: includes hidden_tests. This response is used
  // ONLY inside this function to build the driver and grade; it is never
  // sent back to the browser (see the redaction below).
  const { data: ctx, error: ctxError } = await db.rpc("get_judge_context", {
    p_attempt_id: creds.attemptId,
    p_token: creds.token,
    p_question_id: questionId,
  });
  if (ctxError) throw ctxError;
  if (!ctx || !ctx.ok) return rpcResult(reqCtx, ctx);

  const codingCfg: CodingConfig & { unordered_result?: boolean; float_tolerance?: number | null } = {
    function_name: ctx.function_name,
    params: ctx.params || [],
    return_type: ctx.return_type,
    unordered_result: !!ctx.unordered_result,
    float_tolerance: ctx.float_tolerance ?? null,
  };

  const publicTests: TestCase[] = (ctx.public_tests || []).map((t: { input: Record<string, unknown>; expected: unknown }) => ({
    input: t.input, expected: t.expected,
  }));
  const hiddenTests: TestCase[] = (ctx.hidden_tests || []).map((t: { input: Record<string, unknown>; expected: unknown }) => ({
    input: t.input, expected: t.expected,
  }));
  const allTests = publicTests.concat(hiddenTests);
  const publicCount = publicTests.length;

  let judge0Cfg;
  try {
    judge0Cfg = loadJudge0Config();
  } catch (e) {
    console.error("Judge0 not configured:", e);
    return fail(reqCtx, "execution_unavailable", "The code execution service is not configured. Please tell an organiser.", 503);
  }

  const result = await judge(judge0Cfg, language as SupportedLanguage, codingCfg, code, allTests, {
    timeLimitMs: ctx.time_limit_ms || 2000,
    memoryLimitKb: ctx.memory_limit_kb || 262144,
  });

  // Redact: an error/failure on a HIDDEN test (index >= publicCount) must
  // never reveal its input, expected value, or the participant's actual
  // output. Only public-test detail is safe to return verbatim.
  const firstFailedHidden = result.perTest.find((t) => t.index >= publicCount && t.verdict !== "passed");
  const errorMessage = firstFailedHidden
    ? "Hidden test case failed."
    : result.errorMessage;

  const safeTests = result.perTest.map((t) => {
    const isHidden = t.index >= publicCount;
    if (isHidden) {
      // Pass/fail only — no input, no expected, no actual output.
      return { index: t.index, hidden: true, verdict: t.verdict === "passed" ? "passed" : "failed" };
    }
    return {
      index: t.index,
      hidden: false,
      verdict: t.verdict,
      input: publicTests[t.index]?.input ?? null,
      expected: publicTests[t.index]?.expected ?? null,
      actual: t.actual,
      error: t.error || null,
    };
  });

  // record_code_result is the ONLY place is_solved/score are set for a
  // coding question. Score always comes from the question's category + difficulty in
  // the database, never from anything computed here.
  const { data: scored, error: scoreError } = await db.rpc("record_code_result", {
    p_attempt_id: creds.attemptId,
    p_token: creds.token,
    p_question_id: questionId,
    p_language: language,
    p_status: result.status,
    p_passed: result.passed,
    p_total: result.total,
    p_execution_ms: result.executionMs,
    p_error_message: errorMessage,
    p_code_length: code.length,
  });
  if (scoreError) throw scoreError;
  if (!scored || !scored.ok) return rpcResult(reqCtx, scored);

  return json(reqCtx, {
    ok: true,
    kind: "submit",
    status: result.status,
    is_solved: scored.is_solved,
    newly_solved: scored.newly_solved,
    score: scored.score,
    passed_tests: result.passed,
    total_tests: result.total,
    public_tests_total: publicCount,
    execution_ms: result.executionMs,
    error_message: errorMessage,
    tests: safeTests,
    summary: scored.summary,
  });
});
