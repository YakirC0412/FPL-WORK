# FPL Champions League Studio

A portable, browser-based studio for creating weekly Fantasy Premier League graphics.

## Available studios

- **Gameweek Data** — post-deadline League XI, captaincy, transfers, conditional chip usage and effective ownership. Supports guarded current-gameweek loading, a dedicated selectable Data Stories panel and Excel as a fallback. Non-zero chip usage appears as a compact line beneath Popular Transfers and stays hidden when every chip is unused.
- **Gameweek Recap** — final-gameweek podium, League XI, captain returns, scorecards and standout stories. Supports synchronized FPL league results while keeping Spicy Stats editorial.
- **Top 3 Differentials** — three ranked low-owned recommendations, editorial reasoning and last-gameweek statistics.

## Gameweek Data V2 development route

The existing Gameweek Data and Gameweek Recap studios remain available at `app/gameweek-data.html` and `app/gameweek-recap.html`. Public-release work is developed separately at `app/gameweek-data-v2.html` and `app/gameweek-recap-v2.html`, so the private legacy editors and their saved browser drafts remain unchanged. The V2 entry flow can load any supported public classic-league ID with up to 1,000 managers through the live read-only proxy, then opens either Gameweek Data or the completed-gameweek Summary editor. Summary V2 accepts FPL's official final flags or independently confirms that every fixture is finished and ranked results are available; this avoids false negatives when FPL updates its event flags late. On desktop, the official Excel workbook remains an explained Gameweek Data fallback; Excel controls are hidden on mobile. Local and Cloudflare deployment instructions for the live loader are in `docs/LIVE_LEAGUE_API.md`.

V2 mobile export renders the same 3240 × 4050 PNG as desktop, then offers the phone's native share sheet when file sharing is supported or a standard PNG download when it is not.

V2 keeps the studio title, product summary and animated walkthrough visible on entry. A compact access panel underneath offers **Continue with Google**, using Firebase Authentication and the official multicolor Google mark, or **Continue as guest**, which asks only for the user's name. After either path succeeds, the league loader expands downward on the same page. Without Firebase configuration the Google path explains that setup is required and guest mode remains available. Firebase sessions persist across reloads after sign-in. The GitHub Pages deployment uses popup authorization by default because cross-origin redirect helpers are restricted by modern browser storage policies. Google sign-in currently establishes identity only. No draft database is used: drafts are stored per league and gameweek in the current browser, while users can download the current draft or all drafts as portable JSON and restore either format later. Setup instructions are in `docs/GOOGLE_AUTH_SETUP.md`.

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
