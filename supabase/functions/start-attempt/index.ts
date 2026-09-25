// start-attempt
//
// Validates name + participant number, then asks the database to
//   - create/find the participant,
//   - create the attempt (started_at now, expires_at = started_at + 45 min),
//   - randomly pick 2 easy + 2 medium + 1 hard for Coding and for SQL,
//   - save those 10 question ids in attempt_questions.
// All of that happens inside ONE database transaction (create_attempt), so a
// half-created attempt is impossible. If this participant already has an
// attempt, it is returned as-is: the clock and the questions do not restart.

import { fail, handle, rpcResult } from "../_shared/util.ts";

// Any letters (including Tamil and other scripts), spaces, dots, apostrophes, hyphens.
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'\-]{0,79}$/u;
const PARTICIPANT_NO_RE = /^[A-Za-z0-9][A-Za-z0-9 _\-\/.]{0,29}$/;

handle(async (body, db, ctx) => {
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const participantNo = typeof body.participant_no === "string" ? body.participant_no.trim() : "";

  if (!NAME_RE.test(name) || !PARTICIPANT_NO_RE.test(participantNo)) {
    return fail(ctx, "invalid_input", "Enter a valid name and participant number.", 400);
  }

  const { data, error } = await db.rpc("create_attempt", {
    p_name: name,
    p_participant_no: participantNo,
  });

  if (error) {
    if (error.message?.startsWith("not_enough_questions")) {
      // Detail is only for the organisers' logs.
      console.error(error.message);
      return fail(
        ctx,
        "not_enough_questions",
        "The question bank is not ready. Please tell an organiser.",
        503,
      );
    }
    throw error;
  }

  return rpcResult(ctx, data);
});
