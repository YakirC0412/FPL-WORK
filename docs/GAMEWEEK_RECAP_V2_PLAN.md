# Gameweek Recap V2 rebuild

## Goal

Rebuild Gameweek Recap with the same public workflow as Gameweek Data V2 while keeping `app/gameweek-recap.html` available as the private legacy editor.

## Locked product decisions

- Google or named Guest access before loading a league.
- Any public classic league with up to 1,000 managers.
- Larger global leagues are rejected before manager-level requests.
- No draft database in the first release.
- Local drafts with single-draft and all-drafts JSON download and restore.
- Automatic FPL player images only.
- Desktop and mobile editing plus 3240 × 4050 PNG export.

## Implemented foundation

1. `app/gameweek-recap-v2.html` is a separate route; the legacy route is unchanged.
2. Live recap aggregation uses standings, picks, transfers and final gameweek player points.
3. The route reuses Google/Guest authorization, arbitrary public-league loading and a progress transition.
4. Drafts use Local Storage plus current-draft/all-drafts JSON download and JSON restore. IndexedDB and cloud draft storage are not used.
5. Gameweek Data V2 links to Summary V2 and passes the selected League ID.
6. The public homepage, authorization, league loading and product selection remain unified in Gameweek Data V2; Summary opens directly from that selection without a second login step.
7. Summary uses the same slide-out draft drawer and the same five brand palettes as Gameweek Data V2.
8. Spicy Stats begin as a preview skeleton and appear only after the user chooses `Generate Spicy Stats` and selects three verified stories.

## Remaining public-release work

1. Rebuild the Summary editor into the same Focus, Preview-only and mobile Edit/Preview navigation system as Gameweek Data V2.
2. Complete hands-on mobile and HQ PNG export QA.
3. Deploy the read-only proxy and configure `config/runtime.js` before public hosting.

The shared proxy permits the final gameweek live-points and fixture-status routes required by the recap calculation. The loader first trusts FPL's final flags, then safely falls back to checking that every fixture is finished and ranked results exist when those flags are delayed. The proxy remains a strict read-only FPL endpoint allowlist.
