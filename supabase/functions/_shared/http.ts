// Shared request helpers for the edge functions.

export const SITE = "https://surgitrack-med.netlify.app";

// The app itself: production, its deploy previews, and local development. Browsers get CORS access
// from these origins only, and emailed links may point only at them.
export const APP_ORIGIN = /^(https:\/\/([a-z0-9-]+--)?surgitrack-med\.netlify\.app|http:\/\/localhost:\d+)$/;

/**
 * CORS headers for one request: the caller's origin when it is the app, otherwise the production
 * site (so any other website's browser is refused). Extra origins, such as a custom domain, go in
 * the ALLOWED_ORIGINS secret (comma separated). Non-browser callers do not use CORS and are unaffected.
 */
export const corsFor = (req: Request, base: Record<string, string>) => {
  const origin = (req.headers.get("Origin") || "").replace(/\/$/, "");
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);
  const allowed = APP_ORIGIN.test(origin) || extra.includes(origin);
  return {...base, "Access-Control-Allow-Origin": allowed ? origin : SITE, "Vary": "Origin"};
};

export const jsonWith = (cors: Record<string, string>) => (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json"}});

/**
 * The caller's IP for rate limiting. Edge Functions sit behind Cloudflare, which sets
 * cf-connecting-ip itself; the first x-forwarded-for entry is whatever the client sent, so it is not
 * trusted. Falls back to the last (proxy-added) x-forwarded-for entry.
 */
export const clientIp = (req: Request) => {
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  if (cf) return cf;
  const forwarded = (req.headers.get("x-forwarded-for") || "").split(",").map(s => s.trim()).filter(Boolean);
  return forwarded[forwarded.length - 1] || "unknown";
};
