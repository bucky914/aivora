// Shared CORS handling for every Edge Function.
//
// Browsers send an `Origin` header with every cross-origin request. For a
// page opened via `file://`, or certain sandboxed/opaque contexts, that
// header's value is the literal string "null" — this is normal browser
// behaviour, not a bug, and a CORS layer has to decide whether to allow it.
//
// This project is a public, unauthenticated contest site (no participant
// accounts), so the practical risk from a wide-open CORS policy is low —
// every real security boundary here is the attempt's secret access_token
// plus the database's own checks, not same-origin restriction. Even so, we
// avoid a bare "*" in production and instead resolve the allow-list
// per-request, so:
//   - local development (file://, 127.0.0.1/localhost on any port,
//     including http://localhost:5500) always works out of the box,
//   - a deployed ALLOWED_ORIGINS list is honoured when set,
//   - anything else still gets a response (never a silent network
//     failure) but is logged, so a misconfigured origin is visible in the
//     function logs instead of surfacing only as an opaque browser error.
//
// Configure allowed production origins with the ALLOWED_ORIGINS secret —
// a comma-separated list, e.g.:
//   ALLOWED_ORIGINS=https://bug-busters.vercel.app,https://vyugam.example.com
// Leave it unset to allow any origin (fine for a contest with no accounts;
// tighten it once you know your production domain).

const DEV_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function configuredOrigins(): string[] | null {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw || !raw.trim()) return null; // not configured -> allow any origin
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// Decides the Access-Control-Allow-Origin value for THIS request.
// Always returns a usable value — CORS headers are attached to every
// response (success, error, and OPTIONS) so a request is never silently
// dropped by the browser; misconfiguration is logged instead.
function resolveAllowOrigin(req: Request): string {
  const origin = req.headers.get("origin"); // null header, or the literal string "null" for file://
  const allowlist = configuredOrigins();

  if (!allowlist) {
    // No allow-list configured: mirror the request's own origin back
    // (works for "null" from file://, any http(s) origin, and requests
    // with no Origin header at all — e.g. curl/server-to-server calls,
    // which don't need CORS headers but get a harmless one anyway).
    return origin || "*";
  }

  if (origin && (allowlist.includes(origin) || DEV_ORIGIN_RE.test(origin))) {
    return origin;
  }

  if (origin) {
    console.warn(`CORS: origin "${origin}" is not in ALLOWED_ORIGINS and was rejected.`);
  }
  // Do not echo back a disallowed origin. Returning the first configured
  // origin keeps the response well-formed without granting access to an
  // origin that isn't on the list — the browser enforces the mismatch.
  return allowlist[0] ?? "null";
}

export function corsHeadersFor(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveAllowOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
