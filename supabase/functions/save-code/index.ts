// save-code
//
// Autosaves a participant's code for one (question, language) pair.
// Each language is stored under its own key, so switching languages in
// the editor never erases another language's saved code — see
// public.autosave_code() in supabase/migrations/001_code_execution.sql.
//
// Body: { attempt_id, token, question_id, language, code }

import { fail, handle, readCredentials, rpcResult, UUID_RE } from "../_shared/util.ts";

const MAX_CODE_CHARS = 20000;
const LANGUAGES = ["python3", "java", "cpp", "c"];

handle(async (body, db, ctx) => {
  const creds = readCredentials(body);
  if (!creds) return fail(ctx, "not_found", "Contest session not found.", 404);

  const questionId = typeof body.question_id === "string" ? body.question_id : "";
  if (!UUID_RE.test(questionId)) return fail(ctx, "invalid_input", "Unknown question.", 400);

  const language = typeof body.language === "string" ? body.language : "";
  if (LANGUAGES.indexOf(language) === -1) return fail(ctx, "invalid_input", "Unsupported language.", 400);

  let code = typeof body.code === "string" ? body.code : "";
  code = code.replace(/\u0000/g, ""); // Postgres text cannot hold NUL characters
  if (code.length > MAX_CODE_CHARS) {
    return fail(ctx, "answer_too_long", "Code is too long (20,000 characters maximum).", 400);
  }

  const { data, error } = await db.rpc("autosave_code", {
    p_attempt_id: creds.attemptId,
    p_token: creds.token,
    p_question_id: questionId,
    p_language: language,
    p_code: code,
  });
  if (error) throw error;

  return rpcResult(ctx, data);
});
