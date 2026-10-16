# Slice workbook: ATTACK-10.T5 (GM concealment projection and observer editor)

**Status:** DONE (2026-10-16): CI green on both workflows; the live Hide browser journey passed ([record](../validation/attack-10-t5-hide-browser-2026-10-16.md)).
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

- 2026-10-16: the `hide-browser` journey ran and **passed** against the local container (`scripts/runLocalBrowserProof.mjs`, evidence in [the validation record](../validation/attack-10-t5-hide-browser-2026-10-16.md)). Driver fix found by the live run: `developmentEncounterHide.ts` looked for Hide in `actions`; the standard Hide is in `basicActionChoices`.
- 2026-10-16: local-data repair (the migration). ATTACK-10.T1 commit `0009dd7b7` changed a stored shape (`systemVocabularySnapshots`, a required field) without migrating development data, and the canonical corpus had changed; the stored snapshot made the deploy fail schema validation and the seed throw "Canonical content conflict.". The repair was `scripts/resetLocalConvex.ps1` (reset, then deploy, seed and republish). Backups: `local-validation/convex-reset/attack-10-t5-vocab-repair.before.zip` (the `.after.zip` was not produced: the seed failed) and `attack-10-t5-reset.before.zip` / `attack-10-t5-reset.after.zip`.
- A reseed after a corpus change will stop needing a reset once PLATFORM-18.T1 lands.
- Environment findings recorded in the runbook: the local deployment's `LIVE_SESSION_WORKER_URL` must be `http://host.docker.internal:8787` (it was `127.0.0.1`, unreachable from the bridge container, now set), and the proof's evidence folder name must be short in a worktree (Windows path limit on the Worker's durable-object state).
- Tooling shipped with the proof: `scripts/runLocalBrowserProof.mjs` (one proof, optional `--deploy`, never resets) and the shared `convexDeployArguments` in `scripts/convexSelfHosted.mjs`, used by the runner, the live-backend script and the single-proof runner.

