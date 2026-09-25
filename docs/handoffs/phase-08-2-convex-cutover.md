# Phase 8.2 Convex cutover handoff

**Status:** active; S0–S3, S4A and the S5 Convex half committed locally; S4–S7 remainder in progress (see Current progress).  
**Updated:** 2026-09-24 (later session).  
**Workspace:** regular `D:/dev/artificer-toolkit` checkout on `codex/phase-08-2-convex-cutover`. The detached `.codex/worktrees/phase-08-2-convex-cutover` remains a read-only backup. The relocation is committed (`85443906`); later slices are separate commits. No phase completion is claimed.

## Current progress (2026-09-24, later session)

The approved completion plan runs S0–S7: checkpoint, code-quality groundwork, continuation secret, Campaign-owned play (ADR 0033), R06 room dispatch, security hardening, gameplay rules, final proof. Done and committed locally on this branch:

- **S0:** checkpoint of Codex's previously untracked relocation.
- **S1:**
  - Shared guards; one `stateHttp` route factory; aliases and dead code removed.
  - Worker route table `callLiveSessionRoute`, with `LIVE_SESSION_ROUTE_PATHS` shared with Convex `http.ts`.
  - Pure `planLiveSceneCommand` extracted from the room.
  - Test fixtures consolidated.
- **S2:** dedicated `RULES_CONTINUATION_SECRET` with `deriveRulesContinuationKey` (v2 label).
- **Cleanup:**
  - Deleted the stale `packages/db` corpus copy and the orphaned rule-path manifest.
  - `AGENTS.md` and the docs corrected (link check clean).
  - Dead `campaigns/inventoryPurge` removed; the ADR 0032 deletion job already purges all of its tables.
- **S3 ([ADR 0033](../adr/0033-campaign-owned-play-and-session-log.md)):**
  - Campaign-keyed live table, presentation, tickets (v2) and Encounter Runs; `PLAY` revision scope.
  - Session finish no longer touches play.
  - `campaigns/playMigrations.ts` migrates development rows.
  - Web tabletop is at `/tabletop/campaigns/$campaignPublicId`, with a Campaign encounter panel and PREPARED Run deletion.
  - Acceptance amended with the user's approval: P15, V05, V08, V09, V14 and F12 reopened, count 59/75.
- **Deployability fixes found by the first real codegen push:** both defects were pre-existing.
  - `encounterMovement:begin` declared union arguments; Convex requires an object.
  - Worker-boundary capture/commit modules exceeded Convex's 64 MB module-load budget (`encounterRulesCapture` needed 65.8 MB). They now validate with their Zod contracts in the handler behind `args: v.any()` and use about 30 MB. See [live-session coordination](../architecture/live-sessions.md).

Validation at the S3 commit:

- Full Convex suite: 624 files, 2,095/2,095 tests.
- Schema 449/449, Worker 70/70, focused web tests.
- apis/worker/schema/shared/rules-runtime/web typechecks.
- Local codegen push against `phase82-convex-local-linux`.

Rule from here on: run a local codegen push for every slice that touches Convex (see `AGENTS.md` validation guidance), and serialize compiler/test runs with the validation lock described in `AGENTS.md`.

- **S6 rules (partial):** carried weapons count as drawn unless an action requires equipping; pure shield-conflict evaluator (`encounterWieldConflict.ts`).
- **S4A, single Encounter command door:**
  - Every Encounter command enters through the room (`ENCOUNTER` command scope). The room runs the DO planners for actions, turns and concentration and forwards everything else, or anything a planner marks `LivePlannerUnsupportedError`, to Convex through the private `encounterCommand` route. The private `encounterRoute` route classifies pending decisions with the shared `encounters/occurrenceOwner.ts` classifier.
  - `encounters/commands:execute` and `commandActions:execute` are internal; browsers can no longer run Encounter commands.
  - Web sends Encounter commands through `useCampaignLiveSession().sendEncounterCommand`. Encounter acks resolve only the initiator and never advance the room sequence.
  - Room closure closes sockets and waits for in-flight commands before setting the drain fence.
  - The real-backend HTTP dev drivers (`apps/apis/tests/development*.ts`) can no longer execute Encounter commands; they still run under the in-process adapter. Correction: the R08 Encounter proofs do use them, so the drivers must send Encounter commands through the Session room (see the Decision log).
- **S5 Convex hardening:** `@convex-dev/rate-limiter` limits (tickets, Scene writes, conversation, Social), the 5-minute ACTIVATING cap, the publication role check, eviction retry with backoff, and 30-day Scene command retention. See the Security and limits section of [live-session coordination](../architecture/live-sessions.md).

Validation at the S4A/S5 commit:

- Full Convex suite: 355 files, 2,110/2,112 tests. The two failures were missing rate-limiter registrations in account-deletion tests; they are fixed and pass on rerun. One avatar loopback test timed out once on a rerun and then passed.
- Worker 73/73; focused web tests; apis/worker/web typechecks; local codegen push.

Also committed: S5 room limits (`3eba2a32`), private-by-default GM previews (`7571733c`) and the shield-stow prompt (`7f61ce58`).

**Scope decision (2026-09-24, user-approved, [ADR 0034](../adr/0034-player-control-rules-assistance-and-roll-prompts.md)):** an audit against PRODUCT.md found that players could not act for their own Characters, that Sheet writes left Run Character mirrors stale (refusing that Character's Encounter commands), and several further agency gaps. 8.2 now closes with the core below. A launch-gating Phase 8.3 "Player play parity" follows with spell casting and area targeting, death saves, Sheet–tabletop integration, map targeting and non-movement reactions.

Next (8.2 core, in order):

1. **Grip and carried weapons (in progress):** authored grip markers on weapon effects (versatile one-hand and two-hand actions, shield conflict per grip); carried weapons attack with correct modifiers.
2. **Combat math correctness** (from the 2026-09-24 authored-data audit; one slice):
   - Damage modifiers (ability, SOURCE +N, Dueling) are folded but never added to damage.
   - Character actions have no attack kind: ranged attacks use melee roll modes, Characters never flank. Consolidate the five attack-kind classifiers and the two modifier group-key builders.
   - Heavy never applies: size is missing from the fold input, so the SIZE restriction fails. Behind it, roll-mode contributors ignore SOURCE scope (`effectActionCompiler.ts` ~5762); after the fix, remove the roll-mode exclusion in `drawnSourceState`.
   - ARMOR_CLASS SET_VALUE is added instead of replacing (Draconic Resilience).
   - Scope semantics: SOURCE applies only to things from that source (per the registry); re-author Character-wide features (Archery, Dueling, Defense, Unarmored Defense, Draconic Resilience, Font of Inspiration) as GLOBAL with facet filters.
   - "Nonmagical" resistance qualifiers are dropped by the seed normalizer, becoming full resistances or immunities.
   - Proficiency is matched by exact equipment id (magic variants fail; `*` is unhandled); magic ammunition bonuses never reach the firing weapon.
   - Condition-specific save grants are never selected.
   - Fail-closed latent issues: PENALTY sign; non-Character restriction contexts are dropped, so the restriction passes; unsupported modifier kinds are rejected at publish until implemented.
   - SRD data errors: Barbarian and Fighter Defense lack armor gates; Monk Unarmored Defense has no mechanics; light and medium armor DEX gated on armor proficiency; missing Rogue weapon and tool proficiencies; Heavy armor STR and speed.
   - Sheet item panel shows manual adjustments only for magic weapons.
   - The shield-stow AC delta counts only the shield's base value, not a magic shield's +N.
   - Add direct unit tests in `packages/rules-runtime` (it has none today).
   - Phase 8.3 (with spell casting): APPLY_GRANT effects (19; e.g. Shield, Aid), condition mechanics, long range, and the remaining modifier kinds.
3. **Live Character state:** remove the Run's Character HP and stream-version mirror; Encounter reads use the current Character fenced by captured revisions.
4. **Modes and enforcement:** remove `AUTOMATIC` and add a per-person "Auto-roll my dice" preference. Assisted rule checks become warnings with a logged "Do it anyway"; GM undo or void of results and stuck prompts.
5. **Player control:** one actor-control predicate with GM-set controllers; player actions, turn end, initiative and rolls; roll prompts ("Roll dice" or typed, rerolls logged, roll-mode override); redaction; action-economy and movement display; one in-flight player Encounter command per user. Spec: `local-validation/s6/spec-player-actions.md` (local).
5b. **Visibility privacy (with player control):** players see no other actor's health by default (PCs or enemies); another player's Sheet is GM-only by default. Opt-in: "Party can view" per Character. Health display levels (Hidden by default, Descriptive, Bar, Exact) are set per Character by its player, and per Encounter for enemies by the GM, with a per-actor override. In Phase 8.3, the GM's per-enemy "Share health state" action posts a descriptive state (Unhurt, Hurt, Bloodied, Near death) once to the table log.
6. **Table fixes:** players commit moves outside Encounters (web gate), toggle unlocked visible doors, and roll to the table by default with a "To GM" option. Fog of war becomes opt-in per Scene: with fog off, players see every non-hidden entity (today a Scene without fog layers shows players only their own tokens).
7. **S4 remaining:** DO-owned bound movement (Convex-first authority sequence advance and a live `geometryStaging:observe` route), capture cache, deleting the Convex-side rules code for DO-covered flows, removing the retired rule-pack feature.
7b. **R08 proof readiness:** do one local deploy after combat math and rerun an Encounter proof through the room. The `encounter-action-contention` proof imports convex-test-only fixtures (`fixtures/encounterAction` → `fixtures/characters` uses `import.meta.glob`), so split the pure fixture data from the convex-test setup. Proofs that write Scene state directly may be refused while their Campaign's room holds authority; route those writes through the room too.
8. **S4B:** DO planners for Disarm, Cleaving responses, ROLL_ENEMY_ACTION, Legendary Resistance, spatial action interpretation and Manual mode, then delete their Convex rules code.
9. **S7:** R01–R05 audit, R08 `yarn validate:pre-staging:local`, V15 workload with player-issued commands, docs.
   - R08 prerequisite (done 2026-09-24, not yet run end to end): `scripts/validatePreStagingLocal.mjs` no longer uses the historical Codex packet `.codex/validation/local-convex-linux-20260915/`. Its proof runners are ported to `scripts/runLocalConvexProof.ps1`; the reset stage uses `scripts/resetLocalConvex.ps1`. Admin keys are generated with `docker exec` at run time. The stored credentials file is no longer used. Evidence goes under `local-validation/`. See the [release runbook](../runbooks/phase-8-2-release.md#final-local-source).
   - Still open for R08: every lifecycle proof runs `apps/apis/tests/developmentDrafts.ts`, so the S4A note above that R08 does not use the HTTP development drivers is wrong. Since S4A those drivers cannot run Encounter commands, so the Encounter proofs (lifecycle, contention, movement, passage, disarm, effects, VTT, V15) will probably fail until they go through the room. Those drivers also still write browser output under `.codex/validation/`.

Integration items for the pending local-reset batch (grip, fog opt-in, roll visibility, doors):

- Chat roll payloads gained `consumedAt` as an optional field for rest-roll settlement. Before committing, make it a required, nullable field on the ROLL payload variant only (pre-launch: no optional fields). Text payloads must not carry it. Verify with the post-reset codegen push.
- Re-run the web and Convex typechecks after the codegen push. The roll-visibility slice's remaining errors come only from the stale generated API.

Fog follow-ups (from the fog opt-in slice):

- Convex fog commands refuse painting while fog is OFF, but they don't enforce the shared-party versus per-player layer-owner rule against the Scene's mode. Existing tests deliberately mix both layer kinds in one Scene, so decide the rule and enforce it once.
- Only Convex emits `FOG_MODE_SET` today, and players pick it up through the room's version re-sync. If the room ever applies it directly, turning fog off must trigger a full recipient refresh, because newly visible entities aren't carried by the delta.
- A fog-off Scene that keeps its fog layers uses full hydration, and players still download layers they won't use. Revisit if Scene load time matters.

Open follow-up: Scene fog save retention (derived fog saves keep `geometrySaveId` after their geometry save is pruned; superseded fog saves and chunks are not garbage-collected).

## Decision log (delegated, for user review)

The user delegated decisions on 2026-09-24 (night): use Foundry as the baseline, extend it for versatility and quality of life, "same but better" at minimum. Each entry gives the decision, the Foundry baseline (with Roll20 as a second reference where useful) and the reasoning.

- **Development proof drivers go through the Session room (2026-09-24).** Since S4A, browsers can't call Encounter command functions, so the real-backend drivers (`apps/apis/tests/development*.ts`, used by the R08 proofs) can no longer run Encounter commands. The drivers will send Encounter commands over a real Session-room WebSocket with a ticket, as the browser does, and their `.codex/validation` output paths move to `local-validation/`. Rejected alternative: admin-key calls that impersonate a user, which would prove a path production never uses. Foundry and Roll20 have no equivalent; this is a testing-integrity choice.
- **Local deploys are part of local validation (2026-09-24).** `convex codegen` uploads functions only to generate types; it doesn't activate them, so the local backend kept running pre-ADR-0033 functions. Pushing functions to the local Docker deployment is covered by the same local-only authority as resets. Staging and production still need explicit approval.
- **Domain rejections carry a code and a user-safe message (2026-09-24, in the modes and enforcement slice).** The room currently reduces every Encounter failure to a generic message ("The Encounter command could not be completed."). Foundry and Roll20 show players specific warnings. Expected domain rejections, such as "This Campaign already has an active Encounter" or a stale version, become `ConvexError` data `{ code, message }`, following the `RATE_LIMITED` pattern. The room forwards those messages; unexpected errors stay generic, so internals never leak. Drivers assert on codes.
- **Local Worker configuration (2026-09-24).** `apps/session-worker/.dev.vars` was rebuilt from the local Convex secrets to match `.dev.vars.example`. The retired executor variables are removed from it, from the local Convex env and from the generated Worker types. `RULES_CONTINUATION_SECRET` is now provisioned locally.

## Authority and present state

The fixed [75-case acceptance ledger](../roadmap/08-2-convex-cutover-acceptance.md) is **59/75**. Open cases are **P15, V05, V08, V09, V14, F12 (reopened by the ADR 0033 amendment), V15, R01–R06 and R08–R10**; R07 is accepted. The [acceptance JSON](../roadmap/08-2-convex-cutover-acceptance.json) controls exact case status. Scoped V07, V10 and V13 acceptance remains intact; combined final-system proof belongs to R08 and V15. Portable helpers, focused tests and typechecks do not accept R06.

The cutover keeps heavy live rules **and heavy fact preparation** in the Session Durable Object (DO). Convex owns atomic Character Sheet and Encounter writes and their receipts; Scene publication uses per-entity deltas. Existing TypeScript rules and typed planners are shared by native and DO paths. The DO's ordered room dispatch and crash recovery are still missing, so **do not run or claim V15** yet. No staging, production, retirement, deployment, database reset, journal deletion or real continuation-key transfer is authorized by this handoff.

Current architecture is defined by [ADR 0029](../adr/0029-convex-backend-cutover.md), [live-session coordination](../architecture/live-sessions.md) and [shared rules runtime](../architecture/rules-runtime.md). [ADR 0024](../adr/0024-current-published-authored-content.md) governs current published sources and frozen issued occurrences; its policy supersedes older whole-Character source-vector claims. [ADR 0032](../adr/0032-campaign-deletion-lifecycle.md) governs Campaign deletion. The [release runbook](../runbooks/phase-8-2-release.md) and [remaining-work plan](../roadmap/08-2-convex-cutover-remaining.md) govern promotion order.

## Verified local checkpoints

The latest _completed_ movement-response checkpoint passed **31 focused cases in 8 files**, serial API/Convex/Worker types **10/10**, formatter/lint on **39 TypeScript files**, and an 8-root private import check with no heavy preparation or emitted Kernel/compiler imports. It includes actual private final Passage rollback, one allowance consumption and replay; PLAYER movement Concentration response, child receipt and revoked-assignment refusal; and initial/response movement admission. The source manifest is SHA-256 `27047BE566B2B6180396F7B024054B4D9B03A6ED396C2C4F554C2FC12C373F90` **before** the declaration edits and checkout relocation. The ordered commands, failures corrected before that checkpoint and limits are in [the durable movement summary](../validation/phase-08-2/README.md). They do **not** certify the current working tree.

Initial START and initiative evidence/order responses had separately passed: fresh serial types **10/10**, START/Recharge and round-wrap response cases, exact prior-round history and replay. Round 1 is inserted without replacement, no outgoing effect is applied, and incoming effect ordinal is zero. This does not cover declaration responses or room dispatch. The earlier native+private action, concentration and movement receipts remain supporting scoped evidence in the retained local validation archive, not final-source release proof.

The approved relocation copied **3,376 files**, left **1,526 unchanged**, and removed **1,283 tracked obsolete files** in the regular checkout. The regular checkout's `AGENTS.md` and spell mapper edits were preserved. Transfer evidence is under `local-validation/phase82-relocation-20260924/`. The raw evidence copy from the detached worktree to ignored `local-validation/phase82-goal-20260923/` completed successfully (robocopy exit 3: copied files and extra destination files). The durable summary is under `docs/validation/phase-08-2/`. Immutable Yarn install in the regular checkout passed with existing peer and optional `unix-dgram` warnings; it is not a current-source compiler or test pass.

## Work in progress and immediate continuation

The user explicitly approved **local implementation and testing** of initiative declaration response integration (`call_HBBV88caQZPGSp4hPmkMTYRX`). An earlier automatic review refusal was resolved by that specific approval. The durable [declaration checkpoint](../validation/phase-08-2/initiative-declarations.md) records the bounded scope and exact stopped state. The user then clarified that work should stop at this patch. All implementation and validation processes started for this patch have ended; do not resume fixes or start another feature without the user's direction.

**Update 2026-09-24 (resumed):** the declaration patch now passes locally — a fixture omitted the native parity step that equips the Character's weapon; see the [declaration resolution](../validation/phase-08-2/initiative-declarations.md#resolution). The historical stop state follows. **The patch was not passing.** Both private declaration response-order tests failed with `The declared Character action equipment facts are stale.` at `encounterInitiativeDeclarationCompiler.ts:315`, called by `prepareEncounterTurnInitiative` at line 290. `private01.log` retains the complete failure; 2 failed, 8 skipped. No investigation or further fix followed the stop instruction. The latest compiler run failed a test-only pending/complete union access; that access was corrected before the test run, but types were not rerun. The earlier runtime union error was fixed and its package build passed on the second run. Independent authorization/persistence review completed; its missing PLAYER-terminal coverage finding led to the two deterministic test variants, which currently fail before completing the proof.

The intended declaration parity is the existing public behavior: OWNER may declare for any actor; a currently assigned PLAYER may respond only for their issued Character declaration. START, ADVANCE_TURN, initiative score/order and other turn decisions remain OWNER-only. The private capture adds only the approved optional `turnResponse` and captured Campaign owner identity; it cannot combine with movement or Concentration scope. Preserve issued request checksum, selected options, response history, current controller/assignment, actual responder identity, replay and one atomic pending/terminal write. The root receipt identifies the initiating GM; its resolution history identifies the actual responders. The existing native declaration fixture is the parity reference. `source-stopped.json` in the declaration evidence folder hashes the 15 touched source files; it is not a whole-repository release manifest.

After declaration proof, the remaining functional path is contextual Encounter decisions, actual ordered room dispatch/recovery, and final coherent local R08. R01–R05 track successful boundary removal and lifecycle on that same final source. Run the frozen V15 workload only after room dispatch and recovery exist; then seek separate managed R09/V15 and R10/retirement authorization. The fixed scenario is one GM, five players, eleven actors, eight rounds and two actions plus reactions; preview p95 ≤150 ms, durable p95 ≤250 ms/p99 ≤500 ms, and gameplay command p95 ≤1 s. Do not treat a timeout or incomplete suite as passing evidence.

## Decisions and unresolved questions

- Preserve immediate VTT behavior, per-entity Scene deltas and Pixi object retention. Do not restore full-Scene replacement, duplicate hydration, a DO Character publication lane, a second rules engine, a database emulator, arbitrary patch endpoint, queue or service.
- Character Sheet writes and matching Encounter results stay atomic in Convex. Heavy evaluation and fact preparation stay in the DO. The room must drain pending Scene publication before capture/commit, check authorization, epoch and all captured revisions, then acknowledge and broadcast only after required Convex commit. Exact retries return stored receipts without rerolling or spending twice. SQLite journal receipts/outbox are durable and cannot be discarded to force a retry.
- Selected source/target Character captures require exact stream versions. Unrelated stored actor snapshots still require assignment, ownership, System and ACTIVE checks but not an unrelated newer stream version.
- Earlier local implementation approvals remain in force for initial START (`call_d16qktM5L4Z5vir3Bu4jn4RS`) and the movement Character-assignment correction (`call_KIhJlMidUWEjsJQsNurYgMkk`). The assignment reader validates against the Campaign owner while receipts keep the actual initiating PLAYER; authenticated membership, active assignment, current control and System checks remain required. These approvals do not expand the declaration or continuation-key scope.
- [ADR 0030](../adr/0030-owner-deletion-and-retained-dependencies.md) requires referenced third-party dependencies to be repaired before owner deletion, preserving other owners' content and history. [ADR 0031](../adr/0031-oversized-inventory-cleanup.md) permits bounded, resumable cleanup of oversized inventories while unrelated inventory remains usable. These rulings preserve the fixed lifecycle cases; old refusal or whole-Campaign atomic-cleanup proofs cannot replace their current tests.
- **Continuation key ruling (user, 2026-09-24):** use a dedicated `RULES_CONTINUATION_SECRET` provisioned directly into both the Convex and Worker environments, like the existing Worker/ticket secrets. It is never transported over HTTP, and the Better Auth secret remains Convex-only. Pre-launch pending continuations sealed with the old derived key fail closed rather than being migrated. Not yet implemented. The paragraph below is the prior state.
- The **real continuation-key design was unanswered**. An automatic review refused exporting a derived key through private capture; that patch was not applied. Declaration approval does not authorize it. The Better Auth master secret must never leave Convex. Current local tests use fixed fixture keys; do not provision/export a real key or bypass review. The alternatives remain private derived-key delivery with specific approval or Convex-held key with verified resealing of issued continuations.
- Finishing a Session with an unfinished Encounter remains an unanswered product choice: complete it, block finish, or carry it forward. Freeze only that slice.
- The one authorized usage reset was redeemed at roughly 1% remaining with key `0c9fabd8-2a6b-4bdf-b614-fb2f64ace3b7`; zero credits remain. Last recorded limits at about 15:21 UTC were 89% used/11% remaining. Read fresh limits if relevant; do not retry that reset.

## Local verification and process limits

Use native PowerShell. Keep complete command output under ignored `local-validation/` for this regular checkout and publish concise ordered evidence under [Phase 8.2 validation](../validation/phase-08-2/README.md). Do not read a still-running log; inspect a bounded failure excerpt after completion. Record the final working-tree identity, command order, result and retained log path. Any later source, fixture, generated artifact or configuration change invalidates affected proof. The [release runbook](../runbooks/phase-8-2-release.md) requires the complete pre-staging local lifecycle before promotion; focused checks are implementation feedback.

Run the native TypeScript compiler **alone** on this Windows machine: `GOMAXPROCS=2`, Turbo `--concurrency=1 --env-mode=loose`. Do not run it alongside Vitest. Some auth fixtures expire after 60 seconds, so parallel or resource-starved test runs can fail without an application defect. A compiler allocation crash or incomplete suite is a failed gate. Build fresh rules-runtime outputs before tests importing new wildcard-export modules.

Existing Docker container `phase82-convex-local-linux` (ports 3210/3211), media helper (8026), web (3000) and Worker (loopback 8787) are historical observations in the raw handoff, not current health checks. Verify the actual process and port before reuse; do not start a duplicate or erase SQLite state on a timeout. Docker Desktop startup is user-owned; an earlier daemon shutdown preserved its volume but lost the local R2 helper's in-memory objects, so missing objects after restart are not deletion proof. A loopback Worker launch succeeded after an all-interface launch was refused by automatic review. The last local deployment predates the new declaration work and is not current-source evidence. A prior V15 command-entry preflight produced two one-second CPU timeouts before handler entry; it did not isolate an initializer or pass the workload. Do not repeat it until the room integration warrants it.

The 67 KB previous living handoff remains read-only in the detached worktree and in the copied local archive. Its dated historical checkpoints and process handles are superseded by this document, the current source, the fixed ledger and fresh verification. No remote staging or production step follows automatically from a local pass.
