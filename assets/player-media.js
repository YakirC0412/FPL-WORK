(function () {
  const manifest = window.FPL_PLAYER_MEDIA || { players: [] };
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const byCode = new Map();
  const byName = new Map();
  const players = [...(manifest.players || [])];

  for (const player of manifest.players || []) {
    byCode.set(String(player.code), player);
    for (const alias of player.aliases || [player.webName, player.fullName]) {
      const key = normalize(alias);
      if (!key) continue;
      const matches = byName.get(key) || [];
      if (!matches.some(match => String(match.code) === String(player.code))) matches.push(player);
      byName.set(key, matches);
    }
  }

  function record(name, code) {
    if (code !== undefined && code !== null && code !== "") {
      const codedPlayer = byCode.get(String(code));
      if (codedPlayer) return codedPlayer;
    }
    const matches = byName.get(normalize(name)) || [];
    return matches.length === 1 ? matches[0] : null;
  }

  function search(query, limit = 8) {
    const needle = normalize(query);
    if (!needle) return [];
    const terms = needle.split(" ").filter(Boolean);
    return players.map(player => {
      const webName = normalize(player.webName);
      const fullName = normalize(player.fullName);
      const aliases = (player.aliases || []).map(normalize);
      const values = [webName, fullName, ...aliases];
      if (!terms.every(term => values.some(value => value.includes(term)))) return null;
      let score = 0;
      if (webName === needle) score += 100;
      if (fullName === needle) score += 95;
      if (values.some(value => value === needle)) score += 90;
      if (webName.startsWith(needle)) score += 50;
      if (fullName.startsWith(needle)) score += 45;
      if (values.some(value => value.startsWith(needle))) score += 35;
      score -= Math.abs(fullName.length - needle.length) / 100;
      return {player, score};
    }).filter(Boolean).sort((a,b) => b.score - a.score || String(a.player.webName).localeCompare(String(b.player.webName))).slice(0, limit).map(item => item.player);
  }

  function assetPath(value) {
    if (!value || /^(?:data:|blob:|https?:)/i.test(value)) return value || "";
    return value.startsWith("../") ? value : `../${value.replace(/^\.\//, "")}`;
  }

  window.FPLPlayerMedia = {
    manifest,
    normalize,
    record,
    search,
    isAmbiguous(name) {
      return (byName.get(normalize(name)) || []).length > 1;
    },
    photo(name, code, allowPlaceholder = false) {
      const player = record(name, code);
      if (!player || (!player.imageAvailable && !allowPlaceholder)) return "";
      return assetPath(player.image || "");
    }
  };
})();
