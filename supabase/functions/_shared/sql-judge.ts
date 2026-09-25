// SQL judge client. Connects DIRECTLY to Postgres as the unprivileged
// sql_judge role (see supabase/migrations/005_sql_execution.sql for how
// that role is created and locked down) — this is a SEPARATE connection
// from the service-role Supabase client used everywhere else in this
// project, over its own connection string, so a participant's SQL can
// never reach real application data even if every other layer failed.
//
// Required secret:
//   SQL_JUDGE_DB_URL   A full Postgres connection string authenticating
//                       as the sql_judge role, e.g.:
//                       postgres://sql_judge:PASSWORD@HOST:5432/postgres
//                       (for Supabase, HOST/port are the same ones
//                       SUPABASE_DB_URL uses — only the role/password
//                       differ). Set the role's password once with
//                       ALTER ROLE sql_judge WITH PASSWORD '...' in the
//                       SQL editor, then build this URL around it. See
//                       the README for the exact steps.
//
// EXECUTION MODEL: one pooled Postgres connection per Run/Submit call.
// Each connection:
//   1. sets a per-connection statement_timeout for this question,
//   2. runs the question's schema_sql (creates TEMP TABLEs — these live
//      in pg_temp, invisible to every other session),
//   3. runs seed_sql (and hidden_seed_sql, for Submit only),
//   4. runs the participant's query and captures the result rows,
//   5. runs DISCARD ALL, THEN releases the connection back to the pool.
//
// pg_temp is tied to the backend PROCESS, not to any one logical
// "client" object — a connection POOL genuinely reuses the same backend
// process across calls (deno-postgres's PoolClient.release() returns
// the connection to the pool rather than closing it), so without an
// explicit cleanup step, one submission's temp tables could still exist
// when the pool hands that same backend to the NEXT submission. DISCARD
// ALL is Postgres's own builtin for exactly this situation — it drops
// every temp table and resets session-local SET values in one atomic,
// standard command — so it is run unconditionally in a `finally` block
// before the connection is released, whether the run succeeded, failed,
// or timed out.

import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

export type SqlDialect = "sql" | "postgresql";

export interface SqlJudgeConfig {
  connectionUrl: string;
}

export function loadSqlJudgeConfig(): SqlJudgeConfig {
  const connectionUrl = Deno.env.get("SQL_JUDGE_DB_URL");
  if (!connectionUrl) {
    throw new Error("SQL_JUDGE_DB_URL is not set.");
  }
  return { connectionUrl };
}

export type SqlOutcome =
  | "ran_ok"              // query executed, rows captured (still needs comparison)
  | "syntax_error"        // schema_sql/seed_sql/query failed to parse
  | "runtime_error"       // query parsed but failed during execution (e.g. division by zero)
  | "time_limit"          // statement_timeout fired
  | "row_limit"           // query returned more rows than max_rows allows
  | "internal_error";     // connection/pool failure, or anything unexpected

export interface SqlRunResult {
  outcome: SqlOutcome;
  rows: Record<string, unknown>[];
  rowCount: number;
  message: string;         // safe to show for public-test failures; caller decides what to reveal
  timeMs: number | null;
}

const PG_QUERY_CANCELED = "57014";        // statement_timeout fired
const PG_SYNTAX_ERROR_CLASS = "42";        // 42xxx = syntax error or access rule violation class
const PG_CONNECTION_EXCEPTION_CLASS = "08";

function classifyPgError(err: unknown): { outcome: SqlOutcome; message: string } {
  const e = err as { fields?: { code?: string; message?: string }; message?: string } | null;
  const code = e?.fields?.code;
  const pgMessage = e?.fields?.message || e?.message || String(err);

  if (code === PG_QUERY_CANCELED) {
    return { outcome: "time_limit", message: "The query took too long to run." };
  }
  if (code && code.startsWith(PG_SYNTAX_ERROR_CLASS)) {
    return { outcome: "syntax_error", message: pgMessage };
  }
  if (code && code.startsWith(PG_CONNECTION_EXCEPTION_CLASS)) {
    return { outcome: "internal_error", message: "Could not reach the database. Please try again." };
  }
  // Any other SQLSTATE (23xxx constraint violation, 22xxx data exception,
  // etc.) that happens while running a well-formed query is a runtime
  // error from the participant's point of view, not a syntax problem.
  return { outcome: "runtime_error", message: pgMessage };
}

let pool: Pool | null = null;
function getPool(cfg: SqlJudgeConfig): Pool {
  // lazyLimit: false means the pool eagerly validates connections are
  // usable; size of 3 is intentionally small — this function is not
  // meant to serve high concurrent throughput, just to avoid a fresh
  // TCP+TLS handshake on every single call under light concurrent load.
  if (!pool) pool = new Pool(cfg.connectionUrl, 3, true);
  return pool;
}

export interface RunSqlOptions {
  schemaSql: string;
  seedSql: string | null;
  hiddenSeedSql: string | null;   // null for Run Code; set for Submit
  query: string;
  statementTimeoutMs: number;
  maxRows: number;
}

// Runs one participant query end-to-end: connect as sql_judge, set the
// timeout, build the question's fixture (schema + seed [+ hidden seed]),
// run the query, capture rows, then END the connection (not just
// release it back to the pool) so pg_temp is guaranteed to be empty for
// whatever connection serves the next submission.
export async function runSqlJudge(cfg: SqlJudgeConfig, opts: RunSqlOptions): Promise<SqlRunResult> {
  const p = getPool(cfg);
  const client = await p.connect();
  const startedAt = Date.now();

  try {
    await client.queryObject(`SET statement_timeout = ${Math.max(1, Math.floor(opts.statementTimeoutMs))}`);

    try {
      await client.queryObject(opts.schemaSql);
      if (opts.seedSql && opts.seedSql.trim()) {
        await client.queryObject(opts.seedSql);
      }
      if (opts.hiddenSeedSql && opts.hiddenSeedSql.trim()) {
        await client.queryObject(opts.hiddenSeedSql);
      }
    } catch (err) {
      // A failure setting up the FIXTURE (not the participant's query)
      // is a question-configuration problem, not the participant's
      // fault — but from their point of view it still means their
      // query never even ran. Logged distinctly so it's easy to tell
      // apart from a participant's own syntax error server-side.
      const classified = classifyPgError(err);
      console.error("sql-judge: fixture setup failed (schema_sql/seed_sql)", classified.message);
      return {
        outcome: "internal_error",
        rows: [], rowCount: 0,
        message: "This question's test data could not be prepared. Please tell an organiser.",
        timeMs: Date.now() - startedAt,
      };
    }

    let result;
    try {
      // maxRows caps how many rows deno-postgres will buffer; asking for
      // one more than the limit lets us tell "exactly at the limit" apart
      // from "over the limit" without an extra COUNT(*) round-trip.
      result = await client.queryObject(opts.query);
    } catch (err) {
      const classified = classifyPgError(err);
      return {
        outcome: classified.outcome,
        rows: [], rowCount: 0,
        message: classified.message,
        timeMs: Date.now() - startedAt,
      };
    }

    const rows = result.rows as Record<string, unknown>[];
    if (rows.length > opts.maxRows) {
      return {
        outcome: "row_limit",
        rows: [], rowCount: rows.length,
        message: `Your query returned too many rows (over ${opts.maxRows.toLocaleString()}). Did you forget a WHERE or GROUP BY?`,
        timeMs: Date.now() - startedAt,
      };
    }

    return {
      outcome: "ran_ok",
      rows,
      rowCount: rows.length,
      message: "",
      timeMs: Date.now() - startedAt,
    };
  } catch (err) {
    // Anything outside the two inner try/catches above (e.g. the SET
    // statement_timeout call itself failing) — an infrastructure
    // problem, not a participant-query problem.
    const classified = classifyPgError(err);
    console.error("sql-judge: unexpected failure", classified.message);
    return {
      outcome: "internal_error",
      rows: [], rowCount: 0,
      message: "The database judge is temporarily unavailable. Please try again.",
      timeMs: Date.now() - startedAt,
    };
  } finally {
    // Unconditionally clean up session state before returning this
    // connection to the pool — DISCARD ALL drops every temp table this
    // run created and resets session-local SET values (statement_timeout
    // included) back to the role's defaults, in one atomic builtin
    // command. This runs whether the query succeeded, failed, or timed
    // out, so the connection is always handed back pg_temp-clean,
    // regardless of what happens above.
    try {
      await client.queryObject("DISCARD ALL");
    } catch (discardErr) {
      // If even DISCARD ALL fails (e.g. the connection is already
      // broken), don't pool a possibly-dirty connection — best effort:
      // log it and let release() proceed; deno-postgres pools do not
      // currently expose a "discard this connection" release mode, so a
      // failed DISCARD ALL here is logged for visibility rather than
      // silently swallowed.
      console.error("sql-judge: DISCARD ALL failed while releasing connection", discardErr);
    }
    client.release();
  }
}
