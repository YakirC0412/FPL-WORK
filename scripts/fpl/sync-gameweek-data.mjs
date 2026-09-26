import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const API_BASE = "https://fantasy.premierleague.com/api";
const FORMATIONS = [
  { name: "3-4-3", DEF: 3, MID: 4, FWD: 3 },
  { name: "3-5-2", DEF: 3, MID: 5, FWD: 2 },
  { name: "4-3-3", DEF: 4, MID: 3, FWD: 3 },
  { name: "4-4-2", DEF: 4, MID: 4, FWD: 2 },
  { name: "4-5-1", DEF: 4, MID: 5, FWD: 1 },
  { name: "5-3-2", DEF: 5, MID: 3, FWD: 2 }
];
const POSITION_BY_TYPE = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
const CHIP_LABELS = [
  ["wildcard", "Wildcard"],
  ["freehit", "Free Hit"],
  ["3xc", "Triple Captain"],
  ["bboost", "Bench Boost"]
];

const config = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "config/fpl.json"), "utf8"));
const requestedGameweek = Number(process.env.GAMEWEEK || argumentValue("--gameweek") || 0);
const allowPendingStatus = process.env.ALLOW_PENDING_STATUS === "1";
const outputDirectory = path.resolve(PROJECT_ROOT, config.outputDirectory || "data/gameweeks");
const statusFile = path.join(outputDirectory, "status.json");
const statusFallbackFile = path.join(outputDirectory, "status.js");

function argumentValue(name) {
  const direct = process.argv.find(value => value.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(endpoint, attempt = 1) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "FPL-Champions-League-Studio/1.0"
    }
  });
  if (response.ok) return response.json();
  if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
    await sleep(500 * 2 ** (attempt - 1));
    return fetchJson(endpoint, attempt + 1);
  }
  throw new Error(`FPL request failed (${response.status}) for ${url}`);
}

async function mapLimited(items, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(config.requestConcurrency || 6, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
      if (config.requestDelayMs) await sleep(config.requestDelayMs);
    }
  });
  await Promise.all(workers);
  return results;
}

async function readLeague(leagueId) {
  const entries = [];
  let league = null;
  let page = 1;
  while (true) {
    const payload = await fetchJson(`/leagues-classic/${leagueId}/standings/?page_standings=${page}`);
    league ||= payload.league;
    entries.push(...(payload.standings?.results || []));
    if (!payload.standings?.has_next) break;
    page += 1;
  }
  if (!entries.length) throw new Error(`League ${leagueId} did not return any entries.`);
  return { league, entries };
}

function increment(map, key, amount = 1) {
  map.set(Number(key), (map.get(Number(key)) || 0) + amount);
}

function percentage(value, total) {
  return Number(((value / Math.max(1, total)) * 100).toFixed(1));
}

async function writeSyncStatus(event, ready) {
  const status = {
    leagueId: Number(config.leagueId),
    gameweek: Number(event.id),
    ready: Boolean(ready),
    deadlinePassed: new Date(event.deadline_time).getTime() <= Date.now(),
    message: ready
      ? `Gameweek ${event.id} post-deadline data is ready.`
      : `Gameweek ${event.id} data is not available until its deadline (${event.deadline_time}).`
  };
  await fs.mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(statusFile, `${JSON.stringify(status, null, 2)}\n`),
    fs.writeFile(statusFallbackFile, `window.FPL_GAMEWEEK_STATUS = ${JSON.stringify(status, null, 2)};\n`)
  ]);
  return status;
}

function rankedPlayers(ids, metadata, primaryCounts, secondaryCounts = new Map()) {
  return [...ids]
    .map(id => ({
      id: Number(id),
      meta: metadata.get(Number(id)),
      primary: primaryCounts.get(Number(id)) || 0,
      secondary: secondaryCounts.get(Number(id)) || 0
    }))
    .filter(item => item.meta)
    .sort((a, b) => b.primary - a.primary || b.secondary - a.secondary || a.meta.web_name.localeCompare(b.meta.web_name));
}

function chooseLeagueXi(metadata, ownership, starters, participants) {
  const byPosition = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const player of metadata.values()) {
    const position = POSITION_BY_TYPE[player.element_type];
    if (!position) continue;
    byPosition[position].push({
      id: player.id,
      code: player.code,
      name: player.web_name,
      position,
      owners: ownership.get(player.id) || 0,
      started: starters.get(player.id) || 0
    });
  }
  Object.values(byPosition).forEach(players => players.sort((a, b) => b.started - a.started || b.owners - a.owners || a.name.localeCompare(b.name)));

  const formation = FORMATIONS
    .map(candidate => ({
      ...candidate,
      score: byPosition.GK.slice(0, 1).reduce((sum, player) => sum + player.started * 1000 + player.owners, 0)
        + byPosition.DEF.slice(0, candidate.DEF).reduce((sum, player) => sum + player.started * 1000 + player.owners, 0)
        + byPosition.MID.slice(0, candidate.MID).reduce((sum, player) => sum + player.started * 1000 + player.owners, 0)
        + byPosition.FWD.slice(0, candidate.FWD).reduce((sum, player) => sum + player.started * 1000 + player.owners, 0)
    }))
    .sort((a, b) => b.score - a.score)[0];

  const selected = [
    ...byPosition.GK.slice(0, 1),
    ...byPosition.DEF.slice(0, formation.DEF),
    ...byPosition.MID.slice(0, formation.MID),
    ...byPosition.FWD.slice(0, formation.FWD)
  ];
  return {
    formation: formation.name,
    players: selected.map(player => ({
      id: player.id,
      code: player.code,
      position: player.position,
      name: player.name,
      own: percentage(player.owners, participants),
      started: player.started,
      owners: player.owners
    }))
  };
}

function playerName(metadata, id) {
  return metadata.get(Number(id))?.web_name || `Player ${id}`;
}

const bootstrap = await fetchJson("/bootstrap-static/");
const event = requestedGameweek
  ? bootstrap.events.find(item => item.id === requestedGameweek)
  : bootstrap.events.find(item => item.is_current) || bootstrap.events.find(item => item.is_next);
if (!event) throw new Error("Could not identify the requested gameweek.");
if (new Date(event.deadline_time).getTime() > Date.now()) {
  if (allowPendingStatus) {
    const status = await writeSyncStatus(event, false);
    console.log(status.message);
    process.exit(0);
  }
  throw new Error(`Gameweek ${event.id} picks are private until the deadline (${event.deadline_time}).`);
}
if (!requestedGameweek && allowPendingStatus) {
  try {
    const previousStatus = JSON.parse(await fs.readFile(statusFile, "utf8"));
    if (previousStatus.ready && Number(previousStatus.gameweek) === Number(event.id)) {
      console.log(`Gameweek ${event.id} data is already synchronized.`);
      process.exit(0);
    }
  } catch {}
}

const metadata = new Map(bootstrap.elements.map(player => [player.id, player]));
const { league, entries } = await readLeague(config.leagueId);
console.log(`Reading GW${event.id} picks for ${entries.length} league entries...`);

const picksByEntry = await mapLimited(entries, async entry => ({
  entryId: entry.entry,
  payload: await fetchJson(`/entry/${entry.entry}/event/${event.id}/picks/`)
}));
console.log(`Reading GW${event.id} transfers...`);
const transfersByEntry = await mapLimited(entries, async entry => ({
  entryId: entry.entry,
  payload: await fetchJson(`/entry/${entry.entry}/transfers/`)
}));

const ownership = new Map();
const starters = new Map();
const effectiveOwnership = new Map();
const captainCounts = new Map();
const chipCounts = new Map();
const topTenOwnership = new Map();
const formationCounts = new Map();
const topTenEntryIds = new Set([...entries].sort((a,b) => Number(a.rank) - Number(b.rank)).slice(0,10).map(entry => Number(entry.entry)));
let hitManagers = 0;
let totalHitCost = 0;
for (const record of picksByEntry) {
  const seen = new Set();
  const formation = { DEF:0, MID:0, FWD:0 };
  for (const pick of record.payload.picks || []) {
    if (!seen.has(pick.element)) {
      increment(ownership, pick.element);
      if (topTenEntryIds.has(Number(record.entryId))) increment(topTenOwnership, pick.element);
      seen.add(pick.element);
    }
    if (Number(pick.position) <= 11) {
      increment(starters, pick.element);
      const position = POSITION_BY_TYPE[metadata.get(Number(pick.element))?.element_type];
      if (formation[position] !== undefined) formation[position] += 1;
    }
    increment(effectiveOwnership, pick.element, Number(pick.multiplier) || 0);
    if (pick.is_captain) increment(captainCounts, pick.element);
  }
  const formationKey = `${formation.DEF}-${formation.MID}-${formation.FWD}`;
  formationCounts.set(formationKey, (formationCounts.get(formationKey) || 0) + 1);
  const hitCost = Number(record.payload.entry_history?.event_transfers_cost) || 0;
  if (hitCost > 0) { hitManagers += 1; totalHitCost += hitCost; }
  if (record.payload.active_chip) chipCounts.set(record.payload.active_chip, (chipCounts.get(record.payload.active_chip) || 0) + 1);
}

const transfersIn = new Map();
const transfersOut = new Map();
let transferManagers = 0;
let totalTransfers = 0;
for (const record of transfersByEntry) {
  let managerTransfers = 0;
  for (const transfer of record.payload || []) {
    if (Number(transfer.event) !== Number(event.id)) continue;
    increment(transfersIn, transfer.element_in);
    increment(transfersOut, transfer.element_out);
    managerTransfers += 1;
  }
  if (managerTransfers) { transferManagers += 1; totalTransfers += managerTransfers; }
}

const xi = chooseLeagueXi(metadata, ownership, starters, entries.length);
const captainRanking = rankedPlayers(captainCounts.keys(), metadata, captainCounts);
const captainTop = captainRanking.slice(0, 4).map(item => ({ id: item.id, code: item.meta.code, name: item.meta.web_name, pct: percentage(item.primary, entries.length) }));
const captainOther = captainRanking.slice(4).reduce((sum, item) => sum + item.primary, 0);
const captainData = captainOther ? [...captainTop, { name: "Other", pct: percentage(captainOther, entries.length) }] : captainTop;

const transferInData = rankedPlayers(transfersIn.keys(), metadata, transfersIn, ownership).slice(0, 3).map(item => ({
  id: item.id,
  code: item.meta.code,
  name: item.meta.web_name,
  moved: item.primary,
  owners: ownership.get(item.id) || 0
}));
const transferOutData = rankedPlayers(transfersOut.keys(), metadata, transfersOut, ownership).slice(0, 3).map(item => ({
  id: item.id,
  code: item.meta.code,
  name: item.meta.web_name,
  moved: item.primary,
  owners: ownership.get(item.id) || 0
}));
const eoData = rankedPlayers(effectiveOwnership.keys(), metadata, effectiveOwnership, ownership).slice(0, 5).map(item => ({
  id: item.id,
  code: item.meta.code,
  name: item.meta.web_name,
  pct: percentage(item.primary, entries.length)
}));
const chipData = CHIP_LABELS.map(([key, name]) => ({ name, pct: percentage(chipCounts.get(key) || 0, entries.length) }));

const playerInsightRows = [...metadata.values()].map(player => {
  const owners = ownership.get(player.id) || 0;
  const started = starters.get(player.id) || 0;
  const topTenOwners = topTenOwnership.get(player.id) || 0;
  return {
    id: player.id,
    name: player.web_name,
    owners,
    started,
    benched: Math.max(0, owners - started),
    ownPct: percentage(owners, entries.length),
    topTenOwners,
    topTenPct: percentage(topTenOwners, Math.min(10, entries.length)),
    eliteGap: Number((percentage(topTenOwners, Math.min(10, entries.length)) - percentage(owners, entries.length)).toFixed(1))
  };
});
const differential = playerInsightRows.filter(player => player.owners > 0 && player.ownPct < 10)
  .sort((a,b) => b.started - a.started || b.owners - a.owners || a.name.localeCompare(b.name))[0];
const eliteFavourite = [...playerInsightRows].sort((a,b) => b.topTenOwners - a.topTenOwners || b.owners - a.owners || a.name.localeCompare(b.name))[0];
const benchRisk = playerInsightRows.filter(player => player.ownPct > 30 && player.benched > 0)
  .sort((a,b) => b.benched - a.benched || b.ownPct - a.ownPct || a.name.localeCompare(b.name))[0];
const eliteBias = playerInsightRows.filter(player => player.topTenOwners > 0 && player.eliteGap > 0)
  .sort((a,b) => b.eliteGap - a.eliteGap || b.topTenOwners - a.topTenOwners || a.name.localeCompare(b.name))[0];
const templateCore = playerInsightRows.filter(player => player.ownPct >= 50).length;
const favouriteFormation = [...formationCounts.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
const aiInsights = [];
if (differential) aiInsights.push({ type:"differential", title:"DIFFERENTIAL RADAR", subject:differential.name, value:differential.started, metricLabel:"STARTS", detail:`${differential.ownPct}% owned · ${differential.owners} managers own him`, color:"#5cc8ff" });
aiInsights.push({ type:"hits", title:"HIT PARADE", subject:"League transfer cost", value:hitManagers, metricLabel:"MANAGERS", detail:`${totalHitCost} points spent on hits before the deadline`, color:"#ff7185" });
if (eliteFavourite) aiInsights.push({ type:"elite-favourite", title:"TOP 10 FAVOURITE", subject:eliteFavourite.name, value:eliteFavourite.topTenOwners, metricLabel:"OF TOP 10", detail:`${eliteFavourite.ownPct}% ownership across the full league`, color:"#caa84b" });
if (benchRisk) aiInsights.push({ type:"bench-risk", title:"BENCH RISK", subject:benchRisk.name, value:benchRisk.benched, metricLabel:"BENCHED", detail:`${benchRisk.started} started out of ${benchRisk.owners} owners`, color:"#ff9f45" });
if (eliteBias) aiInsights.push({ type:"elite-bias", title:"ELITE BIAS", subject:eliteBias.name, value:eliteBias.eliteGap, metricLabel:"PP GAP", detail:`${eliteBias.topTenPct}% owned in the top 10 vs ${eliteBias.ownPct}% league-wide`, color:"#9b7cff" });
aiInsights.push({ type:"template-core", title:"TEMPLATE CORE", subject:"Highly owned players", value:templateCore, metricLabel:"PLAYERS", detail:"Owned by at least half of the league", color:"#48d891" });
if (favouriteFormation) aiInsights.push({ type:"formation", title:"FORMATION FAVOURITE", subject:favouriteFormation[0], value:favouriteFormation[1], metricLabel:"MANAGERS", detail:`${percentage(favouriteFormation[1],entries.length)}% of the league started this shape`, color:"#58c7ff" });
aiInsights.push({ type:"transfer-activity", title:"TRANSFER ACTIVITY", subject:"Moves before deadline", value:transferManagers, metricLabel:"MANAGERS", detail:`${totalTransfers} total transfers across the league`, color:"#aeb9c9" });
aiInsights.splice(8);

const output = {
  schemaVersion: 2,
  source: {
    provider: "Fantasy Premier League public API",
    leagueId: Number(config.leagueId),
    syncedAt: new Date().toISOString(),
    gameweekStatus: {
      finished: Boolean(event.finished),
      dataChecked: Boolean(event.data_checked),
      deadline: event.deadline_time
    },
    privacy: "Aggregated data only. Manager IDs, manager names and the raw league roster are not stored."
  },
  gameweekData: {
    league: league?.name || `League ${config.leagueId}`,
    gameweek: event.id,
    participants: entries.length,
    formation: xi.formation,
    xi: xi.players,
    captains: captainData,
    transfersIn: transferInData,
    transfersOut: transferOutData,
    chips: chipData,
    eo: eoData,
    aiInsights
  }
};

await fs.mkdir(outputDirectory, { recursive: true });
const gameweekFile = path.join(outputDirectory, `gw-${String(event.id).padStart(2, "0")}.json`);
const latestFile = path.join(outputDirectory, "latest.json");
const browserFallbackFile = path.join(outputDirectory, "latest.js");
const serialized = `${JSON.stringify(output, null, 2)}\n`;
const browserFallback = `window.FPL_GAMEWEEK_SNAPSHOT = ${JSON.stringify(output, null, 2)};\n`;
const readyStatus = await writeSyncStatus(event, true);
await Promise.all([
  fs.writeFile(gameweekFile, serialized),
  fs.writeFile(latestFile, serialized),
  fs.writeFile(browserFallbackFile, browserFallback)
]);

console.log(`Saved ${path.relative(PROJECT_ROOT, gameweekFile)}, ${path.relative(PROJECT_ROOT, latestFile)} and ${path.relative(PROJECT_ROOT, browserFallbackFile)}.`);
console.log(readyStatus.message);
console.log(`League XI formation: ${xi.formation}. No raw manager data was stored.`);
