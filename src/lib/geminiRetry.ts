// Shared retry wrapper for calls to the Gemini API.
//
// On the free tier (15 RPM shared across every user of this app, per
// Google Cloud project — not per API key), 5-8 people logging meals around
// the same couple of minutes can genuinely brush against the per-minute
// cap even though the daily 500 RPD has plenty of headroom left. A single
// 429 there shouldn't just fail the request outright — a short wait almost
// always clears it (RPM is a rolling window, it resets within seconds).
//
// This only retries 429 (rate limited) and 503 (transient server-side
// overload) — anything else (400 bad request, 404 bad model name, etc.)
// fails immediately since retrying won't fix it.

// Single source of truth for which Gemini model every route in this app
// calls. Every route previously duplicated `process.env.GEMINI_MODEL ||
// "gemini-3.1-flash-lite"` — an inconsistent, easy-to-forget-to-update
// fallback that doesn't match GEMINI_MODEL in .env.local (gemini-3.5-flash-lite).
// If that env var was ever undefined at runtime (e.g. a hosting platform
// didn't have it set, or a dev server that was started before it was added
// to .env.local — Next.js only reads .env.local at process start, so
// editing it requires restarting `next dev` to take effect), requests would
// silently fall back to a different, more expensive model instead of the
// intended free-tier Flash-Lite. Centralizing it here means there's exactly
// one place to change the model, and the fallback always matches the
// intended cheap default even if the env var isn't picked up.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export async function fetchGeminiWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 1
): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, init);
    if (res.ok || attempt >= maxRetries || (res.status !== 429 && res.status !== 503)) {
      return res;
    }

    // Respect a Retry-After header if Google sent one; otherwise back off a
    // little longer each attempt. Capped low (this is a request-response
    // API route, not a background job) so a user isn't left waiting long.
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
    const delayMs = Number.isFinite(retryAfterMs) ? Math.min(retryAfterMs, 4000) : 1200 * (attempt + 1);

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    attempt++;
  }
}
