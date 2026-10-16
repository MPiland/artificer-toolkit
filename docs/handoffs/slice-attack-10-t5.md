# Slice workbook: ATTACK-10.T5 (GM concealment projection and observer editor)

**Status:** CODE DONE, CI pending, live browser run pending (2026-10-15).
**Closes:** AC ATTACK-10.6. **Decision:** D116 (see [phase-08-2-decisions.md](phase-08-2-decisions.md)).
**Base:** `codex/phase-08-2-convex-cutover` at `851f6faf6`.

## What changed

- **Contract (new GM-only projection field).** `concealmentListingDtoSchema` (`packages/schema/src/shared/activeGrantListing.ts`): `{ effectId, concealmentTotal, observerActorIds }`. `encounterGmActorDtoSchema.concealment` is nullable with a `null` default; the stored Run actor state omits it (`encounterRunState.ts`) and the player actor contract (`encounterPlayerActorDtoSchema`) never had it.
- **Runtime.** `listConcealment(effects)` in `packages/rules-runtime/src/encounterConcealment.ts`, built on `encounterConcealmentOf`; `withActiveGrants` in `packages/encounter-persistence/src/nativeProjection.ts` fills it per actor (`null` for a COMPLETED Run).
- **UI.** `CampaignTabletopConcealmentObservers` in the turn-order drawer: "Hidden from X" / "Noticed by Y" with a Stop hiding or Hide button that sends `SET_CONCEALMENT_OBSERVERS` with the listed `effectId`.
- **Interpretation.** Set members are the observers the creature is hidden from; every other actor noticed it.

## Proof paths

| Criterion | Proof |
| --- | --- |
| The GM's projection carries each hidden creature's observers; a player's never does | `packages/rules-runtime/src/__tests__/encounterPlayerProjection.test.ts` ("gives the GM a concealment with its observers and gives no viewer but the GM any trace of it") |
| The room sends the GM the list and a player nothing, including the edit's commit | `apps/session-worker/test/nativeRoomHideAction.test.ts` ("who is shown the observers a hider is hidden from, in the room") |
| The GM lists, adds and removes observers; a player sees no list or control | `apps/web/src/domains/campaigns/vtt/CampaignTabletopEncounterDrawer.test.tsx` ("concealment observers (D116)") |
| Journey: the GM opens the creature, sees its observers and removes one; the player's table updates and shows nothing of it | `apps/web/tests/live-backend/encounterHide.ts` driven by `apps/apis/tests/developmentEncounterHide.ts`; run with `pwsh scripts/runLocalConvexProof.ps1 -Name <unique> -Proof hide-browser` (needs the local Convex deployment redeployed from this source, the Worker on 8787 and the web app on 3000) |

## Status log

- 2026-10-15: unit 7/7, room 24/24, web drawer 23/23 green in the light lane.
- 2026-10-15: pushed to `ci/attack-10-t5`.
- 2026-10-15: the `hide-browser` journey is written and registered (`runLocalConvexProof.ps1`, `validatePreStagingLocal.mjs` proof list, `developmentDrafts.ts --encounter-hide-browser`). It was **not run** in this workbook: it needs the shared local deployment redeployed and the Worker and web app started, which only the release runner or a heavy batch does, and another session held the heavy lock.
- 2026-10-15: independent read-only review (opus). Fixed: the journey searched player frames for public actor ids (now only the `"concealment"`/`"observerActorIds"` keys and the effect id); stale Convex goldens (`encounterProjectionParity`, `encounterStoreConformance` gain `"concealment": null` on GM actors); the visible button text now matches its accessible name ("Stop hiding"); the list is a labelled `<ul>`; dead fixture fields removed; docs corrected (the `omit` is on the stored Run actor state, the player contract never had the field). Stands: the player-drawer component test passes by data gate (the real guarantee is the projector and contract tests above).
