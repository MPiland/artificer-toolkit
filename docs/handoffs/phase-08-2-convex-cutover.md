# Phase 8.2 Convex cutover handoff

**Status:** active; acceptance authority and current remaining work are summarized below.
**Updated:** 2026-09-30.
**Workspace:** regular `D:/dev/artificer-toolkit` checkout on `codex/phase-08-2-convex-cutover`. The detached `.codex/worktrees/phase-08-2-convex-cutover` remains a read-only backup. The relocation is committed (`85443906`); later slices are separate commits. No phase completion is claimed.

## Current authority and remaining work (2026-09-30)

The [acceptance JSON](../roadmap/08-2-convex-cutover-acceptance.json) is the status authority: **51/75 cases accepted; 24 open** — F12, P02, P06, P15, V03, V05, V07–V15, R01–R06 and R08–R10. Counts and implementation results elsewhere in this handoff are dated historical checkpoints and do not establish current integrated acceptance.

Convex remains the backend. Cloudflare remains responsible for web hosting, room execution and R2. Remaining scope includes Character typed persistence and narrow Sheet queries; snapshot local-bridge and room integration; ADR 0035 S3 checkpoints, S5 shadow parity and S6 authority switch, followed by S7 held Sheet and S8 live-view/chat work. Run the full final-source local lifecycle before separately approved managed promotions. See [ADR 0029](../adr/0029-convex-backend-cutover.md), [ADR 0035](../adr/0035-room-authoritative-live-encounters.md), [persistence](../architecture/persistence.md), [Character](../architecture/character.md), [live-session coordination](../architecture/live-sessions.md), and the [release runbook](../runbooks/phase-8-2-release.md).

**Foundation progress:** Character typed play-state persistence, removal of the full Builder-draft query from the active Sheet path, and the local R2 snapshot fixture bridge have focused local checks recorded. The local codegen and affected typechecks passed; the guarded reset left local data requiring reseed. These checks accept no ledger case and do not certify final-source lifecycle or promotion. See the [foundation validation note](../validation/phase82-foundation-2026-09-29.md).

**Current local checkpoint:** compact Spell preparation uses authorized snapshot metadata, browser pages of 40 and virtualization. Full mechanics load for selected or inspected Spells. The three frozen native Builder-to-Sheet journeys pass, and observed maximum Sheet/preparation reads fell from about 6.64 MB/1,101 documents to about 5.01 MB/492 documents. Other authored-input reads remain broad; this is no Q16 or latency gate pass. The native source, failed fixture attempt, restored object hashes and focused checks are retained in the [compact Spell validation record](../validation/phase-08-2/compact-spell-picker-2026-09-30.md). Packed receipt storage and bounded private payload retirement have separate [native evidence](../validation/phase-08-2/private-receipt-retirement-2026-09-30.md). The full final-source lifecycle remains pending.

**Checkpoint foundation:** room-store compaction now requires an acknowledged epoch/sequence/checksum
prefix and retains commands committed after it, including across eviction. The [prefix validation
record](../validation/phase-08-2/checkpoint-prefix-2026-09-30.md) records 58 focused checks, 10 native
SQLite checks and the Worker typecheck. The subsequent source integration is described below;
this foundation does not complete S3 or prove the integrated command lifecycle.

**Integrated Scene/checkpoint source (execution proof pending):** raw `SCENE` hydration now reads
all seven native families with definition/presentation and Scene-version fences, preserving
tombstones, counters, published saves/chunks and receipt evidence. Shared pure Scene geometry
parsers, values and live-state helpers live in `packages/encounter-persistence`, independent of
Convex. Standalone move/door/undo stage native records in `RoomEncounterStore.transact` and commit
the `DurableCommandJournal` head/receipt in the same SQLite transaction. The authority checksum is
the cumulative write-set chain; stored display Scene JSON has its own shared-schema content hash.

[RoomCheckpoints](../../apps/session-worker/src/roomCheckpoints.ts) retains a fixed prefix input in
bounded SQLite chunks and retries its exact ID and pins through the existing inline/staged publisher.
Acknowledgement and snapshot compaction share one SQLite transaction, retaining concurrent suffix
commands. The earliest unpublished receipt timestamp drives the unchanged 120-second alarm;
checkpoint responses renew the existing 240-second authorization lease. Admission, presentation and
drain boundaries flush checkpoints. See [live-session coordination](../architecture/live-sessions.md)
and the [Worker README](../../apps/session-worker/README.md).

**Authority/Character/reducer source (validation pending):** `AUTHORITY` pages now hydrate the
native Campaign, all membership statuses, assignments and actual account-profile presence.
Room authorization carries the canonical SYSTEM revision; held System reads remain revision-bound.
Cached Character Builder structure joins local typed head/play/effects, and a Builder refresh
preserves existing room play/effects. Authorized input `RESTORE` establishes or rebases an already
durable Convex base, rejects dirty mutable/history replacement and emits no false `INSERT` history.
[Room Encounter commands](../../apps/session-worker/src/roomEncounterCommands.ts) now execute
the deterministic tools in [the shared `ROOM_LOCAL_ENCOUNTER_COMMAND_TYPES` list](../../packages/schema/src/api/liveSessionEncounterCommand.ts)
with existing reducers and blueprint enemy builder, atomic room journal receipts and per-recipient
projections, including action undo through the existing shared action-revert reducer. The shared
predicate includes `UPDATE_ACTOR` only without `characterCommand`; embedded Character Sheet and
other rules commands remain transitional. `roomCharacterRules` now passes compact snapshot Spell
index entries into `nativeCharacterRules`; only requested documents are serialized, and only
referenced Spell documents are captured and parsed
for mechanics, with the protected capture comparator retained as fallback.
Initiative rolls now use secure room RNG and the native transaction. Only the initiator receives
roll evidence; other recipients receive privacy-filtered projections with `roll: null`. Replay
retains evidence without another draw. PRIVATE `ROLL_ENEMY_ACTION` now follows the same local
transaction and private replay-evidence path; TABLE rolls remain transitional until native chat
ports are integrated.
These current source changes await validation and do not complete S6/S7, chat or the
Character hold lifecycle.

**Receipt/publication safeguards (current source; evidence pending):** Character actor removal,
`COMPLETE` and any actual Run round change persist a receipt barrier that checkpoints before
acknowledgement on both commit and recovered replay. Local reducer retries recheck current
admission/privacy and return the original projection
at its version or the current Run projection after later work. Checkpoint responses apply changed
authorization sections and renew the lease without another warm read. After eviction, a retry response
that omits required sections falls back to a complete authorization read. An unpublished native
suffix rebuilds actor control and health-display permissions from SQLite rather than older Convex
play state. Unchanged Scene fog chunks reuse
their published references and payloads. Direct Convex execution of every command accepted by the shared predicate
is refused under held Campaign authority. Their protected Convex comparator remains for
S5 shadow parity and backend fixtures, outside steady-state room dispatch, and retires in step 6 after S5.
No integrated execution or gate acceptance is claimed for these safeguards.

**Current source batch (Codex, execution pending):** Builder reload now reconciles against the
native play record inside the caller's transaction, preserving play and effects, clamping only
a reduced Character maximum and removing orphan resource usage. Storage corruption/loss now
requests an idempotent new authority epoch through the protected Worker route and clears abandoned
local authority/checkpoint state atomically. Failed recovery keeps the prior evidence for retry.
Room mechanics apply the existing shared planner and typed play writer to current native play;
native START/ADVANCE and stored turn-owned resolution now bind that callback to the existing
planner and shared pending/terminal writers in SQLite. Native basic actions use the existing planner
and extracted persistence reducer. Scene and local Encounter journal commits recheck the caller's
admission, current authorization and matching lease revisions immediately before SQLite commit.
Replay uses the canonical current-member presenter for player projections and occurrences.

Turn admission, pending/terminal persistence, initiative settlement, effect/resource writes,
maintenance reads and concentration child/cleanup/owner persistence now use shared algorithms.
Existing Convex handlers use actual transaction adapters and owning callbacks. Immutable
`SCENE_DEFINITION` hydration retains source-pinned header/entities; native reads reuse the canonical
current-entity algorithm over the base and live overrides. `DEFINITION` hydration carries
`sourceKind: PLATFORM | USER | null`, preserving platform basic actions independently of Campaign
catalogue membership. Shared Concentration logging stages paired chat or native private roll records;
checkpoints append immutable evidence into the owner's global twenty-roll history without
cross-Campaign replacement. Ordinary action pending/terminal/evidence responses, Concentration,
Cleaving and Disarm now bind shared planners and writers to native production dispatch in source.
Retained occurrence/receipt ownership selects a response planner before canonical admission runs
again. GM cancellation/refusal uses the existing void classifier; TURN/CLEAVING declining voids
use their real response paths. State, Character play, effects, paired rules chat, private rolls and
receipts share the SQLite command/journal transaction. Convex adapters retain real callbacks and
logical receipt inserts through the packed ledger writer. Movement/bound fog, general
chat/public/evidence rolls, held Sheets/lifecycle and cold definition hydration remain open;
cold `DEFINITION` misses still reach Convex after hydration. Runnable source checks
cover reload, recovery, mechanics and admission rollback, but were not executed in this batch,
following the user's instruction to finish known source work first. See the
[source batch record](../validation/phase-08-2/room-command-source-batch-2026-09-30.md).

These are source implementation claims only. Integrated execution proof, Scene receipt payload
packing, S5 parity, complete S6/S7, chat, budgets and the final-source local lifecycle remain open.
Bound/fog/movement-decision paths remain Convex-first transitional. Focused HP/Common reads remain
open. Acceptance remains **51/75**, with the frozen 190-criteria scope unchanged; no S3/S6 completion
or new native proof is claimed.
The note-write aggregate-checksum proposal awaits the user's decision; current integrity checks
remain in place. Final-source execution remains deferred under the user's source-first steering.

**Inline checkpoint application (focused proof, 2026-09-30):** typed record deltas, actor mutable
keys scoped by `[encounterId, id]`, a Character-scoped ledger, one play-clock advance per checkpoint
outside the canonical digest, and atomic state/history/fence rollback passed focused tests and a
native local Convex proof. The response renews authorization; checkpoint-originated writes suppress
self input invalidation. Native source
parity matched 5,382 entries. The later staged-upload and inline-retry native proofs both matched
5,392 source entries and passed; their fixture performance sample is not a gate and the near-4 MiB
ceiling remains unproven. See the [checkpoint staging validation record](../validation/phase-08-2/checkpoint-staging-2026-09-30.md).
The initial
public-HTTP transport attempt failed and remains recorded, while the corrected internal Convex call
passed. Authorization response and no self-invalidation also passed. This is not a gate acceptance:
the ledger remains 51/75. Integrated proof of Scene/fog publication, room alarms/final drain/unified
global sequence, S5/S6/S7, Q16 and the final-source lifecycle remain open. See the [checkpoint
application validation record](../validation/phase-08-2/checkpoint-application-2026-09-30.md).

## Historical checkpoint (2026-09-24, later session)

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
2. **Combat math correctness** (from the 2026-09-24 authored-data audit; one slice). Implemented locally, uncommitted and awaiting integration (reset/reseed, codegen); see the S6c section of [rules-runtime](../architecture/rules-runtime.md). Open: magic ammunition (needs an ammunition-selection decision), `maxBonus` (unused field: remove or reject), GM stat-block display of qualified defenses, and Creature Magic Weapons traits:
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
   - Phase 8.3 (with spell casting): APPLY_GRANT effects (19; e.g. Shield, Aid), condition mechanics, long range, and the remaining modifier kinds. Add an acceptance criterion: in Assisted mode, a player's spell that forces a creature's save pauses for that creature's controller, unless their auto-roll is on (moved out of V11.4 by Q6).
   - Performance (found 2026-09-25, [bundle timing](../validation/phase-08-2/bundle-timing-2026-09-25.md)):
     - Typical room commands take ~1.1 s p95, against a 250 ms rule-bound budget.
     - Encounter Run creation fails at the 100-actor cap (reads over 16 MiB).
     - A profiling and fix slice is running.
     - If contract-preserving fixes aren't enough, the next lever is a warm path: the room plans from the volatile state returned by its last commit, and a fence refusal forces a recapture.
   - Test-suite speed (user-approved 2026-09-26, safest steps first). Each step must show identical coverage and results before the next begins. 0. Upgrade convex-test 0.0.56 → 0.0.60 as its own change. Skip 0.0.58, which lets Vitest stubs bypass the transaction guards.
     - **Why:** accuracy, not speed. It adds real-backend guards (timers and `fetch` in transactions, args-validator shape), real request metadata (drop the `authJwks.test.ts` stub and test the 503 fallback), and fixes false scheduled-function hang errors.
     - **Proof:** three suite runs per version (unshuffled, seeds 101 and 202) with identical test IDs and statuses; per-file counts of scheduled-function errors, "not supported in Convex queries or mutations", timer-restore and args-validator messages; and a per-file timing comparison.
     1. Measure per-file Convex suite timings (no code change). The suite is ~30 minutes because `apps/apis/vitest.config.ts` runs it serially: ~21 minutes of tests, ~8 minutes of per-file imports.
     2. Validation cadence: affected tests per slice; reset and reseed only when schema or seed data changes; full integration at checkpoints and the final R08 run.
     3. Parallelism.
        - First extend the 60-second session expiry in the test fixtures (`tests/fixtures/characters.ts`, `publication.ts`). Tests of expiry itself set their own times.
        - Then trial 2–3 workers, adopted only if repeated runs match the serial baseline exactly.
     4. Only if step 1's measurements justify them:
        - pure memoization of fixture parsing and checksums (estimated under 1%);
        - a convex-test patch caching schema export per schema;
        - a separate trial to cut the ~8 minutes of repeated per-file workspace `dist` imports.

        Each goes through the equivalence protocol: identical test IDs and results, three shuffled seeds, and each changed file run alone.
     - **Never:** share database state across tests, replay seeded snapshots, or set `isolate: false`. convex-test 0.0.56 has no snapshot or clone, and tests assert whole tables and use global mocks (read-only analysis, 2026-09-26).
     - Remove the dead fixture `apps/apis/tests/fixtures/movementPassageFixture.ts` (imported nowhere).
     - Move the 12 already-pure test files out of the Convex suite (for example `encounters/actionExecution`, `actionEffectBaseline`, `wieldConflict` → `packages/rules-runtime/src/__tests__`). The test IDs and results must stay identical.

   - Rules test coverage, a quality project (read-only audit, 2026-09-26):
     - **The gap:** `packages/rules-runtime` has 7 test files for about 270 source files. The largest planners have no fast tests: the effect compiler, initiative lifecycle, ties and order, turn effects, Legendary Actions, Recharge, Concentration, Disarm preparation, and the spatial movement service. Most rules coverage is end-to-end through Convex tests, and many of those assertions are loose ("HP decreased").
     - **Plan:** build strict pure tests family by family, in this order:
       1. action warnings and target policy;
       2. saves and immunity;
       3. initiative;
       4. turn effects, Legendary Actions, Recharge and Concentration;
       5. movement.

       Use `createPlatformRulesRuntime`, `inMemoryInitiativeRepository` and `dnd5eSrdCharacter.ts`, and inject `random`. Prove each new test fails when the logic is deliberately broken. Only then slim the matching Convex test.

     - **Never remove the last proof of a Convex guarantee:**
       - tampered receipt refusal;
       - stale source-identity refusal;
       - the Scene version fence;
       - no writes on refusal;
       - command-id reuse;
       - `NOT_ACTOR_CONTROLLER`;
       - roll draw mismatch;
       - exactly-once undo.
     - **Expected payoff:** mainly precision and catching regressions. Speed gains are small, about 2–4 minutes.
     - **Next pure targets, confirmed untested by the liveSessions audit:**
       - Initiative:
         - `planEncounterInitiativeAdvance` (`encounterInitiativeStateSettlement.ts:201`): SAME_ROUND and ROUND_WRAP; inputs are cheap.
         - Initiative tie settlement.
       - Concentration:
         - `resolveDnd5eConcentrationSaveFacts` / `dnd5eConcentrationDamageDc` (`systems/dnd5e/concentrationPolicy.ts`);
         - `evaluateNativeConcentrationEvidence` / `completeNativeConcentrationResult`;
         - `projectEncounterMovementConcentrationEnd` (cleanup of dependent effects).
       - Action economy: `evaluateEncounterActionEconomy` (warning).
       - From the scenes audit. These have cheap inputs and currently no pure test:
         - `sceneTokenMovementFailure` (`shared/domains/vtt/geometry.ts:293`);
         - `discoverEncounterMovementPassageContact` / `discoverEncounterMovementPassage` (endpoint occupied, next passage stop);
         - `deriveCharacterSceneVision` (sense range, non-visual channel);
         - fog exploration truncated at a pending contact (`planSceneCommandExploration`).
       - From the encounters audit:
         - Disarm: `disarmSourceWins`, `disarmApplicationOutputs`, `planEncounterDisarmSuccess` (`encounterDisarmPreparation.ts`). Add these before trimming any Disarm it.each rows.
         - `applyCharacterScalarValuesToFacts` / `foldActiveScalarReductions`.
         - `buildMovementTarget` (the Creature branch).
         - `prepareNativeCharacterActionState`.
         - The wield-conflict NONE case.
         - A carried weapon having the same modifier as an equipped one.
       - From the characters audit. The Character domain has no pure tests for its reducer, projection, rest or builder:
         - Easy, no harness needed: the Sheet command reducer `applyCharacterSheetCommand` (`sheetCommandReducer.ts:1269`) for notes and groups, and extras (add, clamp, exclusive, remove).
         - Needs a pure Character-context harness, built on `prepareCharacterRuleContext` with in-memory `Readers` as `apps/session-worker/src/nativeCharacterRules.ts:329` does:
           - builder resolution and reconciliation (`resolveCharacterBuilder`, `reconcileCharacterBuilderCharacter`, chosen-grant choices);
           - rest preview and completion (`buildCharacterRestPreview`, `applyCompletedCharacterRest`);
           - `resolveCharacterRecordStats`.
         - Before those assertions can move, extract the inline Convex rest and extras cleanup (`characters/sheetCommands.ts:383-384, 423, 462, 481-484`: resourceUsage and max-HP-modifier filters) into pure functions.
         - Keep in Convex: `drafts.test.ts` (all), `characterMaximumHitPoints.test.ts` (stored-stat sync across every write path), Sheet extras source visibility, and Campaign masking wiring.
       - From the turn-phase audit:
         - GM turn-correction cursor math is inline in Convex (`encounters/commands.ts:269-316`). Extract it into a pure function (T4) before its assertions can move. `initiativeCorrection.test.ts:144` is already pure and can move as it is.
         - `turnLegendaryAction.test.ts:1052` is named "settles once with spend, damage and cursor" but asserts only status, version and replay. Strengthen it or rename it.
         - Once the pure tests exist, the rules outcomes duplicated across in-process and live-Worker transports in `turnConcentration.test.ts` (461/960, 511/584, 678/785) can shrink to one transport each.
       - Test cleanup: `encounters/actionCharacterSources.test.ts:627-664` runs a second full setup and compares two snapshots with nothing executed between them. That proves nothing and doubles the test's cost. Remove it together with the redundant re-reads.
       - Worker-level tests with injected capture fakes, the medium-effort precedent being `apps/session-worker/test/nativeTurnEffectPerception.test.ts`:
         - movement Concentration;
         - maintenance forecasting;
         - passage contests;
         - reaction evidence order and STOP;
         - the room-side maintenance currentness refusal. `movementMaintenance.test.ts:586` is its only proof today.
     - **Also Convex-only proofs to keep:**
       - the `roomCaptureCache` transaction-limits test at the actor cap;
       - action commit rollback;
       - capture bundle ≡ separate-capture parity;
       - revision stamps (CAMPAIGN, and SYSTEM via import jobs);
       - external-commit resolve;
       - `characterRulesCapture` privacy and no-hydration checks.

   - Observability: room planner failures surface only as a generic "UNAVAILABLE" and aren't logged. Add structured, secret-free error logging.
   - R08 prep: the development proof drivers can't load under `yarn tsx`. Test-only fixtures import convex-test, which uses `import.meta.glob`.
   - R08 prep: the local R2 fixture (`apps/apis/tests/localR2.ts`, served from the Convex container on 127.0.0.1:8026) was started by hand and stops when the container restarts. Its start command is undocumented. Script its start in the local proof tooling, checking health first, and document it in `apps/apis/README.md`. Map uploads, and so bound-move timing and browser proofs, need it.
   - R08 prep: rebuild a room-driven, real-backend reaction contention proof for V14.4 once S4-c lands.
     - The stale driver (`developmentEncounterReactionTransactions.ts`) was deleted and replaced by an in-process test.
     - convex-test runs one transaction at a time, so the in-process test proves winner and loser semantics but not true parallel transactions.
     - Only the real backend can prove true parallelism.
   - Phase 8.3 (user, 2026-09-25): Encounter combatant kinds beyond CHARACTER, CREATURE and CUSTOM:
     - mounts, with mounted-combat rules;
     - vehicles, including crewed vehicle combat;
     - traps;
     - hazards.
       Compare each with Foundry's actor types.
   - Follow-ups from S6g: `REACTION_COUNT SET_VALUE` with APPLY_GRANT (Shocking Grasp); Barbarian Fast Movement mechanics.

3. **Live Character state:** remove the Run's Character HP and stream-version mirror; Encounter reads use the current Character fenced by captured revisions.
4. **Modes and enforcement:** remove `AUTOMATIC` and add a per-person "Auto-roll my dice" preference. Assisted rule checks become warnings with a logged "Do it anyway"; GM undo or void of results and stuck prompts.
5. **Player control:** one actor-control predicate with GM-set controllers; player actions, turn end, initiative and rolls; roll prompts ("Roll dice" or typed, rerolls logged, roll-mode override); redaction; action-economy and movement display; one in-flight player Encounter command per user. Spec: `local-validation/s6/spec-player-actions.md` (local).
   5b. **Visibility privacy (with player control):** players see no other actor's health by default (PCs or enemies); another player's Sheet is GM-only by default. Opt-in: "Party can view" per Character. Health display levels (Hidden by default, Descriptive, Bar, Exact) are set per Character by its player, and per Encounter for enemies by the GM, with a per-actor override. In Phase 8.3, the GM's per-enemy "Share health state" action posts a descriptive state (Unhurt, Hurt, Bloodied, Near death) once to the table log.
6. **Table fixes:** players commit moves outside Encounters (web gate), toggle unlocked visible doors, and roll to the table by default with a "To GM" option. Fog of war becomes opt-in per Scene: with fog off, players see every non-hidden entity (today a Scene without fog layers shows players only their own tokens).
7. **S4 remaining:** DO-owned bound movement (Convex-first authority sequence advance and a live `geometryStaging:observe` route), capture cache, deleting the Convex-side rules code for DO-covered flows, removing the retired rule-pack feature.
   7a. **Combat math follow-ups:**
   - remove `maxBonus` (schema, SRD data, web authoring);
   - make unarmored AC formulas choose the best, not stack;
   - reject or implement the remaining unconsumed modifier kinds (SAVE_DC SET_VALUE, PROFICIENCY_BONUS, CHARGE_LIMIT, range/duration/shape, spell-slot and known/prepared counts, action counts), keeping the kinds the SRD uses;
   - missing weapon and tool proficiencies for Bard, Druid, Monk, Sorcerer and Wizard, and Monk Unarmored Movement mechanics;
   - the GM stat block shows qualified defenses;
   - melee spell attacks can flank (the trigger needs a melee or ranged distinction);
   - Dueling's "no other weapons" condition.
     7b. **R08 proof readiness:** do one local deploy after combat math and rerun an Encounter proof through the room. The `encounter-action-contention` proof imports convex-test-only fixtures (`fixtures/encounterAction` → `fixtures/characters` uses `import.meta.glob`), so split the pure fixture data from the convex-test setup. Proofs that write Scene state directly may be refused while their Campaign's room holds authority; route those writes through the room too.
8. **S4B:** DO planners for Disarm, Cleaving responses, ROLL_ENEMY_ACTION, Legendary Resistance, spatial action interpretation and Manual mode, then delete their Convex rules code.
9. **S7:** Also: fold in Scene fog save retention (Q4); delete the Codex backup worktree after the final commit (Q2); add "rotate the staging and production credentials" to the go-live checklist (Q1). R01–R05 audit, R08 `yarn validate:pre-staging:local`, V15 workload with player-issued commands, docs.
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

- **D70: packed history with indexed receipt headers (2026-09-29). Decision maker: Codex; approved
  by the user on the same date.** Codex decided that checkpoint ledgers hold immutable history
  payloads once, while small indexed per-command receipt headers point to their checksummed entries.
  This preserves existing UUID replay, duplicate-command refusal, privacy and complete timeline paging
  through Convex indexes, without duplicating history bodies. Headers count toward the Q16 workload.
  The ledger/header writers, readers and cleanup are still required; the record builder alone does
  not complete S3. See [ADR 0035 D70](../adr/0035-room-authoritative-live-encounters.md#d70-packed-history-with-indexed-receipt-headers--2026-09-29).

- **Development proof drivers go through the Session room (2026-09-24).** Since S4A, browsers can't call Encounter command functions, so the real-backend drivers (`apps/apis/tests/development*.ts`, used by the R08 proofs) can no longer run Encounter commands. The drivers will send Encounter commands over a real Session-room WebSocket with a ticket, as the browser does, and their `.codex/validation` output paths move to `local-validation/`. Rejected alternative: admin-key calls that impersonate a user, which would prove a path production never uses. Foundry and Roll20 have no equivalent; this is a testing-integrity choice.
- **Local deploys are part of local validation (2026-09-24).** `convex codegen` uploads functions only to generate types; it doesn't activate them, so the local backend kept running pre-ADR-0033 functions. Pushing functions to the local Docker deployment is covered by the same local-only authority as resets. Staging and production still need explicit approval.
- **Domain rejections carry a code and a user-safe message (2026-09-24, in the modes and enforcement slice).** The room currently reduces every Encounter failure to a generic message ("The Encounter command could not be completed."). Foundry and Roll20 show players specific warnings. Expected domain rejections, such as "This Campaign already has an active Encounter" or a stale version, become `ConvexError` data `{ code, message }`, following the `RATE_LIMITED` pattern. The room forwards those messages; unexpected errors stay generic, so internals never leak. Drivers assert on codes.
- **Magic ammunition is chosen per weapon (2026-09-25, Phase 8.3; user override: tracking is a Campaign option the GM sets, and with it off bonuses apply but nothing is counted down).** Foundry baseline: a weapon consumes a selected ammunition item, and that item's bonuses apply to the attack. Roll20's 5e sheet also links ammunition per attack. Extensions:
  - auto-select when only one compatible stack is carried;
  - a quick ammunition switch in the attack drawer;
  - ammunition counted down per attack.

  Rejected: GLOBAL ammunition bonuses faceted to launchers, which add up across stacks and remove the player's choice. It needs Sheet UI and inventory consumption, so it lands with Sheet–tabletop integration.

- **`maxBonus` is removed (2026-09-25).** It is on 165 SRD items, has no consumer and duplicates the authored +N modifiers. Removing the field is cleaner than keeping an authoring option that always fails validation. Foundry has no equivalent; magic bonuses are ordinary modifiers there too.
- **The Dwarf heavy-armor speed exception is kept (2026-09-25).** It is SRD text.
- **Unarmored AC formulas choose the best (2026-09-25, queued).** 5e says a creature with several AC formulas picks one, so alternative base formulas (Barbarian, Monk, Draconic Resilience) compete instead of stacking. Foundry's 5e system has the same single-calculation rule.
- **Character maximum HP: one persistence funnel (2026-09-25, revised).** The first decision assumed a single writer, but maximum HP also depends on GM Campaign adjustments and on published content, and nine code paths write the Character document. Revised:
  - the Run keeps no maximum-HP copy and no staleness refusal, because rules already compute the live maximum;
  - for display, one shared Character persistence helper, used by every Character document writer and by GM adjustment writes, recomputes and stores the effective maximum in the same transaction;
  - accepted lag: after a content republish, a Character's stored maximum updates on its next write, while the Sheet always shows the live value (Roll20 is no better; compendium changes don't reach existing characters);
  - rejected: evaluating the full Sheet on every reactive Encounter read (too costly) and a publish-time recompute job for now (infrastructure for a rare case; follow-up).

  Copied Character conditions are also removed from Run actors.

- **Displayed maximum HP includes active reductions (2026-09-25, player-control slice).** Foundry shows the effective maximum with active effects applied, so projections subtract active maximum-HP reductions (such as a vampire's bite) from the stored maximum. Watch item: every Character write now runs a full Sheet evaluation, and some writers reload the catalogue; measure it under the V15 workload before optimizing.

- **"Auto-roll my dice" defaults on and is stored server-side (2026-09-25).** Foundry rolls immediately when you click (manual dice entry is an opt-in configuration), and so does Roll20. So the fast path is the default, and players who roll physical dice turn it off to get the per-roll prompt. It is a profile preference read by the server when a roll is needed:
  - no prompt round trip;
  - works if the roller's client has disconnected;
  - applies on every device.

  It only rolls dice and never chooses anything; see the Assisted rule below.

- **GM void resolves a stuck decision by kind (2026-09-25).** Foundry and Roll20 have no rules prompts to get stuck; any table tool with prompts needs an escape hatch, especially once players drive actions and can disconnect. GM-only, with the outcome depending on the kind of decision:
  - a paused action is cancelled whole;
  - declinable responses resolve as a decline;
  - turn-flow steps are skipped where the flow can continue, and are otherwise refused with guidance.
- **Soft enforcement split (2026-09-25).** In Assisted mode these are warnings with a logged "Do it anyway": action economy, resource/slot/charge availability, range, `requiresEquipped`, target disposition. These stay hard: authorization, stale versions, missing or invisible targets, a player acting out of turn (reactions excepted), invalid game state. "Do it anyway" never drives resources negative; it records the shortfall and shows the GM an override badge. Foundry warns but lets you proceed on most of these (for example casting without a slot, when consumption is unchecked), and Roll20 enforces none. We warn with a GM-visible audit, which is better than silent permissiveness and friendlier than hard blocks.
- **GM undo of the last action (2026-09-25).** Neither Foundry nor Roll20 has combat undo. The GM can revert the last committed action exactly, from the before-states recorded in its receipt. It is refused, with an explanation, if a later command or Sheet write touched an affected actor, or if a transition has no exact inverse. Actions only; movement has its own undo.
- **GM answers any prompt instead of voiding turn steps (2026-09-25).** Voiding a Recharge or a turn-effect save would need a "skipped" variant in stored turn plans and replay. Instead the GM can answer any prompt, including ones routed to a player, and "Roll dice" makes that one click; so a disconnected roller can't wedge a turn. That goes into the player-control slice. Void stays for actions (cancelled) and declinable choices (declined). Correction (user, 2026-09-25): "Assisted means assisted." In Assisted mode the app never acts or chooses on anyone's behalf, so authored "automatic" reactions are offered as a Use/Decline choice to the actor's controller (the GM for monsters). The modes part A change that let them fire on their own is reverted in the player-control slice.
- **Actor disposition follows Foundry (2026-09-25, player-control slice).** Hostile-only targeting warned on every attack because actors had no disposition. Every Run actor now gets a GM-editable Friendly, Neutral or Hostile disposition (default Friendly for Characters, Hostile for Creatures), like Foundry's token disposition. Flanking's ally and enemy relationships read the same field. The action drawer marks already-unavailable actions with their reason before selection.
- **Local Worker configuration (2026-09-24).** `apps/session-worker/.dev.vars` was rebuilt from the local Convex secrets to match `.dev.vars.example`. The retired executor variables are removed from it, from the local Convex env and from the generated Worker types. `RULES_CONTINUATION_SECRET` is now provisioned locally.

## Historical authority snapshot (2026-09-27)

At this historical checkpoint, the fixed ledger was **53/75** cases and **195/276** criteria (2026-09-27; `node scripts/acceptanceProgress.mjs`). The readiness and open-case details in this paragraph describe that checkpoint only. Current status is in the authority section above and the [acceptance JSON](../roadmap/08-2-convex-cutover-acceptance.json).

The cutover keeps heavy live rules **and heavy fact preparation** in the Session Durable Object (DO). Convex owns atomic Character Sheet and Encounter writes and their receipts; Scene publication uses per-entity deltas. Every Encounter command's rules and dice run in the DO (D41). Convex records the listed GM tools and commits room plans through Worker-secret routes, with ordered dispatch and write-ahead crash recovery (D27). V15 is measured, but not yet claimed: see docs/validation/phase-08-2/. No staging, production, retirement, deployment, database reset, journal deletion or real continuation-key transfer is authorized by this handoff.

Current architecture is defined by [ADR 0029](../adr/0029-convex-backend-cutover.md), [live-session coordination](../architecture/live-sessions.md) and [shared rules runtime](../architecture/rules-runtime.md). [ADR 0024](../adr/0024-current-published-authored-content.md) governs current published sources and frozen issued occurrences; its policy supersedes older whole-Character source-vector claims. [ADR 0032](../adr/0032-campaign-deletion-lifecycle.md) governs Campaign deletion. The [release runbook](../runbooks/phase-8-2-release.md) and [remaining-work plan](../roadmap/08-2-convex-cutover-remaining.md) govern promotion order.

## Historical local checkpoints

The latest _completed_ movement-response checkpoint passed **31 focused cases in 8 files**, serial API/Convex/Worker types **10/10**, formatter/lint on **39 TypeScript files**, and an 8-root private import check with no heavy preparation or emitted Kernel/compiler imports. It includes actual private final Passage rollback, one allowance consumption and replay; PLAYER movement Concentration response, child receipt and revoked-assignment refusal; and initial/response movement admission. The source manifest is SHA-256 `27047BE566B2B6180396F7B024054B4D9B03A6ED396C2C4F554C2FC12C373F90` **before** the declaration edits and checkout relocation. The ordered commands, failures corrected before that checkpoint and limits are in [the durable movement summary](../validation/phase-08-2/README.md). They do **not** certify the current working tree.

Initial START and initiative evidence/order responses had separately passed: fresh serial types **10/10**, START/Recharge and round-wrap response cases, exact prior-round history and replay. Round 1 is inserted without replacement, no outgoing effect is applied, and incoming effect ordinal is zero. This does not cover declaration responses or room dispatch. The earlier native+private action, concentration and movement receipts remain supporting scoped evidence in the retained local validation archive, not final-source release proof.

The approved relocation copied **3,376 files**, left **1,526 unchanged**, and removed **1,283 tracked obsolete files** in the regular checkout. The regular checkout's `AGENTS.md` and spell mapper edits were preserved. Transfer evidence is under `local-validation/phase82-relocation-20260924/`. The raw evidence copy from the detached worktree to ignored `local-validation/phase82-goal-20260923/` completed successfully (robocopy exit 3: copied files and extra destination files). The durable summary is under `docs/validation/phase-08-2/`. Immutable Yarn install in the regular checkout passed with existing peer and optional `unix-dgram` warnings; it is not a current-source compiler or test pass.

## Historical work in progress and continuation notes

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

## Paused 2026-09-28 (laptop transport): in-flight work to resume

All agents were stopped cleanly. Their work sits uncommitted or unmerged in worktrees under `.claude/worktrees/`. The branch `codex/phase-08-2-convex-cutover` is clean and pushed at `04b3e46e4` (plus the docs commit for this note).

- **ADR 0035 S1** (Encounter persistence package): `agent-a7995c8923eaefdb1`.
  - 7 validated commits (`ed9841396`…`c7913f11f`), plus work in progress.
  - The work in progress follows the ruling: the package defines its own `EncounterDomainRejection`, which the Convex function wrappers translate to `ConvexError` in one place. That removes the package's runtime `convex` import and the `resolve.dedupe` workaround in `apps/apis/vitest.config.ts`.
  - To resume: finish that change, re-validate, merge, then codegen.
- **ADR 0036 S6** (Builder evaluates in the browser): `agent-a203cdf0908189bd9`. Uncommitted work in progress (snapshot client, access cache tests).
- **ADR 0036 S7** (commit reads only referenced content): `agent-a4f64ace2d4d3c19b`. Uncommitted work in progress (Convex `findEquipment` reader).
- **Next after these,** in order:
  1. The ADR 0035 Amendment 12 record-shape slice.
  2. ADR 0035 S2 (room store).
  3. ADR 0036 S8–S10.
  4. D65 (Cloudflare web hosting).
  5. The Q18 follow-ups.
  6. The queued pre-beta rules work.
- **Open questions:** Q19 (live cursors and ping).
