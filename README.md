# FPL Champions League Studio

A portable, browser-based studio for creating weekly Fantasy Premier League graphics.

## Available studios

- **Gameweek Data** — post-deadline League XI, captaincy, transfers, chip usage and effective ownership. Supports guarded current-gameweek loading, selectable data-driven stories and Excel as a fallback.
- **Gameweek Recap** — final-gameweek podium, League XI, captain returns, scorecards and standout stories. Supports synchronized FPL league results while keeping Spicy Stats editorial.
- **Top 3 Differentials** — three ranked low-owned recommendations, editorial reasoning and last-gameweek statistics.

## Gameweek Data V2 development route

The existing Gameweek Data studio remains available at `app/gameweek-data.html`. Public-release work is developed separately at `app/gameweek-data-v2.html` so the legacy editor and its saved browser drafts remain unchanged. V2 currently has its own working-state, draft and remembered-folder storage identifiers, offers a neutral default league crest or a custom league-logo upload, and is not linked from the public home page yet. Its entry screen presents the wider FPL League Graphics Studio, loads the league once and then asks the user to choose Gameweek Data; Gameweek Summary remains visibly marked as coming soon.

V2 mobile export renders the same 3240 × 4050 PNG as desktop, then offers the phone's native share sheet when file sharing is supported or a standard PNG download when it is not.

Gameweek Data and Gameweek Recap use an automatically synchronized FPL player-image library. Player codes are kept in the synchronized snapshots, while normalized name aliases allow an edited player name to resolve to the correct local image without a manual upload.

## Start the project

### Published website

Open [FPL Champions League Studio on GitHub Pages](https://yakirc0412.github.io/FPL-WORK/). The root `index.html` is the only official entry point.

### Windows local mode

Run `scripts/start-local.bat`. It starts a small local server at `http://127.0.0.1:4173/` and opens the home page.

Python must be installed and available as `py` or `python`. Opening the HTML files directly with `file://` is not recommended because browser security restrictions can break Excel loading and PNG export.

## Important data note

Drafts and uploaded images are stored in the current browser through Local Storage or IndexedDB. They do not automatically move to another browser, device, domain or computer. PNG exports and imported workbooks should be kept separately.

## Project documentation

- [`docs/PROJECT_GUIDE.md`](docs/PROJECT_GUIDE.md) — architecture, folder map and product behavior.
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — user workflow in Hebrew.
- [`docs/DATA_IMPORT.md`](docs/DATA_IMPORT.md) — Excel workbook schema.
- [`docs/FPL_DATA_SYNC.md`](docs/FPL_DATA_SYNC.md) — public FPL connection and aggregation rules.
- [`docs/FPL_RECAP_SYNC.md`](docs/FPL_RECAP_SYNC.md) — final-result recap synchronization and calculation rules.
- [`docs/FPL_PLAYER_IMAGES.md`](docs/FPL_PLAYER_IMAGES.md) — player-image library, manifest and automatic matching rules.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — local and GitHub Pages deployment.
- [`AGENTS.md`](AGENTS.md) — rules for AI coding agents.

## Repository rules

- Keep interface copy in English unless a feature explicitly supports Hebrew input.
- Use relative file paths so the complete folder can be moved or hosted unchanged.
- Do not commit generated PNG files or uploaded working workbooks.
- Do not push changes without the repository owner's explicit approval.
