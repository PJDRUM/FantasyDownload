export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}

export function getRequestOrigin(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

export function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function collectObjects(value, predicate, results = []) {
  if (!value) return results;

  if (Array.isArray(value)) {
    value.forEach((item) => collectObjects(item, predicate, results));
    return results;
  }

  if (typeof value !== "object") return results;

  if (predicate(value)) results.push(value);
  Object.values(value).forEach((child) => collectObjects(child, predicate, results));
  return results;
}

export function findFirstScalar(value, predicate) {
  if (value == null) return undefined;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstScalar(item, predicate);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (predicate(key, child)) {
        if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
          return child;
        }
      }

      const found = findFirstScalar(child, predicate);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  return String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eq = part.indexOf("=");
      if (eq < 0) return acc;
      const key = decodeURIComponent(part.slice(0, eq));
      const value = decodeURIComponent(part.slice(eq + 1));
      acc[key] = value;
      return acc;
    }, {});
}
