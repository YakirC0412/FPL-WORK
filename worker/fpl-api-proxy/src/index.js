const FPL_API = "https://fantasy.premierleague.com/api";

const ALLOWED_PATHS = [
  /^\/bootstrap-static\/$/,
  /^\/fixtures\/$/,
  /^\/event\/\d+\/live\/$/,
  /^\/leagues-classic\/\d+\/standings\/$/,
  /^\/entry\/\d+\/event\/\d+\/picks\/$/,
  /^\/entry\/\d+\/transfers\/$/
];

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean));
}

function isAllowedOrigin(origin, env) {
  if (!origin) return true;
  if (allowedOrigins(env).has(origin)) return true;
  try {
    const url = new URL(origin);
    return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && ["4173", "4174", "8787"].includes(url.port);
  } catch {
    return false;
  }
}

function corsHeaders(origin, env) {
  const allowOrigin = origin && isAllowedOrigin(origin, env) ? origin : "https://yakirc0412.github.io";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(payload, status, origin, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin, env) }
  });
}

function cacheSeconds(pathname) {
  if (pathname === "/bootstrap-static/") return 300;
  if (pathname.includes("/standings/")) return 60;
  return 180;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (!isAllowedOrigin(origin, env)) return jsonResponse({ error: "Origin is not allowed." }, 403, origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    if (request.method !== "GET") return jsonResponse({ error: "Only GET requests are supported." }, 405, origin, env);

    const incoming = new URL(request.url);
    const path = incoming.searchParams.get("path") || "";
    let parsedPath;
    let target;
    try {
      if (!path.startsWith("/") || path.includes("://")) throw new Error("Invalid path");
      parsedPath = new URL(path, "https://fpl-proxy.invalid");
      target = new URL(`${FPL_API}${parsedPath.pathname}${parsedPath.search}`);
    } catch {
      return jsonResponse({ error: "Invalid FPL path." }, 400, origin, env);
    }
    if (!ALLOWED_PATHS.some(pattern => pattern.test(parsedPath.pathname))) {
      return jsonResponse({ error: "This FPL endpoint is not allowed." }, 400, origin, env);
    }

    try {
      const upstream = await fetch(target.toString(), {
        headers: { Accept: "application/json", "User-Agent": "FPL-Graphics-Studio/2.0" },
        cf: { cacheEverything: true, cacheTtl: cacheSeconds(target.pathname) }
      });
      const body = await upstream.arrayBuffer();
      return new Response(body, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
          "Cache-Control": `public, max-age=${cacheSeconds(target.pathname)}`,
          ...corsHeaders(origin, env)
        }
      });
    } catch {
      return jsonResponse({ error: "Fantasy Premier League is temporarily unavailable." }, 502, origin, env);
    }
  }
};
