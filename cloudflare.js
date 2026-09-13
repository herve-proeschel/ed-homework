const MAX_BODY_BYTES = 64 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;
const LOGIN_LIMIT = { limit: 5, windowMs: 60_000 };
const TWO_FA_LIMIT = { limit: 5, windowMs: 10 * 60_000 };
const memoryBuckets = new Map();
const DEPLOYED_ALLOWED_ORIGINS = "__ALLOWED_ORIGINS__";

function allowedOrigins() {
  return DEPLOYED_ALLOWED_ORIGINS
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Token, 2fa-token, x-gtk, x-cookies",
    "Access-Control-Expose-Headers": "X-Token, x-token, 2fa-token, x-all-cookies, x-gtk",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(body, status, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin), ...extraHeaders },
  });
}

function isAllowedQuery(url, allowedKeys) {
  return [...url.searchParams.keys()].every((key) => allowedKeys.includes(key));
}

function routeInfo(request, url) {
  const path = url.pathname.replace(/^\/+/, "/");
  const method = request.method;

  if (path === "/v3/login.awp" && method === "GET" && url.searchParams.get("gtk") === "1"
    && isAllowedQuery(url, ["gtk", "v"])) return { kind: "gtk" };
  if (path === "/v3/login.awp" && method === "POST" && isAllowedQuery(url, ["v"])) {
    return { kind: "login" };
  }
  if (path === "/v3/connexion/doubleauth.awp" && method === "POST"
    && ["get", "post"].includes(url.searchParams.get("verbe"))
    && isAllowedQuery(url, ["verbe", "v"])) {
    return { kind: url.searchParams.get("verbe") === "post" ? "twofa" : "qcm" };
  }
  if (method === "POST" && /^\/v3\/Eleves\/\d+\/cahierdetexte\.awp$/.test(path)
    && url.searchParams.get("verbe") === "get" && isAllowedQuery(url, ["verbe", "v"])) {
    return { kind: "homework" };
  }
  if (method === "POST" && /^\/v3\/Eleves\/\d+\/cahierdetexte\/\d{4}-\d{2}-\d{2}\.awp$/.test(path)
    && url.searchParams.get("verbe") === "get" && isAllowedQuery(url, ["verbe", "v"])) {
    return { kind: "homework" };
  }
  return null;
}

async function isRateLimited(env, request, kind) {
  const policy = kind === "twofa" ? TWO_FA_LIMIT : LOGIN_LIMIT;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `${ip}:${kind}`;
  const binding = kind === "twofa" ? env.TWO_FA_RATE_LIMITER : env.LOGIN_RATE_LIMITER;

  if (binding && typeof binding.limit === "function") {
    const result = await binding.limit({ key });
    return result.success === false;
  }

  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || now - current.startedAt >= policy.windowMs) {
    memoryBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > policy.limit;
}

function buildUpstreamHeaders(request) {
  const headers = new Headers({
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: "https://www.ecoledirecte.com",
    Referer: "https://www.ecoledirecte.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
  });
  for (const name of ["x-token", "x-gtk", "2fa-token"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let cookieHeader = request.headers.get("x-cookies") || "";
  const gtkValue = request.headers.get("x-gtk");
  if (gtkValue && !/(^|;\s*)GTK=/i.test(cookieHeader)) {
    cookieHeader = `${cookieHeader ? `${cookieHeader}; ` : ""}GTK=${gtkValue}`;
  }
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  return headers;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const originIsAllowed = origin && allowedOrigins().includes(origin);
    if (!originIsAllowed) return jsonResponse({ error: "Origin not allowed" }, 403, origin || "null");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const route = routeInfo(request, url);
    if (!route) return jsonResponse({ error: "Route not allowed" }, 404, origin);

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_BODY_BYTES) return jsonResponse({ error: "Request body too large" }, 413, origin);
    if (["login", "twofa"].includes(route.kind) && await isRateLimited(env, request, route.kind)) {
      return jsonResponse({ error: "Too many authentication attempts" }, 429, origin, { "Retry-After": route.kind === "twofa" ? "600" : "60" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const body = request.method === "POST" ? await request.arrayBuffer() : null;
      if (body && body.byteLength > MAX_BODY_BYTES) return jsonResponse({ error: "Request body too large" }, 413, origin);
      const response = await fetch(`https://api.ecoledirecte.com${url.pathname}${url.search}`, {
        method: request.method,
        headers: buildUpstreamHeaders(request),
        body,
        signal: controller.signal,
      });

      const responseHeaders = new Headers(corsHeaders(origin));
      const returnedToken = response.headers.get("x-token");
      const returnedTwoFaToken = response.headers.get("2fa-token") || response.headers.get("x-2fa-token");
      if (returnedToken) responseHeaders.set("x-token", returnedToken);
      if (returnedTwoFaToken) responseHeaders.set("2fa-token", returnedTwoFaToken);

      const cookies = typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")] : []);
      if (cookies.length) responseHeaders.set("x-all-cookies", cookies.map((cookie) => cookie.split(";")[0]).join("; "));

      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
    } catch (error) {
      const status = error.name === "AbortError" ? 504 : 502;
      return jsonResponse({ error: status === 504 ? "Upstream timeout" : "Upstream unavailable" }, status, origin);
    } finally {
      clearTimeout(timeout);
    }
  },
};