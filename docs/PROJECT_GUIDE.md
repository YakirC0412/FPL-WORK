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
| `assets/players/` | Default player and club images. |
| `assets/examples/` | Visual references only; never runtime dependencies. |
| `assets/generated/` | Generated asset bundles. Do not hand-edit large data URLs. |
| `templates/` | Official downloadable input templates. |
| `imports/gameweek-data/` | Latest user workbook when folder permission is granted. Ignored by Git. |
| `exports/` | Generated graphics grouped by feature. Ignored by Git. |
| `docs/` | Human and technical documentation. |
| `scripts/` | Local launch helpers. |
| `archive/legacy/` | Historical files retained for reference but not loaded by the live site. |

## Applications

### Gameweek Data

File: `app/gameweek-data.html`

Pre-deadline graphic driven primarily by the official Excel workbook. It contains the League XI, Captain Picks, Popular Transfers, Chip Usage and Effective Ownership. Player photos are assigned separately in the editor.

### Gameweek Recap

File: `app/gameweek-recap.html`

Post-gameweek graphic with draft management, podium layouts, score summaries, League XI, Captain Returns or Top Players, and up to three Spicy Stats.

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

Each studio has its own browser storage keys. Working state and drafts are not repository files. Storage is tied to the browser origin, which means a local file, the local HTTP server, GitHub Pages and a future custom domain are separate storage locations.

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
8. Update the related documentation.

## Known future improvements

- Export/import all drafts and uploaded images as a portable project backup.
- Move CDN libraries and fonts into a local `vendor/` directory for full offline support.
- Extract shared navigation, palette and export utilities after automated regression coverage exists.
- Normalize all legacy player asset filenames without changing display names.
