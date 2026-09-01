# FPL Champions League Studio

A portable, browser-based studio for creating weekly Fantasy Premier League graphics.

## Available studios

- **Gameweek Data** — pre-deadline League XI, captaincy, transfers, chip usage and effective ownership. Supports Excel import.
- **Gameweek Recap** — post-gameweek podium, League XI, captain returns, scorecards and standout stories.
- **Top 3 Differentials** — three ranked low-owned recommendations, editorial reasoning and last-gameweek statistics.

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
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — local and GitHub Pages deployment.
- [`AGENTS.md`](AGENTS.md) — rules for AI coding agents.

## Repository rules

- Keep interface copy in English unless a feature explicitly supports Hebrew input.
- Use relative file paths so the complete folder can be moved or hosted unchanged.
- Do not commit generated PNG files or uploaded working workbooks.
- Do not push changes without the repository owner's explicit approval.
