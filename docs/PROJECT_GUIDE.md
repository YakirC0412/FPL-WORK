# Project Guide

## Product purpose

FPL Champions League Studio creates consistent weekly graphics for a private Fantasy Premier League community. It is a static website with no build step and no backend. Each studio is currently implemented as a self-contained HTML application.

## Official entry point

`index.html` is the home page and the only official entry point. It links to all three studios inside `app/`.

The three historical `*_Mockup_v1.html` files in the repository root are compatibility redirects. They preserve existing bookmarks and published GitHub Pages links but contain no application logic.

## Folder map

| Path | Purpose |
| --- | --- |
| `app/` | The three active browser applications. |
| `assets/brand/` | League logo and future brand assets. |
| `assets/players/` | Legacy/default player and club images used as fallbacks. |
| `assets/fpl-players/` | Automatically synchronized official FPL player PNG cache. |
| `data/players/` | Player manifest with stable codes, names, aliases and local image paths. |
| `assets/examples/` | Visual references only; never runtime dependencies. |
| `assets/generated/` | Generated asset bundles. Do not hand-edit large data URLs. |
| `config/` | Public integration settings such as the FPL league ID. |
| `data/gameweeks/` | Aggregated, publishable FPL Gameweek Data snapshots. Raw manager data is not stored. |
| `data/recaps/` | Final recap snapshots. Stores only the manager/team display names required by the recap graphic. |
| `templates/` | Official downloadable input templates. |
| `imports/gameweek-data/` | Latest user workbook when folder permission is granted. Ignored by Git. |
| `exports/` | Generated graphics grouped by feature. Ignored by Git. |
| `docs/` | Human and technical documentation. |
| `scripts/` | Local launch helpers. |
| `archive/legacy/` | Historical files retained for reference but not loaded by the live site. |

## Applications

### Gameweek Data

File: `app/gameweek-data.html`

Post-deadline graphic driven primarily by an aggregated public FPL snapshot. It contains the League XI, Captain Picks, Popular Transfers, Chip Usage and Effective Ownership. The guarded loader confirms which active gameweek was loaded and reports when post-deadline data is unavailable. A data-driven selector offers up to eight aggregated league insights; the user selects three or four to replace Chip Usage temporarily, and can restore the original panel. Excel remains available as a fallback and correction path. Player photos resolve automatically through the shared player manifest; manual upload remains only as a fallback.

The synchronization logic is in `scripts/fpl/sync-gameweek-data.mjs`, the public league setting is in `config/fpl.json`, and the scheduled/manual GitHub workflow is `.github/workflows/sync-gameweek-data.yml`. JSON and JavaScript fallback snapshots plus readiness status files are published under `data/gameweeks/`. See `docs/FPL_DATA_SYNC.md` for calculation and privacy rules.

### Gameweek Data V2

File: `app/gameweek-data-v2.html`

The public-release redesign is developed on this separate route. It is intentionally not linked from `index.html` while it is under development. The legacy Gameweek Data application remains unchanged and continues using its existing browser storage. V2 uses separate Local Storage and IndexedDB identifiers, so its working state, saved drafts and remembered folder permission cannot overwrite the legacy editor's data. Player images in V2 are supplied only by the synchronized FPL image library; the public editor does not expose player-photo upload or replacement controls. League branding starts with a neutral studio crest, while Brand & Setup lets the user explicitly keep that default or upload a custom PNG, JPG or WebP league logo. V2 opens with a single-screen FPL League Graphics Studio overview, a subtle neutral lion watermark and a five-scene walkthrough showing league loading, League XI creation, quick data editing, Data Stories selection and final export. A separate five-stage progress transition runs after the League ID is submitted. Once loading succeeds, the user chooses Gameweek Data or sees Gameweek Summary marked as coming soon; the editor no longer opens before this choice. From the editor, `Load different league` returns to this screen without navigating to the legacy home page. Desktop users can switch between Focus, Full workspace and Preview-only modes; the selected mode is remembered locally. Mobile uses dedicated Data, Edit, Preview and Drafts views. Tapping a poster panel in mobile Preview opens its matching editor section, while loading a league or saved draft returns to Preview. Data Stories is the default lower panel. Until the user selects three or four stories, the poster displays a `Loading Design` skeleton. Chip Usage appears as a secondary editor option with a warning that enabling it replaces Data Stories; switching back restores either the completed stories or their skeleton state. The current static preview can validate and open only the league represented by the synchronized snapshot; support for arbitrary public leagues requires a multi-league synchronization service.

The landing-page title is intentionally placed outside the bordered workflow card and uses a matchday-style two-part treatment so the studio identity remains visually separate from the loading controls.

On mobile, Export is available directly from the persistent workspace navigation. After the 3240 × 4050 PNG is rendered, supported browsers show a native share option suitable for WhatsApp and other apps plus a download fallback. Browsers without file sharing receive the download option only. Desktop keeps its existing project-folder or browser-download behavior.

### Gameweek Recap

File: `app/gameweek-recap.html`

Post-gameweek graphic with draft management, podium layouts, score summaries, League XI, Captain Returns or Top Players, and up to three Spicy Stats.

The final-result synchronizer is `scripts/fpl/sync-gameweek-recap.mjs`, and its manual workflow is `.github/workflows/sync-gameweek-recap.yml`. It only accepts gameweeks marked both finished and data-checked by FPL. Spicy Stats remain editorial and are preserved when synchronized data is loaded.

### Player image library

Files: `scripts/fpl/sync-player-images.mjs`, `data/players/manifest.json`, `data/players/manifest.js`, `assets/player-media.js`, `assets/fpl-players/`

The image synchronizer reads every current FPL player, discovers the image base used by the official FPL web application, caches available transparent PNG files and publishes a manifest keyed by both stable player code and normalized name aliases. Gameweek Data and Gameweek Recap load the same manifest. Their player fields use a shared autocomplete list showing the full name and team abbreviation; the selected stable code disambiguates duplicate names. Ambiguous free text is never assigned to the first matching player automatically. The scheduled workflow is `.github/workflows/sync-player-images.yml`. Players whose official image is not yet available use the official placeholder or an existing legacy image until a later synchronization succeeds.

### Top 3 Differentials

File: `app/top-3-differentials.html`

Three equal-height recommendation cards with player image, club crest, ownership, price, free editorial copy and four last-gameweek metrics. The editorial paragraph supports automatic Hebrew direction.

## Runtime dependencies

The applications currently load some resources from public CDNs:

- Google Fonts
- `html2canvas` for PNG export
- SheetJS for Excel parsing in Gameweek Data
- Hugging Face Transformers and the MODNet model when background removal is requested

The site therefore works best with an internet connection. Default player and logo images are available locally, and selected images are also bundled in `assets/generated/embedded-assets.js` to make canvas export more reliable.

## Browser storage

Each studio has its own browser storage keys. Working state and drafts are not repository files. Recap drafts use IndexedDB with a Local Storage backup so larger uploaded images do not exhaust the smaller Local Storage quota. Storage is tied to the browser origin, which means a local file, the local HTTP server, GitHub Pages and a future custom domain are separate storage locations.

Moving the folder or changing the website address does not migrate drafts. A future project backup feature should export and import drafts as JSON.

## File-path rules

- Runtime links must be relative to the current HTML file.
- Do not use machine-specific paths such as `C:\Users\...`.
- Do not use repository-name-specific root URLs such as `/FPL-WORK/...`.
- Files under `archive/legacy/` must never be referenced by the active applications.
- Display names may contain spaces and accents; new asset filenames should prefer simple lowercase ASCII names.

## Change checklist

1. Open the root home page through HTTP.
2. Open all three studios from the home page.
3. Confirm every Home button returns to `index.html`.
4. Check the browser console for missing files or JavaScript errors.
5. Test at least one draft save in the affected studio.
6. Test PNG export at the intended high-resolution dimensions.
7. If Gameweek Data changed, test the official Excel template.
8. If FPL synchronization changed, run it against league `507749`. Confirm that Gameweek Data stores no manager IDs or raw roster fields, and Recap stores only the display names required by the final graphic.
9. Update the related documentation.

## Known future improvements

- Export/import all drafts and uploaded images as a portable project backup.
- Move CDN libraries and fonts into a local `vendor/` directory for full offline support.
- Extract shared navigation, palette and export utilities after automated regression coverage exists.
- Normalize all legacy player asset filenames without changing display names.
