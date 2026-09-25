// save-sql
//
// Autosaves a participant's SQL query for one (question, dialect) pair.
// Each dialect (sql / postgresql) is stored under its own key, so
// switching dialects in the editor never erases the other's saved query
// — see public.autosave_sql() in supabase/migrations/005_sql_execution.sql.
//
// Body: { attempt_id, token, question_id, dialect, query }

import { fail, handle, readCredentials, rpcResult, UUID_RE } from "../_shared/util.ts";

const MAX_QUERY_CHARS = 20000;
const DIALECTS = ["sql", "postgresql"];

handle(async (body, db, ctx) => {
  const creds = readCredentials(body);
  if (!creds) return fail(ctx, "not_found", "Contest session not found.", 404);

  const questionId = typeof body.question_id === "string" ? body.question_id : "";
  if (!UUID_RE.test(questionId)) return fail(ctx, "invalid_input", "Unknown question.", 400);

  const dialect = typeof body.dialect === "string" ? body.dialect : "";
  if (DIALECTS.indexOf(dialect) === -1) return fail(ctx, "invalid_input", "Unsupported SQL dialect.", 400);

  let query = typeof body.query === "string" ? body.query : "";
  query = query.replace(/\u0000/g, ""); // Postgres text cannot hold NUL characters
  if (query.length > MAX_QUERY_CHARS) {
    return fail(ctx, "answer_too_long", "Query is too long (20,000 characters maximum).", 400);
  }

  const { data, error } = await db.rpc("autosave_sql", {
    p_attempt_id: creds.attemptId,
    p_token: creds.token,
    p_question_id: questionId,
    p_dialect: dialect,
    p_query: query,
  });
  if (error) throw error;

  return rpcResult(ctx, data);
});
