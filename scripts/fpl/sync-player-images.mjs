import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const API_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const FPL_HOME = "https://fantasy.premierleague.com/";
const config = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "config/fpl.json"), "utf8"));
const imageDirectory = path.resolve(PROJECT_ROOT, config.playerImageDirectory || "assets/fpl-players");
const manifestDirectory = path.resolve(PROJECT_ROOT, config.playerManifestDirectory || "data/players");
const manifestFile = path.join(manifestDirectory, "manifest.json");
const manifestFallbackFile = path.join(manifestDirectory, "manifest.js");
const forceRefresh = process.env.FORCE_REFRESH === "1" || process.argv.includes("--refresh");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, attempt = 1) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: options.headers?.Accept || "*/*",
      "User-Agent": "FPL-Champions-League-Studio/1.0",
      ...options.headers
    }
  });
  if (response.ok || response.status === 304) return response;
  if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
    await sleep(600 * 2 ** (attempt - 1));
    return fetchWithRetry(url, options, attempt + 1);
  }
  throw new Error(`Request failed (${response.status}) for ${url}`);
}

async function readPreviousManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestFile, "utf8"));
  } catch {
    return { players: [] };
  }
}

async function discoverImageBase(previousManifest) {
  try {
    const home = await (await fetchWithRetry(FPL_HOME, { headers: { Accept: "text/html" } })).text();
    const assetPath = home.match(/<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i)?.[1];
    if (!assetPath) throw new Error("FPL application bundle was not found.");
    const bundleUrl = new URL(assetPath, FPL_HOME).href;
    const bundle = await (await fetchWithRetry(bundleUrl, { headers: { Accept: "text/javascript" } })).text();
    const base = bundle.match(/https:\/\/resources\.premierleague\.com\/[^`"']+\/photos\/players\/110x140/)?.[0];
    if (!base) throw new Error("Player image base URL was not found in the FPL bundle.");
    return base;
  } catch (error) {
    const fallback = config.playerImageBaseUrl || previousManifest?.source?.imageBaseUrl;
    if (fallback) {
      console.warn(`${error.message} Using the configured image base URL.`);
      return fallback.replace(/\/$/, "");
    }
    throw error;
  }
}

function aliasesFor(player) {
  const fullName = `${player.first_name || ""} ${player.second_name || ""}`.trim();
  const initialName = `${String(player.first_name || "").charAt(0)} ${player.second_name || ""}`.trim();
  const dottedInitialName = `${String(player.first_name || "").charAt(0)}.${player.second_name || ""}`.trim();
  return [...new Set([player.web_name, fullName, player.first_name, player.second_name, initialName, dottedInitialName].filter(Boolean))];
}

function isPng(bytes) {
  return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

async function fileExists(filename) {
  try {
    return (await fs.stat(filename)).size > 8;
  } catch {
    return false;
  }
}

async function mapLimited(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

const previousManifest = await readPreviousManifest();
const previousByCode = new Map((previousManifest.players || []).map(player => [String(player.code), player]));
const bootstrap = await (await fetchWithRetry(API_URL, { headers: { Accept: "application/json" } })).json();
const imageBaseUrl = await discoverImageBase(previousManifest);
const teams = new Map((bootstrap.teams || []).map(team => [Number(team.id), team]));

await Promise.all([
  fs.mkdir(imageDirectory, { recursive: true }),
  fs.mkdir(manifestDirectory, { recursive: true })
]);

const jobs = new Map();
jobs.set("placeholder.png", { filename: "placeholder.png", remoteName: "placeholder", remoteUrl: `${imageBaseUrl}/placeholder.png` });
for (const player of bootstrap.elements || []) {
  const remoteName = player.has_temporary_code ? "placeholder" : String(player.code);
  const filename = `${remoteName}.png`;
  if (!jobs.has(filename)) jobs.set(filename, { filename, remoteName, remoteUrl: `${imageBaseUrl}/${remoteName}.png` });
}

let downloaded = 0;
let unchanged = 0;
const etagsByFilename = new Map();
const unavailableFilenames = new Set();
await mapLimited([...jobs.values()], Number(config.playerImageConcurrency || 8), async job => {
  const target = path.join(imageDirectory, job.filename);
  const previous = [...previousByCode.values()].find(player => player.image?.endsWith(`/${job.filename}`));
  const exists = await fileExists(target);
  const headers = {};
  if (!forceRefresh && exists && previous?.etag) headers["If-None-Match"] = previous.etag;
  if (!forceRefresh && exists && !previous?.etag) {
    unchanged += 1;
    return;
  }
  let response;
  try {
    response = await fetchWithRetry(job.remoteUrl, { headers });
  } catch (error) {
    if (job.remoteName !== "placeholder") {
      unavailableFilenames.add(job.filename);
      console.warn(`Player image unavailable; using the official placeholder: ${job.remoteName}`);
      return;
    }
    throw error;
  }
  if (response.status === 304) {
    unchanged += 1;
    etagsByFilename.set(job.filename, previous?.etag || "");
    return;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isPng(bytes)) throw new Error(`Player image is not a valid PNG: ${job.remoteUrl}`);
  await fs.writeFile(target, bytes);
  etagsByFilename.set(job.filename, response.headers.get("etag") || "");
  downloaded += 1;
});

const players = (bootstrap.elements || []).map(player => {
  const team = teams.get(Number(player.team));
  const remoteName = player.has_temporary_code ? "placeholder" : String(player.code);
  const filename = `${remoteName}.png`;
  const previous = previousByCode.get(String(player.code));
  const availableFilename = unavailableFilenames.has(filename) ? "placeholder.png" : filename;
  return {
    id: Number(player.id),
    code: Number(player.code),
    firstName: player.first_name || "",
    secondName: player.second_name || "",
    fullName: `${player.first_name || ""} ${player.second_name || ""}`.trim(),
    webName: player.web_name || "",
    aliases: aliasesFor(player),
    teamId: Number(player.team),
    teamName: team?.name || "",
    teamShortName: team?.short_name || "",
    temporaryCode: Boolean(player.has_temporary_code),
    image: `assets/fpl-players/${availableFilename}`,
    imageAvailable: availableFilename !== "placeholder.png",
    etag: etagsByFilename.get(filename) || previous?.etag || ""
  };
}).sort((a, b) => a.webName.localeCompare(b.webName));

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    provider: "Fantasy Premier League public API and official player image CDN",
    apiUrl: API_URL,
    imageBaseUrl
  },
  count: players.length,
  players
};

await Promise.all([
  fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`),
  fs.writeFile(manifestFallbackFile, `window.FPL_PLAYER_MEDIA = ${JSON.stringify(manifest, null, 2)};\n`)
]);

console.log(`Player media synchronized: ${players.length} players, ${downloaded} downloaded, ${unchanged} unchanged.`);
console.log(`Image base: ${imageBaseUrl}`);
console.log(`Manifest: ${path.relative(PROJECT_ROOT, manifestFile)}`);
