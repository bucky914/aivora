// get-attempt
//
// Lets a participant's browser load (or reload) their own attempt.
// Returns ONLY the 10 questions assigned to this attempt, the saved answers,
// a score summary, and the SERVER clock + server deadline so the countdown
// never depends on the participant's own computer clock.
//
// This is what makes a refresh safe: the deadline and the questions come
// from the database every time, so nothing restarts or reshuffles.
//
// Body: { attempt_id, token, light? }   light=true skips the questions
// (used for cheap timer re-syncs).

import { fail, handle, readCredentials, rpcResult } from "../_shared/util.ts";

handle(async (body, db, ctx) => {
  const creds = readCredentials(body);
  if (!creds) return fail(ctx, "not_found", "Contest session not found.", 404);

  const { data, error } = await db.rpc("get_attempt_state", {
    p_attempt_id: creds.attemptId,
    p_token: creds.token,
    p_light: body.light === true,
  });
  if (error) throw error;

  return rpcResult(ctx, data);
});
