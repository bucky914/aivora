// finish-attempt
//
// The participant chose to finish early. Marks the attempt "completed",
// stores submitted_at, and locks it: after this, submit-answer rejects
// every change. If the deadline had already passed, the attempt is
// recorded as "expired" instead.
//
// Body: { attempt_id, token }

import { fail, handle, readCredentials, rpcResult } from "../_shared/util.ts";

handle(async (body, db, ctx) => {
  const creds = readCredentials(body);
  if (!creds) return fail(ctx, "not_found", "Contest session not found.", 404);

  const { data, error } = await db.rpc("finish_attempt", {
    p_attempt_id: creds.attemptId,
    p_token: creds.token,
  });
  if (error) throw error;

  return rpcResult(ctx, data);
});
