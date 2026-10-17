(function attachFplLiveRecap(global) {
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

  function core() {
    if (!global.FPLLiveData?.request || !global.FPLLiveData?.readLeague || !global.FPLLiveData?.mapLimited) {
      throw new Error("The shared FPL live-data service is unavailable.");
    }
    return global.FPLLiveData;
  }

  function increment(map, key, amount = 1) {
    const id = Number(key);
    map.set(id, (map.get(id) || 0) + amount);
  }

  function percentage(value, total) {
    return Number(((value / Math.max(1, total)) * 100).toFixed(1));
  }

  function summarizeTransferActivity(transfers, livePoints) {
    const incoming = new Map();
    const outgoing = new Map();
    for (const transfer of transfers || []) {
      increment(incoming, transfer.element_in);
      increment(outgoing, transfer.element_out);
    }

    const playerIds = new Set([...incoming.keys(), ...outgoing.keys()]);
    const netIncoming = [];
    const netOutgoing = [];
    const recycledPlayers = [];
    for (const playerId of playerIds) {
      const timesIn = incoming.get(playerId) || 0;
      const timesOut = outgoing.get(playerId) || 0;
      const net = timesIn - timesOut;
      if (timesIn > 0 && timesOut > 0) recycledPlayers.push(playerId);
      for (let index = 0; index < Math.max(0, net); index += 1) netIncoming.push(playerId);
      for (let index = 0; index < Math.max(0, -net); index += 1) netOutgoing.push(playerId);
    }

    const incomingPoints = netIncoming.reduce((sum, playerId) => sum + (livePoints.get(playerId) || 0), 0);
    const outgoingPoints = netOutgoing.reduce((sum, playerId) => sum + (livePoints.get(playerId) || 0), 0);
    return {
      incomingPoints,
      outgoingPoints,
      transferGain: incomingPoints - outgoingPoints,
      recycledPlayerCount: recycledPlayers.length
    };
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

  function currentEvent(bootstrap) {
    return bootstrap.events.find(item => item.is_current) || bootstrap.events.find(item => item.is_next);
  }

  async function loadLeagueRecap(leagueId, options = {}) {
    const { request, readLeague, mapLimited, FplLiveDataError } = core();
    const onStage = typeof options.onStage === "function" ? options.onStage : () => {};
    onStage(0, "Finding league and final gameweek…");
    const bootstrap = await request("/bootstrap-static/");
    const requestedGameweek = Number(options.gameweek) || 0;
    const event = requestedGameweek
      ? bootstrap.events.find(item => Number(item.id) === requestedGameweek)
      : currentEvent(bootstrap);
    if (!event) throw new FplLiveDataError("FPL did not return a current gameweek.", "NO_GAMEWEEK");
    const officiallyFinal = Boolean(event.finished && event.data_checked);
    let fixturesComplete = false;
    if (!officiallyFinal) {
      onStage(0, `Verifying all GW${event.id} fixtures are complete…`);
      const fixtures = await request(`/fixtures/?event=${event.id}`);
      fixturesComplete = Array.isArray(fixtures)
        && fixtures.length > 0
        && fixtures.every(fixture => fixture.finished === true && fixture.finished_provisional !== false);
    }
    const rankedResultsAvailable = Number(event.ranked_count) > 0
      && Number(event.highest_scoring_entry) > 0
      && Number(event.top_element) > 0;
    if (!officiallyFinal && (!fixturesComplete || !rankedResultsAvailable)) {
      throw new FplLiveDataError(
        `Gameweek ${event.id} is not complete yet, recap data is not available.`,
        "GAMEWEEK_NOT_FINAL"
      );
    }

    const metadata = new Map(bootstrap.elements.map(player => [Number(player.id), player]));
    const { league, entries } = await readLeague(leagueId);
    onStage(1, `Loading final GW${event.id} data for ${entries.length} managers…`);
    let completed = 0;
    const report = () => {
      completed += 1;
      onStage(1, `Loading manager recaps… ${Math.round((completed / Math.max(1, entries.length)) * 100)}%`);
    };
    const [records, livePayload] = await Promise.all([
      mapLimited(entries, async entry => {
        const [payload, transfers] = await Promise.all([
          request(`/entry/${entry.entry}/event/${event.id}/picks/`),
          request(`/entry/${entry.entry}/transfers/`)
        ]);
        return {
          standing: entry,
          payload,
          transfers: (transfers || []).filter(transfer => Number(transfer.event) === Number(event.id))
        };
      }, report),
      request(`/event/${event.id}/live/`)
    ]);

    onStage(2, "Calculating podium and recap stories…");
    const ownership = new Map();
    const captainCounts = new Map();
    for (const record of records) {
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
    const scoreRows = records.map(record => {
      const transferActivity = summarizeTransferActivity(record.transfers, livePoints);
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
        incomingTransferPoints: transferActivity.incomingPoints,
        outgoingTransferPoints: transferActivity.outgoingPoints,
        recycledPlayerCount: transferActivity.recycledPlayerCount,
        transferGain: transferActivity.transferGain,
        hitCost,
        netTransferImpact: transferActivity.transferGain - hitCost
      };
    });
    const rankedScores = [...scoreRows].sort((a, b) => b.points - a.points || b.total - a.total || a.manager.localeCompare(b.manager));
    const lowestScores = [...scoreRows].sort((a, b) => a.points - b.points || a.total - b.total || a.manager.localeCompare(b.manager));
    const overallStandings = [...scoreRows].sort((a, b) => a.overallRank - b.overallRank || b.total - a.total || a.manager.localeCompare(b.manager));
    const top4 = overallStandings.slice(0, 4).map((entry, index) => ({
      rank: index + 1,
      manager: entry.manager,
      team: entry.team,
      points: entry.total,
      gameweekPoints: entry.points
    }));
    const captainPool = [...captainCounts.entries()]
      .map(([id, count]) => ({ id, count, meta: metadata.get(id), points: livePoints.get(id) || 0 }))
      .filter(item => item.meta)
      .sort((a, b) => b.count - a.count || b.points - a.points || a.meta.web_name.localeCompare(b.meta.web_name));
    const selectedCaptains = captainPool.length <= 5
      ? captainPool.slice(0, 5)
      : [
          ...captainPool.slice(0, 4),
          [...captainPool.slice(4)].sort((a, b) => b.points - a.points || b.count - a.count || a.meta.web_name.localeCompare(b.meta.web_name))[0]
        ];
    const captainData = selectedCaptains
      .map(item => ({
        id: item.id,
        code: item.meta.code,
        name: item.meta.web_name,
        points: item.points * 2,
        captainPct: percentage(item.count, entries.length)
      }));
    const topPlayers = [...metadata.values()]
      .map(player => ({ id: player.id, code: player.code, name: player.web_name, points: livePoints.get(player.id) || 0, owners: ownership.get(player.id) || 0 }))
      .filter(player => player.points > 0)
      .sort((a, b) => b.points - a.points || b.owners - a.owners || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map(player => ({ id: player.id, code: player.code, name: player.name, points: player.points, own: percentage(player.owners, entries.length) }));

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
    for (const record of records) {
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
    const benchPain = [...scoreRows].filter(entry => entry.benchPoints > 0).sort((a, b) => b.benchPoints - a.benchPoints || a.manager.localeCompare(b.manager))[0];
    const comeback = [...scoreRows].map(entry => ({ ...entry, rankRise: entry.previousRank - entry.overallRank })).filter(entry => entry.rankRise > 0).sort((a, b) => b.rankRise - a.rankRise || b.points - a.points || a.manager.localeCompare(b.manager))[0];
    const rankCrasher = [...scoreRows].map(entry => ({ ...entry, rankFall: entry.overallRank - entry.previousRank })).filter(entry => entry.rankFall > 0).sort((a, b) => b.rankFall - a.rankFall || a.points - b.points || a.manager.localeCompare(b.manager))[0];
    const chipUsers = scoreRows.filter(entry => entry.activeChip);
    const chipUsagePct = percentage(chipUsers.length, entries.length);
    const chipMaster = chipUsagePct > 10 ? [...chipUsers].sort((a, b) => b.points - a.points || a.manager.localeCompare(b.manager))[0] : null;
    const forgotWildcardPool = [...scoreRows]
      .filter(entry => entry.activeChip !== "wildcard" && (entry.hitCost > 12 || entry.recycledPlayerCount > 2))
      .sort((a, b) => b.hitCost - a.hitCost || b.recycledPlayerCount - a.recycledPlayerCount || b.transferCount - a.transferCount || a.manager.localeCompare(b.manager));
    const forgotWildcard = forgotWildcardPool[0];
    const regularPaidHits = [...scoreRows]
      .filter(entry => entry.hitCost >= 8 && !forgotWildcardPool.includes(entry));
    const painfulHit = regularPaidHits
      .filter(entry => entry.transferGain < 0)
      .sort((a, b) => a.transferGain - b.transferGain || b.hitCost - a.hitCost || a.manager.localeCompare(b.manager))[0];
    const goodHit = regularPaidHits
      .filter(entry => entry.transferGain > 0)
      .sort((a, b) => b.transferGain - a.transferGain || a.hitCost - b.hitCost || a.manager.localeCompare(b.manager))[0];
    const closestStandingsGap = overallStandings.slice(0, -1).map((entry, index) => ({ first: entry, second: overallStandings[index + 1], gap: Math.abs(entry.total - overallStandings[index + 1].total) })).sort((a, b) => a.gap - b.gap || a.first.overallRank - b.first.overallRank)[0];
    const chipNames = { wildcard: "Wildcard", freehit: "Free Hit", bboost: "Bench Boost", "3xc": "Triple Captain" };
    const aiInsights = [];
    if (comeback) aiInsights.push({ type: "comeback", title: "COMEBACK KID", manager: comeback.manager, points: comeback.rankRise, metricLabel: "PLACES UP", detail: `${comeback.team} · climbed from #${comeback.previousRank} to #${comeback.overallRank}`, color: "#48d891" });
    if (rankCrasher) aiInsights.push({ type: "rank-crasher", title: "RANK CRASHER", manager: rankCrasher.manager, points: rankCrasher.rankFall, metricLabel: "PLACES DOWN", detail: `${rankCrasher.team} · fell from #${rankCrasher.previousRank} to #${rankCrasher.overallRank}`, color: "#ff7185" });
    if (chipMaster) aiInsights.push({ type: "chip-master", title: "CHIP MASTER", manager: chipMaster.manager, points: chipMaster.points, metricLabel: "PTS", detail: `${chipNames[chipMaster.activeChip] || chipMaster.activeChip} · best chip-user score · ${chipUsagePct}% of managers used a chip`, color: "#ff9f45" });
    if (forgotWildcard) aiInsights.push({ type: "forgot-wildcard", title: "FORGOT TO ACTIVATE", manager: forgotWildcard.manager, points: forgotWildcard.hitCost, metricLabel: "POINT HIT", detail: `${forgotWildcard.team} · ${forgotWildcard.transferCount} transfers · ${forgotWildcard.recycledPlayerCount} players bought and sold again · no Wildcard active`, color: "#9b7cff" });
    if (painfulHit) aiInsights.push({ type: "painful-hit", title: "PAINFUL HIT", manager: painfulHit.manager, points: painfulHit.hitCost, metricLabel: "POINT HIT", detail: `${painfulHit.team} · incoming players scored ${Math.abs(painfulHit.transferGain)} fewer pts than outgoing players`, color: "#ff6177" });
    if (goodHit) aiInsights.push({ type: "good-hit", title: "HIT HERO", manager: goodHit.manager, points: goodHit.hitCost, metricLabel: "POINT HIT", detail: `${goodHit.team} · incoming players outscored outgoing players by ${goodHit.transferGain} pts`, color: "#48d891" });
    if (successfulTransfer) aiInsights.push({ type: "transfer", title: "TRANSFER MASTERSTROKE", manager: `${successfulTransfer.inName} IN`, points: successfulTransfer.gain, metricLabel: "PTS GAIN", detail: `${successfulTransfer.outName} out · ${successfulTransfer.count} manager${successfulTransfer.count === 1 ? "" : "s"} made this move`, color: "#48d891" });
    if (benchPain) aiInsights.push({ type: "bench", title: "BENCH PAIN", manager: benchPain.manager, points: benchPain.benchPoints, metricLabel: "BENCH PTS", detail: `${benchPain.team} · highest unused bench score in the league`, color: "#ff7185" });
    if (differential) aiInsights.push({ type: "hidden-gem", title: "HIDDEN GEM", manager: differential.name, points: differential.points, metricLabel: "PTS", detail: `${differential.own}% owned · best low-owned return not shown elsewhere in the recap`, color: "#5cc8ff" });
    if (aiInsights.length < 8 && closestStandingsGap) aiInsights.push({ type: "closest-call", title: "CLOSEST CALL", manager: `${closestStandingsGap.first.manager} / ${closestStandingsGap.second.manager}`, points: closestStandingsGap.gap, metricLabel: "PTS APART", detail: `League positions #${closestStandingsGap.first.overallRank} and #${closestStandingsGap.second.overallRank}`, color: "#aeb9c9" });
    aiInsights.splice(8);
    const average = Number((scoreRows.reduce((sum, entry) => sum + entry.points, 0) / Math.max(1, scoreRows.length)).toFixed(1));
    return {
      schemaVersion: 2,
      source: {
        provider: "Fantasy Premier League public API",
        leagueId: Number(leagueId),
        syncedAt: new Date().toISOString(),
        live: true,
        gameweekStatus: {
          finished: Boolean(event.finished || fixturesComplete),
          dataChecked: Boolean(event.data_checked),
          fixturesComplete,
          officiallyFinal,
          deadline: event.deadline_time
        },
        privacy: "Aggregated in the browser. Only manager and team names shown in the recap are retained in the editable draft."
      },
      recapData: {
        league: league?.name || `League ${leagueId}`,
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
  }

  global.FPLLiveRecap = { loadLeague: loadLeagueRecap };
})(window);
