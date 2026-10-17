# Live public-league loading

## Why a proxy is required

Fantasy Premier League exposes the required classic-league, pick and transfer data without an API key after the gameweek deadline. Its responses do not include the CORS headers needed by a browser page hosted on GitHub Pages. Gameweek Data V2 therefore uses a small read-only proxy.

The proxy is not an open relay. It accepts only these official FPL route shapes:

- bootstrap data;
- fixture completion status for one gameweek;
- final live player points for a gameweek;
- classic-league standings;
- a manager's picks for one gameweek;
- a manager's public transfer history.

Aggregation happens in the visitor's browser. Raw manager IDs, manager names and squads are not written to the repository or proxy storage.

## Local QA

Use Node.js 18 or newer from the repository root:

```text
node scripts/fpl/dev-live-server.mjs
```

Then open:

```text
http://localhost:4174/app/gameweek-data-v2.html
```

The local server provides both the static project and the same-origin `/api/fpl` endpoint. The older static-only server on port 4173 can still load the bundled league snapshot, but it cannot retrieve a new league by itself.

## Public deployment

The production proxy is in `worker/fpl-api-proxy/`. To deploy it:

1. Sign in to Cloudflare.
2. Open a terminal in `worker/fpl-api-proxy/`.
3. Run `npx wrangler login`.
4. Run `npx wrangler deploy`.
5. Copy the generated HTTPS Worker URL into `config/runtime.js` as `fplProxyUrl`.
6. Commit and push that configuration only after verifying the Worker URL.

Cloudflare Workers has a free tier suitable for early testing, subject to Cloudflare's current limits. Firebase Authentication remains independent: Google sign-in identifies the user, while this proxy only reads public FPL data.

## Current limits and failure behavior

- Public classic leagues only.
- Up to 1,000 managers per league. Larger global leagues are rejected before the expensive picks and transfer stage.
- Picks are unavailable until the gameweek deadline. The interface reports: `Gameweek X has not started yet, league data is not available.`
- An invalid or private league reports that the League ID could not be found or is not public.
- FPL rate limits and temporary downtime are retried before the interface reports a connection error.
