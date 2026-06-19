// worker/lib/cors.js
//
// CORS for the KBO TIDO push backend.
//
// Principles (see docs/BACKEND_PUSH_PLAN.md §2.5, §4):
//   - Allowlist the GitHub Pages origin ONLY. No wildcard "*".
//   - Reflect the request Origin only when it is in the allowlist; otherwise
//     emit no Access-Control-Allow-Origin header (browser blocks the read).
//   - Handle OPTIONS preflight explicitly.
//   - Never echo arbitrary origins. endpoint is a bearer secret, so we keep the
//     attack surface tight and credentials off (no cookies / no Authorization).
//
// Pure, I/O-free helpers so they can be unit tested under node --test.
//
// ALLOWED_ORIGIN is read from env (wrangler vars). It may be a single origin or
// a comma-separated list of exact origins (e.g. a custom domain + the
// github.io origin). Each entry must be an exact scheme://host[:port] string.

const ALLOWED_METHODS = "GET, POST, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type";
const MAX_AGE_SECONDS = 86400; // cache preflight 24h

/**
 * Parse the ALLOWED_ORIGIN env var into a normalized Set of exact origins.
 * Wildcards are explicitly rejected (an entry of "*" is dropped).
 * @param {string|undefined|null} raw
 * @returns {Set<string>}
 */
export function parseAllowedOrigins(raw) {
  const set = new Set();
  if (!raw || typeof raw !== "string") return set;
  for (const part of raw.split(",")) {
    const origin = part.trim();
    if (!origin) continue;
    if (origin === "*") continue; // wildcard forbidden
    // Reject anything that does not look like a bare origin (no path/query).
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      continue;
    }
    // URL().origin strips any trailing path/slash and lowercases host.
    if (parsed.origin && parsed.origin !== "null") {
      set.add(parsed.origin);
    }
  }
  return set;
}

/**
 * Decide whether a request Origin is allowed.
 * @param {string|null|undefined} origin - the raw Origin request header
 * @param {Set<string>} allowed - from parseAllowedOrigins
 * @returns {boolean}
 */
export function isOriginAllowed(origin, allowed) {
  if (!origin || typeof origin !== "string") return false;
  if (!(allowed instanceof Set) || allowed.size === 0) return false;
  let normalized;
  try {
    normalized = new URL(origin).origin;
  } catch {
    return false;
  }
  return allowed.has(normalized);
}

/**
 * Build the CORS headers for a given request origin.
 * Returns an object of header name -> value. When the origin is NOT allowed,
 * the Access-Control-Allow-Origin header is omitted entirely (no wildcard).
 * @param {string|null|undefined} origin
 * @param {Set<string>} allowed
 * @returns {Record<string,string>}
 */
export function corsHeaders(origin, allowed) {
  const headers = {
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": String(MAX_AGE_SECONDS),
    // Caches/proxies must vary on Origin since the ACAO value depends on it.
    Vary: "Origin",
  };
  if (isOriginAllowed(origin, allowed)) {
    headers["Access-Control-Allow-Origin"] = new URL(origin).origin;
  }
  return headers;
}

/**
 * Handle an OPTIONS preflight request. Returns a 204 Response when the origin
 * is allowed, otherwise a 403 (no ACAO header -> browser blocks anyway).
 * @param {Request} request
 * @param {string|undefined} allowedOriginEnv - env.ALLOWED_ORIGIN raw string
 * @returns {Response}
 */
export function handlePreflight(request, allowedOriginEnv) {
  const allowed = parseAllowedOrigins(allowedOriginEnv);
  const origin = request.headers.get("Origin");
  const headers = corsHeaders(origin, allowed);
  const status = isOriginAllowed(origin, allowed) ? 204 : 403;
  return new Response(null, { status, headers });
}

/**
 * Merge CORS headers onto an existing Response for an actual (non-preflight)
 * request. Clones the response with the added headers.
 * @param {Response} response
 * @param {Request} request
 * @param {string|undefined} allowedOriginEnv
 * @returns {Response}
 */
export function withCors(response, request, allowedOriginEnv) {
  const allowed = parseAllowedOrigins(allowedOriginEnv);
  const origin = request.headers.get("Origin");
  const merged = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin, allowed))) {
    merged.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}
