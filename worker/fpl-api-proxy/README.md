# FPL API proxy

The browser cannot call the public Fantasy Premier League endpoints directly because those responses do not include browser CORS headers. This small Cloudflare Worker exposes only the four read-only FPL routes needed by Gameweek Data V2.

## Deploy

1. Create or sign in to a Cloudflare account.
2. From this directory run `npx wrangler login` and then `npx wrangler deploy`.
3. Copy the resulting `https://...workers.dev` URL into `config/runtime.js` as `fplProxyUrl`.
4. Add any additional website origin to `ALLOWED_ORIGINS` in `wrangler.toml` before deploying again.

The Worker stores no manager data. Aggregation happens in the visitor's browser. The free Workers plan is suitable for initial testing, subject to Cloudflare's current limits.

## Local QA

From the repository root run `node scripts/fpl/dev-live-server.mjs`, then open:

`http://localhost:4174/app/gameweek-data-v2.html`
