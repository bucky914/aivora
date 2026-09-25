// submit-sql  ("Submit" for SQL questions)
//
// Runs the participant's query against PUBLIC + HIDDEN test fixtures.
// Hidden seed SQL/expected results are fetched here (via
// get_sql_judge_context, service_role only) and used ONLY to grade —
// they are never echoed back to the browser. A hidden-test failure is
// reported as "Hidden test case failed." with no further detail —
// exactly the same redaction pattern as submit-code.
//
// Scoring: record_sql_result() is the single source of truth for
// is_solved/score — it derives the score from the question's category + difficulty
// and only the FIRST accepted submission awards points (resubmitting an
// already-solved question changes nothing). Never awarded for Run Code.
// The server clock (not this function) decides whether the attempt is
// still active.
//
// The participant's query itself runs over a SEPARATE connection,
// authenticated as the locked-down sql_judge Postgres role — never
// through this function's own service_role database client. See
// _shared/sql-judge.ts and supabase/migrations/005_sql_execution.sql.
//
// Body: { attempt_id, token, question_id, dialect, query }

import { fail, handle, json, readCredentials, rpcResult, UUID_RE } from "../_shared/util.ts";
import { loadSqlJudgeConfig, runSqlJudge, SqlDialect } from "../_shared/sql-judge.ts";
import { compareSqlResult } from "../_shared/sql-compare.ts";
import { guardStatement } from "../_shared/sql-guard.ts";

const DIALECTS: SqlDialect[] = ["sql", "postgresql"];
const MAX_QUERY_CHARS = 20000;
const MAX_TESTS_PER_RUN = 30;

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

  const dialect = typeof body.dialect === "string" ? body.dialect : "";
  if (DIALECTS.indexOf(dialect as SqlDialect) === -1) {
    return fail(reqCtx, "invalid_input", "Unsupported SQL dialect.", 400);
  }

  const query = typeof body.query === "string" ? body.query : "";
  if (!query.trim()) return fail(reqCtx, "invalid_input", "Write a query before submitting.", 400);
  if (query.length > MAX_QUERY_CHARS) {
    return fail(reqCtx, "invalid_input", `Query is too long (${MAX_QUERY_CHARS.toLocaleString()} characters maximum).`, 400);
  }

  const guardResult = guardStatement(query);
  if (guardResult.blocked) {
    return fail(reqCtx, "dialect_rejected", guardResult.reason, 400);
  }

  // service_role-only RPC: includes hidden_tests/hidden_seed_sql. This
  // response is used ONLY inside this function to build the fixture and
  // grade; it is never sent back to the browser (see the redaction below).
  let ctx: Record<string, unknown>;
  try {
    const { data, error } = await db.rpc("get_sql_judge_context", {
      p_attempt_id: creds.attemptId,
      p_token: creds.token,
      p_question_id: questionId,
    });
    if (error) {
      logSupabaseError("submit-sql: get_sql_judge_context failed", error);
      return fail(reqCtx, "public_tests_failed", "Could not load this question's tests. Please try again.", 502);
    }
    if (!data || !data.ok) return rpcResult(reqCtx, data);
    ctx = data;
  } catch (error) {
    logSupabaseError("submit-sql: get_sql_judge_context failed", error);
    return fail(reqCtx, "public_tests_failed", "Could not load this question's tests. Please try again.", 502);
  }

  const schemaSql = (ctx.schema_sql as string) || "";
  const seedSql = (ctx.seed_sql as string) || null;
  const hiddenSeedSql = (ctx.hidden_seed_sql as string) || null;
  const publicTests = (ctx.public_tests as { expected: Record<string, unknown>[] }[]) || [];
  const hiddenTests = (ctx.hidden_tests as { expected: Record<string, unknown>[] }[]) || [];
  const orderedResult = ctx.ordered_result !== false;
  const statementTimeoutMs = (ctx.statement_timeout_ms as number) || 2000;
  const maxRows = (ctx.max_rows as number) || 1000;

  const publicCount = Math.min(publicTests.length, MAX_TESTS_PER_RUN);
  const remainingBudget = Math.max(0, MAX_TESTS_PER_RUN - publicCount);
  const hiddenToRun = hiddenTests.slice(0, remainingBudget);
  const allTests = publicTests.slice(0, publicCount).concat(hiddenToRun);

  let sqlJudgeCfg;
  try {
    sqlJudgeCfg = loadSqlJudgeConfig();
  } catch (e) {
    console.error("sql_judge not configured:", e);
    return fail(reqCtx, "execution_unavailable", "The SQL execution service is not configured. Please tell an organiser.", 503);
  }

  const perTest: { index: number; verdict: "passed" | "failed" | "error"; rows?: Record<string, unknown>[]; error?: string }[] = [];
  let firstExecutionMs: number | null = null;
  let overallStatus: "accepted" | "wrong_answer" | "syntax_error" | "runtime_error" | "time_limit" | "row_limit" | "internal_error" = "accepted";
  let overallMessage: string | null = null;

  try {
    if (allTests.length === 0) {
      overallStatus = "internal_error";
      overallMessage = "No test cases configured for this question.";
    } else {
      for (let i = 0; i < allTests.length; i++) {
        // Public tests run against schema+seed only; hidden tests ALSO
        // apply hidden_seed_sql on top, so a question can add edge-case
        // rows the public fixture doesn't show.
        const isHidden = i >= publicCount;
        const result = await runSqlJudge(sqlJudgeCfg, {
          schemaSql,
          seedSql,
          hiddenSeedSql: isHidden ? hiddenSeedSql : null,
          query,
          statementTimeoutMs,
          maxRows,
        });
        if (firstExecutionMs === null) firstExecutionMs = result.timeMs;

        if (result.outcome !== "ran_ok") {
          perTest.push({ index: i, verdict: "error", error: result.message });
          if (overallStatus === "accepted") { overallStatus = result.outcome; overallMessage = result.message; }
          continue;
        }

        const cmp = compareSqlResult(result.rows, allTests[i].expected, { orderedResult });
        if (cmp.ok) {
          perTest.push({ index: i, verdict: "passed", rows: result.rows });
        } else {
          perTest.push({ index: i, verdict: "failed", rows: result.rows, error: cmp.reason });
          if (overallStatus === "accepted") overallStatus = "wrong_answer";
        }
      }
    }
  } catch (error) {
    const e = error as Error;
    console.error("submit-sql: judge failed", e?.message ?? String(error));
    if (e?.stack) console.error(e.stack);
    return fail(reqCtx, "execution_failed", "Could not run your query right now. Please try again.", 502);
  }

  const passed = perTest.filter((t) => t.verdict === "passed").length;

  // Redact: an error/failure on a HIDDEN test (index >= publicCount) must
  // never reveal its expected value or the participant's actual output —
  // identical redaction rule to submit-code.
  const firstFailedHidden = perTest.find((t) => t.index >= publicCount && t.verdict !== "passed");
  const errorMessage = firstFailedHidden ? "Hidden test case failed." : overallMessage;

  const safeTests = perTest.map((t) => {
    const isHidden = t.index >= publicCount;
    if (isHidden) {
      return { index: t.index, hidden: true, verdict: t.verdict === "passed" ? "passed" : "failed" };
    }
    return {
      index: t.index,
      hidden: false,
      verdict: t.verdict,
      expected: allTests[t.index]?.expected ?? null,
      actual: t.rows ?? null,
      error: t.error || null,
    };
  });

  // record_sql_result is the ONLY place is_solved/score are set for a
  // SQL question. Score always comes from the question's category + difficulty in
  // the database, never from anything computed here or claimed by the
  // frontend.
  let scored: Record<string, unknown> | null;
  try {
    const { data, error } = await db.rpc("record_sql_result", {
      p_attempt_id: creds.attemptId,
      p_token: creds.token,
      p_question_id: questionId,
      p_dialect: dialect,
      p_status: overallStatus,
      p_passed: passed,
      p_total: allTests.length,
      p_execution_ms: firstExecutionMs,
      p_error_message: errorMessage,
      p_query_length: query.length,
    });
    if (error) {
      logSupabaseError("submit-sql: record_sql_result failed", error);
      return fail(reqCtx, "scoring_failed", "Your query ran, but the result could not be recorded. Please try submitting again.", 502);
    }
    scored = data;
  } catch (error) {
    logSupabaseError("submit-sql: record_sql_result failed", error);
    return fail(reqCtx, "scoring_failed", "Your query ran, but the result could not be recorded. Please try submitting again.", 502);
  }
  if (!scored || !scored.ok) return rpcResult(reqCtx, scored);

  return json(reqCtx, {
    ok: true,
    kind: "submit",
    status: overallStatus,
    is_solved: scored.is_solved,
    newly_solved: scored.newly_solved,
    score: scored.score,
    passed_tests: passed,
    total_tests: allTests.length,
    public_tests_total: publicCount,
    execution_ms: firstExecutionMs,
    error_message: errorMessage,
    tests: safeTests,
    summary: scored.summary,
  });
});
