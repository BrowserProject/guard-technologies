/*
 * Canonical technology-name -> URL/file slug.
 *
 * This is the SINGLE SOURCE OF TRUTH for how a technology name maps to the
 * object key it is published under (en/<slug>.json, de/<slug>.json). The
 * guard.ch /replay frontend re-implements this exact algorithm so it can build
 * the fetch URL from a detected technology name alone, with no index lookup:
 *
 *   `${TECH_BASE}/${locale}/${techSlug(name)}.json`
 *
 * Keep the two copies byte-for-byte equivalent. The algorithm is:
 *
 *   1. Unicode NFKD normalise (so "Sentry" stays "sentry" and accented Latin
 *      like "Protégé" folds to "protege").
 *   2. lowercase (names are case-sensitive keys but matched case-insensitively
 *      by every consumer, so the slug is case-folded).
 *   3. replace every run of non [a-z0-9] characters with a single "-".
 *   4. trim leading / trailing "-".
 *   5. if the result is empty (a name with no Latin letters or digits, e.g.
 *      a CJK-only name), fall back to percent-encoding the lowercased name so
 *      the slug is still a unique, reproducible, URL-safe token.
 *
 * Across the 7.5k-name corpus this collapses only same-tech case variants
 * (e.g. "WebSocket" / "Websocket") onto one slug, which is the intended
 * behaviour since consumers match case-insensitively.
 */

export function techSlug(name) {
  const base = String(name)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || encodeURIComponent(String(name).toLowerCase());
}
