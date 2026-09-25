// execute-sql  ("Run Code" for SQL questions)
//
// Runs the participant's query against ONLY the public test's fixture
// data for the question. Never touches scoring or is_solved — see
// submit-sql for that. Hidden tests/hidden_seed_sql are never fetched by
// this function (it calls get_public_sql_tests, not get_sql_judge_context).
//
// The query itself never runs inside THIS function's own database
// session — it runs over a SEPARATE connection, authenticated as the
// locked-down sql_judge Postgres role, inside that connection's own
// pg_temp schema. See _shared/sql-judge.ts for why, and
// supabase/migrations/005_sql_execution.sql for how sql_judge is locked
// down. This function's own `db` client (service_role) only ever reads
// question configuration and writes the audit log — it never executes
// participant SQL.
//
// Body: { attempt_id, token, question_id, dialect, query }
//
// DIAGNOSTICS: same three-step try/catch pattern as execute-code — a
// failure fetching public tests, judging the query, or writing the
// audit log are each logged distinctly server-side and never turn a
// successful run into an opaque 500 (see the note on Step 3 below).

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
  if (!query.trim()) return fail(reqCtx, "invalid_input", "Write a query before running it.", 400);
  if (query.length > MAX_QUERY_CHARS) {
    return fail(reqCtx, "invalid_input", `Query is too long (${MAX_QUERY_CHARS.toLocaleString()} characters maximum).`, 400);
  }

  // Defense-in-depth statement guard — never the real security boundary
  // (that's the sql_judge role's privileges), but rejects an obviously
  // hostile statement before ever opening a database connection.
  const guardResult = guardStatement(query);
  if (guardResult.blocked) {
    return fail(reqCtx, "dialect_rejected", guardResult.reason, 400);
  }

  // ---------------------------------------------------------------
  // Step 1: fetch the question's schema/seed SQL + PUBLIC tests only.
  // Hidden tests/hidden_seed_sql are never reachable from this
  // function — calls get_public_sql_tests, never get_sql_judge_context.
  // ---------------------------------------------------------------
  let ctx: Record<string, unknown>;
  try {
    const { data, error } = await db.rpc("get_public_sql_tests", {
      p_attempt_id: creds.attemptId,
      p_token: creds.token,
      p_question_id: questionId,
    });
    if (error) {
      logSupabaseError("execute-sql: get_public_sql_tests failed", error);
      return fail(reqCtx, "public_tests_failed", "Could not load this question's tests. Please try again.", 502);
    }
    if (!data || !data.ok) return rpcResult(reqCtx, data);
    ctx = data;
  } catch (error) {
    logSupabaseError("execute-sql: get_public_sql_tests failed", error);
    return fail(reqCtx, "public_tests_failed", "Could not load this question's tests. Please try again.", 502);
  }

  const schemaSql = (ctx.schema_sql as string) || "";
  const seedSql = (ctx.seed_sql as string) || null;
  const publicTests = (ctx.public_tests as { expected: Record<string, unknown>[] }[]) || [];
  const orderedResult = ctx.ordered_result !== false;
  const statementTimeoutMs = (ctx.statement_timeout_ms as number) || 2000;
  const maxRows = (ctx.max_rows as number) || 1000;
  const testsToRun = publicTests.slice(0, MAX_TESTS_PER_RUN);

  console.log("execute-sql: request", {
    question_id: questionId,
    dialect,
    public_test_count: testsToRun.length,
    statement_timeout_ms: statementTimeoutMs,
    max_rows: maxRows,
  });

  let sqlJudgeCfg;
  try {
    sqlJudgeCfg = loadSqlJudgeConfig();
  } catch (e) {
    console.error("sql_judge not configured:", e);
    return fail(reqCtx, "execution_unavailable", "The SQL execution service is not configured. Please tell an organiser.", 503);
  }

  // ---------------------------------------------------------------
  // Step 2: run the query once per public test (schema+seed are
  // idempotent per-connection since each run gets its own fresh
  // pg_temp), over the SEPARATE sql_judge connection.
  // ---------------------------------------------------------------
  const perTest: { index: number; verdict: "passed" | "failed" | "error"; rows?: Record<string, unknown>[]; error?: string }[] = [];
  let firstExecutionMs: number | null = null;
  let overallStatus: "accepted" | "wrong_answer" | "syntax_error" | "runtime_error" | "time_limit" | "row_limit" | "internal_error" = "accepted";
  let overallMessage: string | null = null;

  try {
    if (testsToRun.length === 0) {
      overallStatus = "internal_error";
      overallMessage = "No test cases configured for this question.";
    } else {
      for (let i = 0; i < testsToRun.length; i++) {
        const result = await runSqlJudge(sqlJudgeCfg, {
          schemaSql,
          seedSql,
          hiddenSeedSql: null,
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

        const cmp = compareSqlResult(result.rows, testsToRun[i].expected, { orderedResult });
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
    console.error("execute-sql: judge failed", e?.message ?? String(error));
    if (e?.stack) console.error(e.stack);
    return fail(reqCtx, "execution_failed", "Could not run your query right now. Please try again.", 502);
  }

  const passed = perTest.filter((t) => t.verdict === "passed").length;

  // ---------------------------------------------------------------
  // Step 3: record the run in the audit log. Best-effort — execution
  // already succeeded by this point, so a failure here must NEVER turn
  // a real result into a 500; it's logged and the actual result is
  // still returned.
  // ---------------------------------------------------------------
  try {
    const { error } = await db.rpc("record_sql_run_result", {
      p_attempt_id: creds.attemptId,
      p_token: creds.token,
      p_question_id: questionId,
      p_dialect: dialect,
      p_status: overallStatus,
      p_passed: passed,
      p_total: testsToRun.length,
      p_execution_ms: firstExecutionMs,
      p_error_message: overallMessage,
      p_query_length: query.length,
    });
    if (error) logSupabaseError("execute-sql: record_sql_run_result failed", error);
  } catch (error) {
    logSupabaseError("execute-sql: record_sql_run_result failed", error);
  }

  return json(reqCtx, {
    ok: true,
    kind: "run",
    status: overallStatus,
    passed_tests: passed,
    total_tests: testsToRun.length,
    execution_ms: firstExecutionMs,
    error_message: overallMessage,
    tests: perTest.map((t, i) => ({
      index: i,
      verdict: t.verdict,
      expected: testsToRun[i]?.expected ?? null,
      actual: t.rows ?? null,
      error: t.error || null,
    })),
  });
});
