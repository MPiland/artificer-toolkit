# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-05 (REL-5 done: V15 passed locally within the Q16 budgets; next is REL-4).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 189/281 criteria, 80 READY (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`; to update, write that to `data.json` in the session scratchpad, list the Artifact's files (`scope: files`), and publish with `files: {"data.json": <scratchpad>/data.json}`.
- **Slices (D80):** done means the slice's criteria are READY_FOR_ACCEPTANCE with a focused proof. At the boundary: commit; rewrite this file; set the slice and its `includes` done in [08-2-work-slices.json](../roadmap/08-2-work-slices.json); republish the dashboard; stop every background shell and agent; give the `/clear` line "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Rhythm:** code, then the compile gate (`local-validation/codex-batch/gate.ps1 -Name <gateN>`), then focused proofs (Convex `vt.ps1`; worker `src` via root `yarn vitest run --config vitest.config.ts <file>`; native `nt.ps1`). Convex changes: deploy locally before live proofs (codegen does not deploy).
- **V15 rerun:** `node local-validation/rel5/runV15.mjs <name> local-validation/rel5/<name>` under the validation lock (proof, then `scripts/v15Budgets.mjs`). Do not edit worker source during a run: wrangler dev hot-reloads it.
- **User:** a PM, not an architect. Make architecture calls yourself, explain them plainly and recommend.

## Just finished: REL-5 (V15)

[Validation record](../validation/phase-08-2/v15-workload-2026-10-05.md). Run a84: command p95 187 ms, preview p95 8.6 ms, convergence p95/p99 12/14 ms, 4.44 MB Convex I/O per modelled session against 4.51 MB. V15.1–V15.3 READY; V15.4 (managed) waits for VS-10.

- D90 is current: save points replace the flush interval (ADR 0035 Amendments 25–31, A35-S11a–j).
- Amendment 31: every checkpoint publishes inline (staged route and upload tables removed; proof renamed `checkpoint-large`), and the room streams 4 MiB journal pages into one fold, so a fight's save is one checkpoint (about 750 KB).
- Budget headroom is about 1.6%. The estimate scales COMPLETE by commands per fight. More commands or chat per fight exceeds it.

## Next: REL-4, then VS-9

1. **REL-4** (last open part of VS-8): local reset, seed and `convex deploy`; fix `seed:srd:convex:local` on Docker; run the Scene authoring, lifecycle and Drafts movement dev scripts and the journeys. Cover PLT-8's "Show to players" menu and player modal there, or with a Storybook story. Then mark VS-8 done.
2. **REL-8** Dependency refresh to latest (agreed with the user), before the pre-staging lifecycle.
3. **VS-9:** REL-6 final local proof (`yarn validate:pre-staging:local`, which also runs the renamed `checkpoint-large` proof, never run since the rename), R01–R05 audits.

## Follow-ups (carried)

- Room: pending commands are resent on a scene-less STATE_SYNC; worker teardown noise "no such table: durable_session_authority"; the fold at COMPLETE is synchronous (about 15 MB raw per fight). Previews during the save window are unmeasured.
- Convex cost: trigger `wrapDB` amplification; `roomInputs:read` frequency; `authority:release` reads about 157 KB; uncached `campaignScenes` in `requireScope`; REINFORCE history rows hold a full actor copy.
- Correctness: Convex does not check that snapshot rows exist at checkpoint; `characterActiveRuleEffects` can name a deleted `maintainedEffectStateId`; evidence checksum at carry; fog `previousLayer` bound.
- Web: `CampaignVttStage` renderer effect uses a stale `mapDelivery.onMapLoadStatus` closure; the `SocialInvitationsView.stories.tsx` convexQuery key; the Campaign Prepare view opens its own summary socket while a table runs (decide with per-panel socket merging).
- Tests and tooling: lint `no-unsafe-finally` at `developmentReceiptLedgers.ts:287`; `nativeRoomAdmission` lease flake; the "trims a journal page" test is slow in parallel; managed E2E spec unrun; dev-marker duplication; reset backup zips to prune; `typecheck:config` at `tests/live-backend/encounterMovement.ts:589`.
- From S10b/PLT-7: merge `manageNotes` and `contributeSessionNotes`; check client re-subscribe after a challenge; confirm the worker's `CONVEX_SITE_URL` matches the JWT issuer.

**Later:** VS-10 (staging and production, with the managed V15.4 run; needs approval). RUL-9 slices are Phase 8.3 scope.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
