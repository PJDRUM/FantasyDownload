// api/headshot/[id].js
// Simple toggle:
// - true  => in local `vercel dev`, return placeholder (no ESPN requests)
// - false => in local `vercel dev`, fetch from ESPN like production
const USE_PLACEHOLDER_IN_LOCAL_DEV = true;

const PLACEHOLDER_PATH = "public/headshot-placeholder.svg";
const PLACEHOLDER_CONTENT_TYPE = "image/svg+xml";
const PLACEHOLDER_SRC_URL = "/headshot-placeholder.svg";

async function servePlaceholder(res, cacheControl = "no-store") {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const p = path.join(process.cwd(), PLACEHOLDER_PATH);
    const buf = fs.readFileSync(p);

    res.statusCode = 200;
    res.setHeader("Content-Type", PLACEHOLDER_CONTENT_TYPE);
    res.setHeader("Cache-Control", cacheControl);
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const { id } = req.query || {};
  const safeId = String(id || "").replace(/[^0-9]/g, "");
  if (!safeId) {
    // Let the UI fallback handle missing ids; keep this a real error.
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing or invalid id" }));
    return;
  }

  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  const isLocalDev = !isProd;

  if (isLocalDev && USE_PLACEHOLDER_IN_LOCAL_DEV) {
    const ok = await servePlaceholder(res, "no-store");
    if (ok) return;
    // If placeholder isn't available for some reason, fall through to fetching.
  }

  const upstreamUrl = `https://a.espncdn.com/i/headshots/nfl/players/full/${safeId}.png`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!upstream.ok) {
      // For missing/broken headshots, serve placeholder instead of a broken image.
      const ok = await servePlaceholder(res, "public, max-age=60, s-maxage=3600");
      if (ok) return;

      res.statusCode = upstream.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Upstream fetch failed", status: upstream.status }));
      return;
    }

    const arrayBuf = await upstream.arrayBuffer();
    const body = Buffer.from(arrayBuf);

    res.statusCode = 200;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/png");

    // Cache at the edge/CDN for 30 days, allow stale for 7 more days while revalidating.
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800"
    );

    res.end(body);
  } catch (err) {
    // Network/timeout/etc: serve placeholder so the UI never shows a broken image.
    const ok = await servePlaceholder(res, "public, max-age=60, s-maxage=600");
    if (ok) return;

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Unexpected error", details: String(err) }));
  }
}
