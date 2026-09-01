# Instructions for AI Coding Agents

Read `README.md` and `docs/PROJECT_GUIDE.md` before modifying this repository.

## Product constraints

- This is a static browser application with no build step and no backend.
- Active applications live in `app/`; files in `archive/legacy/` are reference-only.
- Keep interface copy in English unless the feature explicitly supports Hebrew content.
- Preserve the 1080 × 1350 poster canvas and high-resolution export behavior unless the owner requests another format.
- Keep all runtime paths relative so the complete directory remains portable.
- Never introduce a machine-specific absolute path or a GitHub repository-name-specific root path.

## Change discipline

- Do not push, publish or deploy without explicit approval from the repository owner.
- Do not delete legacy or user-generated files unless deletion is explicitly approved.
- Preserve existing user changes and browser-storage compatibility whenever possible.
- Treat `assets/generated/embedded-assets.js` as generated output; do not manually edit its base64 payload.
- If an asset path changes, update every active application and test for missing resources.
- If the Excel schema changes, update the template and `docs/DATA_IMPORT.md` in the same change.
- If behavior or folder structure changes, update `README.md` and `docs/PROJECT_GUIDE.md`.

## Required verification

Serve the repository over HTTP and verify the home page, all navigation, local resources, affected draft saves, affected PNG exports and Excel import when Gameweek Data changes. Report any test that could not be completed; never describe untested behavior as verified.
