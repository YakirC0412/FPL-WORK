(function attachFplLiveData(global) {
  "use strict";

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
  const MAX_LEAGUE_MANAGERS = 1000;
  const REQUEST_CONCURRENCY = 6;

  class FplLiveDataError extends Error {
    constructor(message, code = "FPL_LIVE_ERROR", status = 0) {
      super(message);
      this.name = "FplLiveDataError";
      this.code = code;
      this.status = status;
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function proxyUrl(path) {
    const configured = String(global.FPL_RUNTIME_CONFIG?.fplProxyUrl || "").trim();
    const base = configured || "/api/fpl";
    if (base.includes("{path}")) return base.replace("{path}", encodeURIComponent(path));
    return `${base}${base.includes("?") ? "&" : "?"}path=${encodeURIComponent(path)}`;
  }

  async function fetchJson(path, attempt = 1) {
    let response;
    try {
      response = await fetch(proxyUrl(path), { headers: { Accept: "application/json" }, cache: "no-store" });
    } catch (error) {
      throw new FplLiveDataError(
        "The live FPL connection is unavailable. Please try again shortly.",
        "PROXY_UNAVAILABLE"
      );
    }
    if (response.ok) {
      const type = response.headers.get("content-type") || "";
      if (!type.includes("application/json")) {
        throw new FplLiveDataError(
          "The live FPL service is not configured for this website yet.",
          "PROXY_NOT_CONFIGURED",
          response.status
        );
      }
      return response.json();
    }
    const responseType = response.headers.get("content-type") || "";
    if (!responseType.includes("application/json")) {
      throw new FplLiveDataError(
        "The live FPL service is not configured for this website yet.",
        "PROXY_NOT_CONFIGURED",
        response.status
      );
    }
    if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
      await sleep(450 * (2 ** (attempt - 1)));
      return fetchJson(path, attempt + 1);
    }
    let detail = "";
    try {
      detail = String((await response.json())?.error || "");
    } catch {}
    throw new FplLiveDataError(
      detail || `FPL returned HTTP ${response.status}.`,
      response.status === 404 ? "NOT_FOUND" : "FPL_REQUEST_FAILED",
      response.status
    );
  }

  async function mapLimited(items, mapper, onProgress) {
    const results = new Array(items.length);
    let cursor = 0;
    let completed = 0;
    const workers = Array.from({ length: Math.min(REQUEST_CONCURRENCY, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await mapper(items[index], index);
        completed += 1;
        onProgress?.(completed, items.length);
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
      let payload;
      try {
        payload = await fetchJson(`/leagues-classic/${leagueId}/standings/?page_standings=${page}`);
      } catch (error) {
        if (error.code === "NOT_FOUND") {
          throw new FplLiveDataError(`League ${leagueId} could not be found or is not public.`, "LEAGUE_NOT_FOUND", 404);
        }
        throw error;
      }
      league ||= payload.league;
      entries.push(...(payload.standings?.results || []));
      if (entries.length > MAX_LEAGUE_MANAGERS || (payload.standings?.has_next && entries.length >= MAX_LEAGUE_MANAGERS)) {
        throw new FplLiveDataError(
          `This studio supports leagues with up to ${MAX_LEAGUE_MANAGERS.toLocaleString("en-GB")} managers. Larger global leagues cannot be loaded.`,
          "LEAGUE_TOO_LARGE"
        );
      }
      if (!payload.standings?.has_next) break;
      page += 1;
    }
    if (!entries.length) throw new FplLiveDataError(`League ${leagueId} did not return any managers.`, "EMPTY_LEAGUE");
    return { league, entries };
  }

  function increment(map, key, amount = 1) {
    const id = Number(key);
    map.set(id, (map.get(id) || 0) + amount);
  }

  function percentage(value, total) {
    return Number(((value / Math.max(1, total)) * 100).toFixed(1));
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
    const formation = FORMATIONS.map(candidate => ({
      ...candidate,
      score: byPosition.GK.slice(0, 1).reduce((sum, player) => sum + player.started * 1000 + player.owners, 0)
        + byPosition.DEF.slice(0, candidate.DEF).reduce((sum, player) => sum + player.started * 1000 + player.owners, 0)
        + byPosition.MID.slice(0, candidate.MID).reduce((sum, player) => sum + player.started * 1000 + player.owners, 0)
        + byPosition.FWD.slice(0, candidate.FWD).reduce((sum, player) => sum + player.started * 1000 + player.owners, 0)
    })).sort((a, b) => b.score - a.score)[0];
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

  function findAvailableEvent(bootstrap) {
    return bootstrap.events.find(item => item.is_current) || bootstrap.events.find(item => item.is_next);
  }

  async function loadLeague(leagueId, options = {}) {
    const onStage = typeof options.onStage === "function" ? options.onStage : () => {};
    onStage(0, "Finding league…");
    const bootstrap = await fetchJson("/bootstrap-static/");
    const event = findAvailableEvent(bootstrap);
    if (!event) throw new FplLiveDataError("FPL did not return an available gameweek.", "NO_GAMEWEEK");
    if (new Date(event.deadline_time).getTime() > Date.now()) {
      throw new FplLiveDataError(
        `Gameweek ${event.id} has not started yet, league data is not available.`,
        "GAMEWEEK_NOT_READY"
      );
    }

    const metadata = new Map(bootstrap.elements.map(player => [player.id, player]));
    const { league, entries } = await readLeague(leagueId);
    onStage(1, `Loading GW${event.id} data for ${entries.length} managers…`);

    let requestCount = 0;
    const totalRequests = entries.length * 2;
    const reportRequest = () => {
      requestCount += 1;
      const pct = Math.round((requestCount / Math.max(1, totalRequests)) * 100);
      onStage(1, `Loading manager data… ${pct}%`);
    };
    const picksByEntry = await mapLimited(entries, async entry => ({
      entryId: entry.entry,
      payload: await fetchJson(`/entry/${entry.entry}/event/${event.id}/picks/`)
    }), reportRequest);
    const transfersByEntry = await mapLimited(entries, async entry => ({
      entryId: entry.entry,
      payload: await fetchJson(`/entry/${entry.entry}/transfers/`)
    }), reportRequest);

    onStage(2, "Calculating league insights…");
    const ownership = new Map();
    const starters = new Map();
    const effectiveOwnership = new Map();
    const captainCounts = new Map();
    const chipCounts = new Map();
    const topTenOwnership = new Map();
    const formationCounts = new Map();
    const topTenEntryIds = new Set([...entries].sort((a, b) => Number(a.rank) - Number(b.rank)).slice(0, 10).map(entry => Number(entry.entry)));
    let hitManagers = 0;
    let totalHitCost = 0;

    for (const record of picksByEntry) {
      const seen = new Set();
      const formation = { DEF: 0, MID: 0, FWD: 0 };
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
      if (hitCost > 0) {
        hitManagers += 1;
        totalHitCost += hitCost;
      }
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
      if (managerTransfers) {
        transferManagers += 1;
        totalTransfers += managerTransfers;
      }
    }

    const xi = chooseLeagueXi(metadata, ownership, starters, entries.length);
    const captainRanking = rankedPlayers(captainCounts.keys(), metadata, captainCounts);
    const captainTop = captainRanking.slice(0, 4).map(item => ({ id: item.id, code: item.meta.code, name: item.meta.web_name, pct: percentage(item.primary, entries.length) }));
    const captainOther = captainRanking.slice(4).reduce((sum, item) => sum + item.primary, 0);
    const captains = captainOther ? [...captainTop, { name: "Other", pct: percentage(captainOther, entries.length) }] : captainTop;
    const transfersInData = rankedPlayers(transfersIn.keys(), metadata, transfersIn, ownership).slice(0, 3).map(item => ({
      id: item.id, code: item.meta.code, name: item.meta.web_name, moved: item.primary, owners: ownership.get(item.id) || 0
    }));
    const transfersOutData = rankedPlayers(transfersOut.keys(), metadata, transfersOut, ownership).slice(0, 3).map(item => ({
      id: item.id, code: item.meta.code, name: item.meta.web_name, moved: item.primary, owners: ownership.get(item.id) || 0
    }));
    const eo = rankedPlayers(effectiveOwnership.keys(), metadata, effectiveOwnership, ownership).slice(0, 5).map(item => ({
      id: item.id, code: item.meta.code, name: item.meta.web_name, pct: percentage(item.primary, entries.length)
    }));
    const chips = CHIP_LABELS.map(([key, name]) => ({ name, pct: percentage(chipCounts.get(key) || 0, entries.length) }));

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
      .sort((a, b) => b.started - a.started || b.owners - a.owners || a.name.localeCompare(b.name))[0];
    const eliteFavourite = [...playerInsightRows].sort((a, b) => b.topTenOwners - a.topTenOwners || b.owners - a.owners || a.name.localeCompare(b.name))[0];
    const benchRisk = playerInsightRows.filter(player => player.ownPct > 30 && player.benched > 0)
      .sort((a, b) => b.benched - a.benched || b.ownPct - a.ownPct || a.name.localeCompare(b.name))[0];
    const eliteBias = playerInsightRows.filter(player => player.topTenOwners > 0 && player.eliteGap > 0)
      .sort((a, b) => b.eliteGap - a.eliteGap || b.topTenOwners - a.topTenOwners || a.name.localeCompare(b.name))[0];
    const templateCore = playerInsightRows.filter(player => player.ownPct >= 50).length;
    const favouriteFormation = [...formationCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const aiInsights = [];
    if (differential) aiInsights.push({ type: "differential", title: "DIFFERENTIAL RADAR", subject: differential.name, value: differential.started, metricLabel: "STARTS", detail: `${differential.ownPct}% owned · ${differential.owners} managers own him`, color: "#5cc8ff" });
    aiInsights.push({ type: "hits", title: "HIT PARADE", subject: "League transfer cost", value: hitManagers, metricLabel: "MANAGERS", detail: `${totalHitCost} points spent on hits before the deadline`, color: "#ff7185" });
    if (eliteFavourite) aiInsights.push({ type: "elite-favourite", title: "TOP 10 FAVOURITE", subject: eliteFavourite.name, value: eliteFavourite.topTenOwners, metricLabel: "OF TOP 10", detail: `${eliteFavourite.ownPct}% ownership across the full league`, color: "#caa84b" });
    if (benchRisk) aiInsights.push({ type: "bench-risk", title: "BENCH RISK", subject: benchRisk.name, value: benchRisk.benched, metricLabel: "BENCHED", detail: `${benchRisk.started} started out of ${benchRisk.owners} owners`, color: "#ff9f45" });
    if (eliteBias) aiInsights.push({ type: "elite-bias", title: "ELITE BIAS", subject: eliteBias.name, value: eliteBias.eliteGap, metricLabel: "PP GAP", detail: `${eliteBias.topTenPct}% owned in the top 10 vs ${eliteBias.ownPct}% league-wide`, color: "#9b7cff" });
    aiInsights.push({ type: "template-core", title: "TEMPLATE CORE", subject: "Highly owned players", value: templateCore, metricLabel: "PLAYERS", detail: "Owned by at least half of the league", color: "#48d891" });
    if (favouriteFormation) aiInsights.push({ type: "formation", title: "FORMATION FAVOURITE", subject: favouriteFormation[0], value: favouriteFormation[1], metricLabel: "MANAGERS", detail: `${percentage(favouriteFormation[1], entries.length)}% of the league started this shape`, color: "#58c7ff" });
    aiInsights.push({ type: "transfer-activity", title: "TRANSFER ACTIVITY", subject: "Moves before deadline", value: transferManagers, metricLabel: "MANAGERS", detail: `${totalTransfers} total transfers across the league`, color: "#aeb9c9" });
    aiInsights.splice(8);

    return {
      schemaVersion: 2,
      source: {
        provider: "Fantasy Premier League public API",
        leagueId: Number(leagueId),
        syncedAt: new Date().toISOString(),
        live: true,
        gameweekStatus: {
          finished: Boolean(event.finished),
          dataChecked: Boolean(event.data_checked),
          deadline: event.deadline_time
        },
        privacy: "Aggregated in the browser. Manager IDs, names and raw rosters are not stored."
      },
      gameweekData: {
        league: league?.name || `League ${leagueId}`,
        gameweek: event.id,
        participants: entries.length,
        formation: xi.formation,
        xi: xi.players,
        captains,
        transfersIn: transfersInData,
        transfersOut: transfersOutData,
        chips,
        eo,
        aiInsights
      }
    };
  }

  global.FPLLiveData = {
    loadLeague,
    FplLiveDataError,
    maxLeagueManagers: MAX_LEAGUE_MANAGERS,
    proxyUrl: () => String(global.FPL_RUNTIME_CONFIG?.fplProxyUrl || "").trim(),
    request: fetchJson,
    readLeague,
    mapLimited
  };
})(window);
