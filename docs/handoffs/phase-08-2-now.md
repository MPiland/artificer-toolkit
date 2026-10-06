# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-06 (REL-4 done, VS-8 closed; next is REL-8, then VS-9).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 189/281 criteria, 80 READY (`node scripts/acceptanceProgress.mjs`). REL-4 closed no new criteria; it added evidence to READY ones (P14.7, V07.1, R06.4).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`; to update, write that to `data.json` in the session scratchpad, list the Artifact's files (`scope: files`), and publish with `files: {"data.json": <scratchpad>/data.json}`.
- **Slices (D80):** done means the slice's criteria are READY_FOR_ACCEPTANCE with a focused proof. At the boundary: commit; rewrite this file; set the slice and its `includes` done in [08-2-work-slices.json](../roadmap/08-2-work-slices.json); republish the dashboard; stop every background shell and agent; give the `/clear` line "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Rhythm:** code, then the compile gate (`local-validation/codex-batch/gate.ps1 -Name <gateN>`), then focused proofs (Convex `vt.ps1`; worker `src` via root `yarn vitest run --config vitest.config.ts <file>`; native `nt.ps1`). Convex changes: deploy locally before live proofs (codegen does not deploy).
- **V15 rerun:** `node local-validation/rel5/runV15.mjs <name> local-validation/rel5/<name>` under the validation lock (proof, then `scripts/v15Budgets.mjs`). Do not edit worker source during a run: wrangler dev hot-reloads it. Last passing run: a84 ([record](../validation/phase-08-2/v15-workload-2026-10-05.md)).
- **User:** a PM, not an architect. Make architecture calls yourself, explain them plainly and recommend.

## Done in REL-4

Evidence: `local-validation/rel4/` (j2 full 49-proof run plus reruns; t10), `local-validation/local-convex-proofs/t10-vtt-browser` (authoritative p95 833 ms, rule-bound Sheet convergence p95 869 ms, durable p95 87 ms, ephemeral p95 37 ms), Storybook stories `GmShowsSceneToPlayers` and `PlayerSeesShownScene` (PLT-8). Product fixes:

- **Room input revisions:** held parts return restamped revisions (`roomInputs` `#current`); Character parts no longer carry a PLAY revision (`apps/apis/convex/liveSessions/roomInputs.ts`). Fixed "Live rules revision changed during preparation".
- **Admission expiry:** commit-time expiry is a retryable UNAVAILABLE "try again" (`RoomAdmissionExpiredError`, all fences, nothing written). Convex Encounter writes bump PLAY without INVALIDATE, so the strict fence is correct; the dev client resends ([live-sessions.md](../architecture/live-sessions.md)).
- **D74 read degradation:** a room-held Run's unassigned actor reads frozen at play values (`characterStates` `readCampaignCharacterAssignment` plus the `isRoomHeldRun` port). Scene vision skips frozen or unassigned bound actors, so activation never fails on a departed player.
- **Binding refusals** are domain rejections (VERSION_STALE, SCENE_NOT_PRESENTED, GM_ONLY, PENDING_DECISION, TARGET_UNAVAILABLE).
- **Web:** auth token fetch retry ([transport.md](../architecture/transport.md)); facet EQUIPMENT ALL-mode options (Class re-activation); `AuthoredListPage` grid row; controlled Spells accordion; PLT-8 stories.
- **Dev fixtures:** receipt-ledger seed as an internalAction; bounded fixture cleanup; `vtt-browser` cleans up while its Worker runs (`MANAGED_VTT_CLEANUP_SIGNAL` handshake).
- **Proofs updated** for D47/D75/D85/D87/D88/D90/ADR 0030 (checkpoint barrier `awaitCampaignCheckpoint`; held reads via the room; navigation-abort tolerance judged on a later main-frame commit). ADR 0030's Session-finish sentence is corrected to ADR 0033.
- **Local env:** the local Convex `CONTENT_SNAPSHOT_TOKEN_SECRET` had a trailing CR and was re-set (64 chars).

## First in the next session (before REL-8 work)

- D74 command-time paths: `roomSceneGeometryCommand` (`prepareCharacter` on token drag) and `roomEncounterTurnCapture` (ACTOR/EFFECTS) can still throw for a departed actor; apply the same frozen/unassigned rule as `roomSceneVision`.
- Remove the unused `disarm-receipts` op in `apps/apis/tests/developmentCli.ts` and `developmentCliEntry.mjs`.
- A separate task chip exists to remove the unused Convex `encounters/sceneBindings:bind` mutation.

**Known risks:** `campaign-collaboration-browser` and `campaign-membership-browser` are flaky under load (varied one-off failures: log-collector baseline, click interception, a 1 s local Convex function timeout, an 8.5 s `auth:onCreate` HTTP failure; `developmentCli` now records `httpStatus`). No single run had every journey green. Two FAILED fixture Campaign deletion jobs remain in the local backend; the VS-9 reset clears them. `local-validation/rel4/runProofs.mjs` and `journeys.ps1` are disposable drivers (ignored folder).

## Next: REL-8, then VS-9

1. **REL-8** Dependency refresh to latest (agreed with the user), before the pre-staging lifecycle. The TanStack upgrade's Storybook breakage belongs here.
2. **VS-9:** REL-6 final local proof (`yarn validate:pre-staging:local`, which also runs the renamed `checkpoint-large` proof), R01–R05 audits.

## Follow-ups (carried)

- Room: pending commands are resent on a scene-less STATE_SYNC; worker teardown noise "no such table: durable_session_authority"; the fold at COMPLETE is synchronous (about 15 MB raw per fight). Previews during the save window are unmeasured. V15 budget headroom is about 1.6% (REL-5, D90).
- Convex cost: trigger `wrapDB` amplification; `roomInputs:read` frequency; `authority:release` reads about 157 KB; uncached `campaignScenes` in `requireScope`; REINFORCE history rows hold a full actor copy.
- Correctness: Convex does not check that snapshot rows exist at checkpoint; `characterActiveRuleEffects` can name a deleted `maintainedEffectStateId`; evidence checksum at carry; fog `previousLayer` bound.
- Web: `CampaignVttStage` renderer effect uses a stale `mapDelivery.onMapLoadStatus` closure; the `SocialInvitationsView.stories.tsx` convexQuery key; the Campaign Prepare view opens its own summary socket while a table runs (decide with per-panel socket merging).
- Tests and tooling: lint `no-unsafe-finally` at `developmentReceiptLedgers.ts:287`; `nativeRoomAdmission` lease flake; the "trims a journal page" test is slow in parallel; managed E2E spec unrun; dev-marker duplication; reset backup zips to prune; `typecheck:config` at `tests/live-backend/encounterMovement.ts:589`.
- From S10b/PLT-7: merge `manageNotes` and `contributeSessionNotes`; check client re-subscribe after a challenge; confirm the worker's `CONVEX_SITE_URL` matches the JWT issuer.

**Later:** VS-10 (staging and production, with the managed V15.4 run; needs approval). RUL-9 slices are Phase 8.3 scope.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
