# FPL player image synchronization

## Purpose

Gameweek Data and Gameweek Recap use a shared local player-image library. The user does not need to upload the same player photos each week. Top 3 Differentials is intentionally outside this integration.

## Sources and generated files

The synchronizer reads player metadata from the public FPL `bootstrap-static` endpoint and discovers the current transparent-PNG base URL from the official FPL web application bundle.

Run locally with:

```text
node scripts/fpl/sync-player-images.mjs
```

Use `--refresh` to conditionally recheck previously downloaded images. The command writes:

- `assets/fpl-players/{code}.png` — same-origin transparent player images.
- `assets/fpl-players/placeholder.png` — official fallback.
- `data/players/manifest.json` — machine-readable player metadata.
- `data/players/manifest.js` — direct `file://` browser fallback.

The **Sync FPL Player Images** GitHub Action runs weekly and can also be started manually. It commits only changed player images and manifests.

## Matching rules

Each manifest record contains the FPL element ID, stable player code, full name, web name, team and normalized aliases. The browser resolves a saved stable code first and only falls back to a name when that name identifies exactly one player. This prevents two players with the same name from receiving the wrong image.

Player-name fields in Gameweek Data and Gameweek Recap provide autocomplete results with the player's FPL display name, full name, photo and team abbreviation. Selecting a result stores both the display name and stable player code. Keyboard selection is supported with the arrow keys and Enter. Free text remains allowed, but an ambiguous name is intentionally not auto-matched until the user selects the intended player.

The file name uses the stable numeric code rather than the display name. Names can change and may collide; the manifest provides the human-readable mapping.

## Fallback order

1. Available synchronized image selected by stable player code from `assets/fpl-players/`.
2. Existing manual or legacy project image.
3. Official FPL placeholder when the CDN has not published the player image yet.

Direct hotlinking is not used in the studios because the official image CDN does not provide the cross-origin headers required by reliable canvas/PNG export. Keeping the cache under the same GitHub Pages origin avoids a tainted canvas.

## Season maintenance

The official image path contains a season-specific directory. The script discovers the active path from the current FPL JavaScript bundle instead of hardcoding it. At a season rollover, run the workflow once and review any players temporarily mapped to the placeholder.
