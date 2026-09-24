# FPL Gameweek Recap synchronization

The Recap integration reads the public Fantasy Premier League endpoints for classic league `507749`. It does not require an API key.

## Final-result rule

Recap synchronization only runs for a gameweek where FPL reports both `finished: true` and `data_checked: true`. When no gameweek is supplied, the script selects the latest event that satisfies both conditions.

## Generated files

- `data/recaps/gw-XX.json` keeps the snapshot for a specific gameweek.
- `data/recaps/latest.json` is loaded by the Recap studio.
- `data/recaps/latest.js` is the same snapshot wrapped for browsers that open the studio directly through `file://` and block local JSON requests.
- `data/recaps/status.json` and `status.js` tell the Load button whether the current gameweek is final. If it is not ready, the studio shows an alert instead of loading an older recap.

Run locally with `node scripts/fpl/sync-gameweek-recap.mjs`. Add `--gameweek 3` to request a specific completed gameweek. On GitHub, the **Sync Gameweek Recap** action checks the current gameweek every two hours. Before results are final it updates only the small status file. Once FPL reports both final flags, it creates the recap automatically. The action can also be run manually.

## Calculations

- **Top 4:** the first four managers in the overall league standings after the gameweek, showing their cumulative season points.
- **Top Points and Lowest Points:** the highest and lowest manager scores in this gameweek.
- **Average Score:** the arithmetic mean of all league-manager scores for the gameweek.
- **League XI:** the highest-owned legal formation across all 15-player squads in the league. Each card shows the player's final FPL points and league ownership.
- **Captain Returns:** the three most-selected captains, their selection percentage and their standard doubled captain score.
- **Top Gameweek Players:** the three highest-scoring FPL players, with ownership inside this league.
- **Spicy Stats:** intentionally not generated. Existing editorial stories and styling are preserved when a snapshot is loaded.

## Privacy

The published recap snapshot contains aggregated player data plus the manager and team display names needed for the podium and score-summary cards. It does not contain FPL entry IDs, the complete league roster, or any raw individual squad.
