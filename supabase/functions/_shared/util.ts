// Shared helpers for the Bug Busters Edge Functions.
//
// Participants have no accounts, so these functions are deployed with
// --no-verify-jwt. Security comes from three things instead:
//   1. every request must carry the attempt's secret access_token,
//   2. all reads/writes go through SECURITY DEFINER database functions,
//   3. the database (not the browser) decides if time is up.
//
// Nothing here runs participant code, SQL, or tests.
//
// CORS: every response this module produces (success, error, and the
// OPTIONS preflight) carries CORS headers resolved for the REQUEST that
// triggered it — see _shared/cors.ts. There is no module-load-time
// ALLOWED_ORIGIN constant here on purpose: computing headers per request
// is what lets a local file:// page (Origin: null) and a deployed site
// both work without redeploying.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor } from "./cors.ts";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TOKEN_RE = /^[a-f0-9]{64}$/;

export type Body = Record<string, unknown>;

// json()/fail() need the CORS headers for the CURRENT request, so handle()
// passes them through via a tiny per-request context object rather than a
// shared mutable global (this file may serve concurrent requests).
export interface Ctx {
  corsHeaders: Record<string, string>;
}

export function json(ctx: Ctx, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
  });
}

export function fail(ctx: Ctx, error: string, message: string, status: number): Response {
  return json(ctx, { ok: false, error, message }, status);
}

const STATUS_BY_ERROR: Record<string, number> = {
  invalid_input: 400,
  answer_too_long: 400,
  question_not_assigned: 400,
  not_found: 404,
  expired: 409,
  attempt_closed: 409,
  name_mismatch: 409,
};

const MESSAGE_BY_ERROR: Record<string, string> = {
  invalid_input: "Check your details and try again.",
  name_mismatch: "This participant number is already used with a different name.",
  not_found: "Contest session not found.",
  expired: "Time is up. Answers are locked.",
  attempt_closed: "This contest attempt has already ended.",
  answer_too_long: "Answer is too long (20,000 characters maximum).",
  question_not_assigned: "That question is not part of this attempt.",
};

// Turns the { ok, error } object returned by our SQL functions into an HTTP response.
export function rpcResult(ctx: Ctx, data: { ok?: boolean; error?: string } | null): Response {
  if (data && data.ok) return json(ctx, data);
  const code = data?.error ?? "server_error";
  return fail(ctx, code, MESSAGE_BY_ERROR[code] ?? "Request failed.", STATUS_BY_ERROR[code] ?? 400);
}

function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    // Fails loudly in the function logs rather than as an opaque crash —
    // this is a deployment/secrets problem, not a request problem.
    console.error("Edge Function is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    throw new Error("Server is not configured correctly.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Wraps a handler with CORS, method check, JSON parsing and error handling.
// CORS headers are computed ONCE per request, from that request's own
// Origin header, and reused for every response path below — including the
// OPTIONS preflight and the catch-all 500, so a crash never surfaces to
// the browser as a bare CORS failure that hides the real error.
export function handle(handler: (body: Body, db: SupabaseClient, ctx: Ctx) => Promise<Response>): void {
  Deno.serve(async (req: Request) => {
    const ctx: Ctx = { corsHeaders: corsHeadersFor(req) };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: ctx.corsHeaders });
    }
    if (req.method !== "POST") return fail(ctx, "method_not_allowed", "Use POST.", 405);

    if (Number(req.headers.get("content-length") ?? 0) > 200_000) {
      return fail(ctx, "invalid_input", "Request is too large.", 413);
    }

    let body: Body;
    try {
      const parsed = await req.json();
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
      body = parsed as Body;
    } catch {
      return fail(ctx, "invalid_input", "Send a JSON object.", 400);
    }

    try {
      return await handler(body, serviceClient(), ctx);
    } catch (err) {
      // Every thrown error — a bad RPC, a missing secret, a Judge0 network
      // failure, anything — lands here and still gets proper CORS headers
      // plus a real (if generic) message, instead of the browser reporting
      // an unrelated-looking CORS error for what is actually a 500.
      console.error("Edge Function error:", err);
      return fail(ctx, "server_error", "Something went wrong on the server. Please try again.", 500);
    }
  });
}

// Validates the attempt_id + token pair every participant request must carry.
export function readCredentials(body: Body): { attemptId: string; token: string } | null {
  const attemptId = typeof body.attempt_id === "string" ? body.attempt_id : "";
  const token = typeof body.token === "string" ? body.token : "";
  if (!UUID_RE.test(attemptId) || !TOKEN_RE.test(token)) return null;
  return { attemptId, token };
}
