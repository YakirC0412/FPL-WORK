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

const config = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "config/fpl.json"), "utf8"));
const requestedGameweek = Number(process.env.GAMEWEEK || argumentValue("--gameweek") || 0);
const checkCurrentGameweek = process.env.CHECK_CURRENT_GAMEWEEK === "1";
const allowPendingStatus = process.env.ALLOW_PENDING_STATUS === "1";
const outputDirectory = path.resolve(PROJECT_ROOT, config.recapOutputDirectory || "data/recaps");
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
    headers: { Accept: "application/json", "User-Agent": "FPL-Champions-League-Studio/1.0" }
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
    finished: Boolean(event.finished),
    dataChecked: Boolean(event.data_checked),
    message: ready
      ? `Gameweek ${event.id} final recap is ready.`
      : `Gameweek ${event.id} is not final yet. FPL finished=${Boolean(event.finished)}, data_checked=${Boolean(event.data_checked)}.`
  };
  await fs.mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(statusFile, `${JSON.stringify(status, null, 2)}\n`),
    fs.writeFile(statusFallbackFile, `window.FPL_RECAP_STATUS = ${JSON.stringify(status, null, 2)};\n`)
  ]);
  return status;
}

function chooseLeagueXi(metadata, ownership, livePoints, participants) {
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
      points: livePoints.get(player.id) || 0
    });
  }
  Object.values(byPosition).forEach(players => players.sort((a, b) =>
    b.owners - a.owners || b.points - a.points || a.name.localeCompare(b.name)
  ));
  const formation = FORMATIONS.map(candidate => ({
    ...candidate,
    score: byPosition.GK.slice(0, 1).reduce((sum, player) => sum + player.owners, 0)
      + byPosition.DEF.slice(0, candidate.DEF).reduce((sum, player) => sum + player.owners, 0)
      + byPosition.MID.slice(0, candidate.MID).reduce((sum, player) => sum + player.owners, 0)
      + byPosition.FWD.slice(0, candidate.FWD).reduce((sum, player) => sum + player.owners, 0)
  })).sort((a, b) => b.score - a.score)[0];
  const players = [
    ...byPosition.GK.slice(0, 1),
    ...byPosition.DEF.slice(0, formation.DEF),
    ...byPosition.MID.slice(0, formation.MID),
    ...byPosition.FWD.slice(0, formation.FWD)
  ];
  return {
    formation: formation.name,
    players: players.map(player => ({
      id: player.id,
      code: player.code,
      position: player.position,
      name: player.name,
      own: percentage(player.owners, participants),
      points: player.points
    }))
  };
}

const bootstrap = await fetchJson("/bootstrap-static/");
const completedEvents = bootstrap.events.filter(item => item.finished && item.data_checked);
const event = requestedGameweek
  ? bootstrap.events.find(item => item.id === requestedGameweek)
  : checkCurrentGameweek
    ? bootstrap.events.find(item => item.is_current) || bootstrap.events.find(item => item.is_next)
    : completedEvents.at(-1);
if (!event) throw new Error("Could not identify the requested gameweek.");
if (!event.finished || !event.data_checked) {
  if (allowPendingStatus) {
    const status = await writeSyncStatus(event, false);
    console.log(status.message);
    process.exit(0);
  }
  throw new Error(`Gameweek ${event.id} is not final yet. Recap sync requires finished and data-checked FPL results.`);
}

if (checkCurrentGameweek) {
  try {
    const previousStatus = JSON.parse(await fs.readFile(statusFile, "utf8"));
    if (previousStatus.ready && Number(previousStatus.gameweek) === Number(event.id)) {
      console.log(`Gameweek ${event.id} recap is already synchronized.`);
      process.exit(0);
    }
  } catch {}
}

const metadata = new Map(bootstrap.elements.map(player => [player.id, player]));
const { league, entries } = await readLeague(config.leagueId);
console.log(`Reading final GW${event.id} picks and transfers for ${entries.length} league entries...`);
const [picksByEntry, livePayload] = await Promise.all([
  mapLimited(entries, async entry => {
    const [payload, transfers] = await Promise.all([
      fetchJson(`/entry/${entry.entry}/event/${event.id}/picks/`),
      fetchJson(`/entry/${entry.entry}/transfers/`)
    ]);
    return {
      standing: entry,
      payload,
      transfers: (transfers || []).filter(transfer => Number(transfer.event) === Number(event.id))
    };
  }),
  fetchJson(`/event/${event.id}/live/`)
]);

const ownership = new Map();
const captainCounts = new Map();
for (const record of picksByEntry) {
  const seen = new Set();
  for (const pick of record.payload.picks || []) {
    if (!seen.has(pick.element)) {
      increment(ownership, pick.element);
      seen.add(pick.element);
    }
    if (pick.is_captain) increment(captainCounts, pick.element);
  }
}

const livePoints = new Map((livePayload.elements || []).map(player => [Number(player.id), Number(player.stats?.total_points) || 0]));
const xi = chooseLeagueXi(metadata, ownership, livePoints, entries.length);
const scoreRows = picksByEntry.map(record => {
  const transferGain = (record.transfers || []).reduce((sum, transfer) =>
    sum + (livePoints.get(Number(transfer.element_in)) || 0) - (livePoints.get(Number(transfer.element_out)) || 0), 0);
  const hitCost = Number(record.payload.entry_history?.event_transfers_cost) || 0;
  return {
    manager: record.standing.player_name || "Manager",
    team: record.standing.entry_name || "Team",
    points: Number(record.payload.entry_history?.points ?? record.standing.event_total) || 0,
    total: Number(record.standing.total) || 0,
    overallRank: Number(record.standing.rank) || Number.MAX_SAFE_INTEGER,
    previousRank: Number(record.standing.last_rank) || Number(record.standing.rank) || Number.MAX_SAFE_INTEGER,
    benchPoints: Number(record.payload.entry_history?.points_on_bench) || 0,
    activeChip: String(record.payload.active_chip || ""),
    transferCount: (record.transfers || []).length,
    transferGain,
    hitCost,
    netTransferImpact: transferGain - hitCost
  };
});
const rankedScores = [...scoreRows].sort((a, b) => b.points - a.points || b.total - a.total || a.manager.localeCompare(b.manager));
const lowestScores = [...scoreRows].sort((a, b) => a.points - b.points || a.total - b.total || a.manager.localeCompare(b.manager));
const overallStandings = [...scoreRows].sort((a, b) => a.overallRank - b.overallRank || b.total - a.total || a.manager.localeCompare(b.manager));
const top4 = overallStandings.slice(0, 4).map((entry, index) => ({
  rank: index + 1,
  manager: entry.manager,
  team: entry.team,
  points: entry.total
}));

const captainData = [...captainCounts.entries()]
  .map(([id, count]) => ({ id, count, meta: metadata.get(id), points: livePoints.get(id) || 0 }))
  .filter(item => item.meta)
  .sort((a, b) => b.count - a.count || b.points - a.points || a.meta.web_name.localeCompare(b.meta.web_name))
  .slice(0, 3)
  .map(item => ({
    id: item.id,
    code: item.meta.code,
    name: item.meta.web_name,
    points: item.points * 2,
    captainPct: percentage(item.count, entries.length)
  }));

const topPlayers = [...metadata.values()]
  .map(player => ({
    id: player.id,
    name: player.web_name,
    points: livePoints.get(player.id) || 0,
    owners: ownership.get(player.id) || 0
  }))
  .filter(player => player.points > 0)
  .sort((a, b) => b.points - a.points || b.owners - a.owners || a.name.localeCompare(b.name))
  .slice(0, 3)
  .map(player => ({ id: player.id, code: metadata.get(player.id)?.code, name: player.name, points: player.points, own: percentage(player.owners, entries.length) }));

const differentialPool = [...metadata.values()]
  .map(player => ({
    id: player.id,
    name: player.web_name,
    points: livePoints.get(player.id) || 0,
    owners: ownership.get(player.id) || 0,
    own: percentage(ownership.get(player.id) || 0, entries.length)
  }))
  .filter(player => player.points > 0 && player.owners > 0 && player.own <= 15 && !topPlayers.some(item => item.name === player.name) && !xi.players.some(item => item.name === player.name) && !captainData.some(item => item.name === player.name))
  .sort((a, b) => b.points - a.points || a.owners - b.owners || a.name.localeCompare(b.name));

const transferPairs = new Map();
for (const record of picksByEntry) {
  for (const transfer of record.transfers || []) {
    const inId = Number(transfer.element_in);
    const outId = Number(transfer.element_out);
    if (!metadata.has(inId) || !metadata.has(outId)) continue;
    const key = `${inId}:${outId}`;
    const pair = transferPairs.get(key) || { inId, outId, count: 0 };
    pair.count += 1;
    transferPairs.set(key, pair);
  }
}
const successfulTransfer = [...transferPairs.values()]
  .map(pair => ({
    ...pair,
    inName: metadata.get(pair.inId)?.web_name || "Incoming player",
    outName: metadata.get(pair.outId)?.web_name || "Outgoing player",
    inPoints: livePoints.get(pair.inId) || 0,
    outPoints: livePoints.get(pair.outId) || 0,
    gain: (livePoints.get(pair.inId) || 0) - (livePoints.get(pair.outId) || 0)
  }))
  .filter(pair => pair.gain > 0)
  .sort((a, b) => b.gain - a.gain || b.count - a.count || a.inName.localeCompare(b.inName))[0];
const differential = differentialPool.find(player => player.name !== successfulTransfer?.inName && player.name !== successfulTransfer?.outName) || differentialPool[0];

const benchPain = [...scoreRows]
  .filter(entry => entry.benchPoints > 0)
  .sort((a, b) => b.benchPoints - a.benchPoints || a.manager.localeCompare(b.manager))[0];

const comeback = [...scoreRows]
  .map(entry => ({ ...entry, rankRise: entry.previousRank - entry.overallRank }))
  .filter(entry => entry.rankRise > 0)
  .sort((a, b) => b.rankRise - a.rankRise || b.points - a.points || a.manager.localeCompare(b.manager))[0];
const rankCrasher = [...scoreRows]
  .map(entry => ({ ...entry, rankFall: entry.overallRank - entry.previousRank }))
  .filter(entry => entry.rankFall > 0)
  .sort((a, b) => b.rankFall - a.rankFall || a.points - b.points || a.manager.localeCompare(b.manager))[0];
const chipUsers = scoreRows.filter(entry => entry.activeChip);
const chipUsagePct = percentage(chipUsers.length, entries.length);
const chipMaster = chipUsagePct > 10
  ? [...chipUsers].sort((a, b) => b.points - a.points || a.manager.localeCompare(b.manager))[0]
  : null;
const transferTangle = [...scoreRows]
  .filter(entry => entry.transferCount > 0 && entry.netTransferImpact < 0)
  .sort((a, b) => a.netTransferImpact - b.netTransferImpact || b.hitCost - a.hitCost || a.manager.localeCompare(b.manager))[0];
const painfulHitPool = [...scoreRows]
  .filter(entry => entry.hitCost > 0 && entry.netTransferImpact < 0)
  .sort((a, b) => b.hitCost - a.hitCost || a.netTransferImpact - b.netTransferImpact || a.manager.localeCompare(b.manager));
const painfulHit = painfulHitPool.find(entry => entry.manager !== transferTangle?.manager) || painfulHitPool[0];
const closestStandingsGap = overallStandings.slice(0,-1)
  .map((entry,index) => ({ first:entry, second:overallStandings[index+1], gap:Math.abs(entry.total - overallStandings[index+1].total) }))
  .sort((a,b) => a.gap - b.gap || a.first.overallRank - b.first.overallRank)[0];
const chipNames = { wildcard:"Wildcard", freehit:"Free Hit", bboost:"Bench Boost", "3xc":"Triple Captain" };

const aiInsights = [];
if (comeback) aiInsights.push({
  type: "comeback",
  title: "COMEBACK KID",
  manager: comeback.manager,
  points: comeback.rankRise,
  metricLabel: "PLACES UP",
  detail: `${comeback.team} · climbed from #${comeback.previousRank} to #${comeback.overallRank}`,
  color: "#48d891"
});
if (rankCrasher) aiInsights.push({
  type: "rank-crasher",
  title: "RANK CRASHER",
  manager: rankCrasher.manager,
  points: rankCrasher.rankFall,
  metricLabel: "PLACES DOWN",
  detail: `${rankCrasher.team} · fell from #${rankCrasher.previousRank} to #${rankCrasher.overallRank}`,
  color: "#ff7185"
});
if (chipMaster) aiInsights.push({
  type: "chip-master",
  title: "CHIP MASTER",
  manager: chipMaster.manager,
  points: chipMaster.points,
  metricLabel: "PTS",
  detail: `${chipNames[chipMaster.activeChip] || chipMaster.activeChip} · best chip-user score · ${chipUsagePct}% of managers used a chip`,
  color: "#ff9f45"
});
if (transferTangle) aiInsights.push({
  type: "transfer-tangle",
  title: "TRANSFER TANGLE",
  manager: transferTangle.manager,
  points: Math.abs(transferTangle.netTransferImpact),
  metricLabel: "PTS LOST",
  detail: `${transferTangle.team} · worst net impact after transfer returns and hit costs`,
  color: "#9b7cff"
});
if (painfulHit) aiInsights.push({
  type: "painful-hit",
  title: "PAINFUL HIT",
  manager: painfulHit.manager,
  points: painfulHit.hitCost,
  metricLabel: "HIT COST",
  detail: `${painfulHit.team} · transfers returned ${painfulHit.transferGain} pts before the hit`,
  color: "#ff6177"
});
if (successfulTransfer) aiInsights.push({
  type: "transfer",
  title: "TRANSFER MASTERSTROKE",
  manager: `${successfulTransfer.inName} IN`,
  points: successfulTransfer.gain,
  metricLabel: "PTS GAIN",
  detail: `${successfulTransfer.outName} out · ${successfulTransfer.count} manager${successfulTransfer.count === 1 ? "" : "s"} made this move`,
  color: "#48d891"
});
if (benchPain) aiInsights.push({
  type: "bench",
  title: "BENCH PAIN",
  manager: benchPain.manager,
  points: benchPain.benchPoints,
  metricLabel: "BENCH PTS",
  detail: `${benchPain.team} · highest unused bench score in the league`,
  color: "#ff7185"
});
if (differential) aiInsights.push({
  type: "hidden-gem",
  title: "HIDDEN GEM",
  manager: differential.name,
  points: differential.points,
  metricLabel: "PTS",
  detail: `${differential.own}% owned · best low-owned return not shown elsewhere in the recap`,
  color: "#5cc8ff"
});
if (aiInsights.length < 8 && closestStandingsGap) aiInsights.push({
  type: "closest-call",
  title: "CLOSEST CALL",
  manager: `${closestStandingsGap.first.manager} / ${closestStandingsGap.second.manager}`,
  points: closestStandingsGap.gap,
  metricLabel: "PTS APART",
  detail: `League positions #${closestStandingsGap.first.overallRank} and #${closestStandingsGap.second.overallRank}`,
  color: "#aeb9c9"
});
aiInsights.splice(8);

const average = Number((scoreRows.reduce((sum, entry) => sum + entry.points, 0) / Math.max(1, scoreRows.length)).toFixed(1));
const output = {
  schemaVersion: 2,
  source: {
    provider: "Fantasy Premier League public API",
    leagueId: Number(config.leagueId),
    syncedAt: new Date().toISOString(),
    gameweekStatus: { finished: true, dataChecked: true, deadline: event.deadline_time },
    privacy: "Only aggregated player data and the manager/team names required by the recap graphic are stored. Entry IDs, raw squads and individual transfer histories are not stored."
  },
  recapData: {
    league: league?.name || `League ${config.leagueId}`,
    gameweek: event.id,
    participants: entries.length,
    average,
    topPoints: { manager: rankedScores[0].manager, team: rankedScores[0].team, points: rankedScores[0].points },
    lowestPoints: { manager: lowestScores[0].manager, team: lowestScores[0].team, points: lowestScores[0].points },
    top4,
    formation: xi.formation,
    xi: xi.players,
    captains: captainData,
    topPlayers,
    aiInsights
  }
};

await fs.mkdir(outputDirectory, { recursive: true });
const gameweekFile = path.join(outputDirectory, `gw-${String(event.id).padStart(2, "0")}.json`);
const latestFile = path.join(outputDirectory, "latest.json");
const browserFallbackFile = path.join(outputDirectory, "latest.js");
const serialized = `${JSON.stringify(output, null, 2)}\n`;
const browserFallback = `window.FPL_RECAP_SNAPSHOT = ${JSON.stringify(output, null, 2)};\n`;
const readyStatus = {
  leagueId: Number(config.leagueId),
  gameweek: Number(event.id),
  ready: true,
  finished: true,
  dataChecked: true,
  message: `Gameweek ${event.id} final recap is ready.`
};
await Promise.all([
  fs.writeFile(gameweekFile, serialized),
  fs.writeFile(latestFile, serialized),
  fs.writeFile(browserFallbackFile, browserFallback),
  fs.writeFile(statusFile, `${JSON.stringify(readyStatus, null, 2)}\n`),
  fs.writeFile(statusFallbackFile, `window.FPL_RECAP_STATUS = ${JSON.stringify(readyStatus, null, 2)};\n`)
]);

console.log(`Saved ${path.relative(PROJECT_ROOT, gameweekFile)}, ${path.relative(PROJECT_ROOT, latestFile)} and ${path.relative(PROJECT_ROOT, browserFallbackFile)}.`);
console.log(`League recap: ${entries.length} managers, ${xi.formation}. No entry IDs or raw squads were stored.`);
