import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.PORT || 4174);
const FPL_API = "https://fantasy.premierleague.com/api";
const ALLOWED_PATHS = [
  /^\/bootstrap-static\/$/,
  /^\/fixtures\/$/,
  /^\/event\/\d+\/live\/$/,
  /^\/leagues-classic\/\d+\/standings\/$/,
  /^\/entry\/\d+\/event\/\d+\/picks\/$/,
  /^\/entry\/\d+\/transfers\/$/
];
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function proxyFpl(requestUrl, response) {
  const apiPath = requestUrl.searchParams.get("path") || "";
  let parsedPath;
  let target;
  try {
    if (!apiPath.startsWith("/") || apiPath.includes("://")) throw new Error("Invalid path");
    parsedPath = new URL(apiPath, "https://fpl-proxy.invalid");
    target = new URL(`${FPL_API}${parsedPath.pathname}${parsedPath.search}`);
  } catch {
    sendJson(response, 400, { error: "Invalid FPL path." });
    return;
  }
  if (!ALLOWED_PATHS.some(pattern => pattern.test(parsedPath.pathname))) {
    sendJson(response, 400, { error: "This FPL endpoint is not allowed." });
    return;
  }
  try {
    const upstream = await fetch(target, { headers: { Accept: "application/json", "User-Agent": "FPL-Graphics-Studio-Local/2.0" } });
    const body = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch (error) {
    sendJson(response, 502, { error: `FPL request failed: ${error.message}` });
  }
}

async function serveFile(requestUrl, response) {
  const decoded = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
  const absolute = path.resolve(ROOT, `.${decoded}`);
  if (absolute !== ROOT && !absolute.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const stat = await fs.stat(absolute);
    const file = stat.isDirectory() ? path.join(absolute, "index.html") : absolute;
    const body = await fs.readFile(file);
    response.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || `localhost:${PORT}`}`);
  if (requestUrl.pathname === "/api/fpl") return proxyFpl(requestUrl, response);
  return serveFile(requestUrl, response);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`FPL Graphics Studio: http://localhost:${PORT}/app/gameweek-data-v2.html`);
});
