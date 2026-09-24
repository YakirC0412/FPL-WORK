# FPL Gameweek Data Sync

## Scope

This integration is intentionally limited to the Gameweek Data studio. It reads public, post-deadline FPL data for classic league `507749` and generates an aggregated JSON snapshot.

No API key, FPL password or authenticated cookie is used. Raw manager names, entry IDs and the full league roster are never written to disk.

## Run locally

Node.js 18 or newer is required:

```text
node scripts/fpl/sync-gameweek-data.mjs
```

To request a specific post-deadline gameweek:

```text
node scripts/fpl/sync-gameweek-data.mjs --gameweek 3
```

The command writes:

- `data/gameweeks/gw-03.json`
- `data/gameweeks/latest.json`
- `data/gameweeks/latest.js` for direct `file://` use
- `data/gameweeks/status.json`
- `data/gameweeks/status.js` for direct `file://` use

## Run on GitHub

The workflow checks automatically every two hours. It can also be started manually from the repository's **Actions** tab; optionally enter a gameweek number. The workflow commits only the aggregated snapshot and readiness files.

## Calculations

- **Owners**: managers whose 15-player squad contains the player.
- **Started By**: managers who placed the player in positions 1–11.
- **League XI**: the legal formation with the highest combined starter count. Ties use owner count.
- **Captain Picks**: captain selections divided by league participants. The top four are displayed and the rest become `Other`.
- **Effective Ownership**: sum of pick multipliers divided by league participants. Captain and Triple Captain multipliers are therefore included.
- **Transfers**: transfers whose `event` matches the selected gameweek. Current and remaining owners come from the post-deadline squads.
- **Chip Usage**: active chip counts divided by league participants.
- **Data Stories**: up to eight aggregated candidates covering low-owned starters, hit usage, top-10 ownership, high-owned bench risk, top-10 ownership bias, template size, formation popularity and total transfer activity. The studio accepts three or four selections and prevents a fifth selection.

The top-10 calculations use only aggregate player counts from the ten highest-ranked entries. Manager identities and raw squads are not written to disk.

## Limitations

- Picks remain private until the gameweek deadline.
- The FPL endpoints are public but undocumented and may change between seasons.
- The first version does not download new player photos. Missing photos remain editable in the studio.
- The Excel import remains available as a fallback and correction path.
