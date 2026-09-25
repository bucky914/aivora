// submit-answer
//
// Saves the participant's written answer and/or solved state for one question.
// The database function it calls:
//   - checks the attempt exists and the token matches,
//   - checks the attempt is still active,
//   - checks the SERVER time is before expires_at (the browser timer is never trusted),
//   - checks the question really belongs to this attempt,
//   - calculates the score from the question's category + difficulty and never from anything the browser sends,
//     using Coding 10/20/30 and SQL 5/10/15,
//   - upserts one row per (attempt, question), so repeat clicks cannot score twice.
//
// The answer is stored as plain text. It is never executed, run, or tested.
//
// Body: { attempt_id, token, question_id, answer?, is_solved? }
//   answer omitted/null    -> keep the saved answer
//   is_solved omitted/null -> keep the current solved state (used by autosave)

import { fail, handle, readCredentials, rpcResult, UUID_RE } from "../_shared/util.ts";

const MAX_ANSWER_CHARS = 20000;

handle(async (body, db, ctx) => {
  const creds = readCredentials(body);
  if (!creds) return fail(ctx, "not_found", "Contest session not found.", 404);

  const questionId = typeof body.question_id === "string" ? body.question_id : "";
  if (!UUID_RE.test(questionId)) return fail(ctx, "invalid_input", "Unknown question.", 400);

  let answer: string | null = null;
  if (body.answer !== undefined && body.answer !== null) {
    if (typeof body.answer !== "string") return fail(ctx, "invalid_input", "Answer must be text.", 400);
    // Postgres text cannot hold NUL characters.
    answer = body.answer.replace(/\u0000/g, "");
    if (answer.length > MAX_ANSWER_CHARS) {
      return fail(ctx, "answer_too_long", "Answer is too long (20,000 characters maximum).", 400);
    }
  }

  let solved: boolean | null = null;
  if (body.is_solved !== undefined && body.is_solved !== null) {
    if (typeof body.is_solved !== "boolean") {
      return fail(ctx, "invalid_input", "is_solved must be true or false.", 400);
    }
    solved = body.is_solved;
  }

  const { data, error } = await db.rpc("submit_answer", {
    p_attempt_id: creds.attemptId,
    p_token: creds.token,
    p_question_id: questionId,
    p_answer: answer,
    p_solved: solved,
  });
  if (error) throw error;

  return rpcResult(ctx, data);
});
