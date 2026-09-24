# Changelog

## Unreleased

- Added guarded current-gameweek loading to Gameweek Data with designed success/error messages and `file://` fallbacks.
- Added an eight-option pre-gameweek AI Stats selector that replaces Chip Usage with three or four chosen Data Stories, blocks a fifth selection, and supports restoring the original panel.
- Enlarged Data Stories labels, subjects, descriptions and values for clearer poster and export readability.
- Added two-hour Gameweek Data readiness checks plus aggregated differential, hits, top-10 ownership, bench-risk, formation and transfer-activity calculations.
- Added a final-result FPL synchronizer and manual GitHub Action for Gameweek Recap in league `507749`.
- Added automatic recap loading for podium, score summaries, League XI, Captain Returns and Top Gameweek Players; Spicy Stats remain editorial.
- Added a file-safe recap snapshot fallback so direct `file://` use does not depend on fetching local JSON.
- Corrected the Recap podium to use the overall league standings and cumulative points rather than gameweek-only scores.
- Made Recap draft saving resilient with IndexedDB storage and a Local Storage fallback, including large drafts with uploaded images.
- Added automatic two-hour recap readiness checks and a guarded Load button that alerts when the current gameweek is not final.
- Added a designed in-app success/error message that confirms which gameweek was loaded without using native browser alerts.
- Added automatic League XI total points, editable Spicy Stats value labels, larger Matchday story titles and a more readable Top 4 scoreboard.
- Added an approximately eight-option, data-driven AI Stats selector for Recap; users choose exactly three non-duplicative FPL insights while their manual Spicy Stats remain restorable.
- Added aggregated differential, transfer gain, bench pain, captain verdict and ownership-trap calculations to the Recap synchronizer.
- Added a keyless, privacy-conscious FPL Gameweek Data synchronizer for league `507749`.
- Added a manual GitHub Action that publishes aggregated gameweek snapshots.
- Added `Load latest FPL data` to Gameweek Data while retaining Excel import as a fallback.
- Reorganized the project into applications, assets, templates, documentation, imports, exports and legacy archive directories.
- Added a dedicated root home page for the three studios.
- Replaced machine-specific runtime paths with portable relative paths.
- Added user, import, deployment and AI-agent documentation.
- Updated Gameweek Data folder integration to use `imports/gameweek-data/` and `exports/gameweek-data/`.
- Added compatibility redirects so previously published studio URLs continue to work.
