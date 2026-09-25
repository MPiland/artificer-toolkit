# Phase 8.2 Gate 4: Scene, Encounter, VTT

- **Status:** transitional evidence summary
- **Scope:** acceptance status and evidence origin for the 15 Gate 4 cases
- **Update when:** a Gate 4 case or criterion in the [acceptance ledger](../../roadmap/08-2-convex-cutover-acceptance.json) changes status or evidence
- **Recorded:** 2026-09-25, from the ledger; run `node scripts/acceptanceProgress.mjs` for live counts

Gate 4 has **5/15** cases and **31/81** criteria accepted.

The ledger's `criteria` arrays are the authority for what each case must prove; this page summarizes them with the proof tier and where the evidence came from. Raw logs are not copied here.

> **Evidence location.** Most raw evidence lives only in the Codex backup worktree, under `.codex/worktrees/phase-08-2-convex-cutover/.codex/validation/`: [open question Q2](../../handoffs/phase-08-2-open-questions.md#resolved) counts 653 of the ledger's 725 evidence references there, and every one of the 675 entries in the ledger's evidence arrays uses a `.codex/validation/` path. Only the `phase82-goal-20260923` packet is also copied to ignored `local-validation/`. The final R08 re-proof on the final source will supersede this evidence; the backup worktree is deleted only after R08 passes.

## V01 — Encounter Blueprints

- **Status:** ACCEPTED
- **Accepted:** 2026-09-09 (notes)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `V01.1` ACCEPTED: Blueprints are private, System-scoped and paginated, with capacity limits.
- `V01.2` ACCEPTED: Updates replay exactly, reject stale versions and roll back, and checksums and pinned Creature/Equipment provenance validate.
- `V01.3` ACCEPTED: The actual backend denies anonymous and foreign calls and passes create replay/conflict, listing and cleanup with stale-JWT denial.

Evidence:

10 ledger reference(s), 10 under `.codex/validation/` in the backup worktree:

- `phase82-blueprints` (4)
- `phase82-v01-final` (4)
- `phase82-static-api-never` (2)

## V02 — Campaign Scenes independent of Encounters

- **Status:** ACCEPTED
- **Accepted:** not recorded; packet phase82-scene-live-acceptance-20260913
- **Proof tier:** LOCAL_E2E
- **Criteria met:** 3/3

What was proven or remains to prove:

- `V02.1` ACCEPTED: The owner uploads a map and creates, edits and reloads a Scene with an immutable initial live snapshot.
- `V02.2` ACCEPTED: GM and player hydrate independently, live edits converge and private tokens are excluded.
- `V02.3` ACCEPTED: Offline updates recover after reload, and fixture, account and R2 cleanup and stale-JWT refusal pass.

Evidence:

8 ledger reference(s), 8 under `.codex/validation/` in the backup worktree:

- `phase82-ultra-continuation-20260911 (nativeWebSelectorEvidence)` (1)
- `phase82-scene-assessment` (1)
- `phase82-scene-live-acceptance-20260913` (1)
- `phase82-scene-owner-live` (1)
- `phase82-scene-presentation` (2)
- `phase82-scene-save` (1)
- `phase82-scene-web` (1)

## V03 — Scene entities, geometry, and visibility facts

- **Status:** IN_PROGRESS
- **Accepted:** 2026-09-11 (reopened 2026-09-25, ADR 0034)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/5

Reopened 2026-09-25 for ADR 0034 player agency criteria. Earlier scoped acceptance evidence still backs the ACCEPTED criteria; the player agency criteria are unproven.

What was proven or remains to prove:

- `V03.1` ACCEPTED: All six entity collections and persisted geometry keep recipient privacy and separate definition and live Scene state.
- `V03.2` ACCEPTED: Exact replay, competing writes, stale versions and entity/fog/head/receipt rollback pass through the shared verifier.
- `V03.3` ACCEPTED: Maximum-polygon and full fog-capacity coverage is kept without smaller Scene limits.
- `V03.4` IN_PROGRESS: Players may open and close unlocked doors, and locking stays GM-only (ADR 0034).
- `V03.5` IN_PROGRESS: Fog of war is opt-in per Scene: with fog off, players see every non-hidden token, wall, door and light; with fog on, the shared-party or per-player exploration model applies (ADR 0034).

Evidence:

1 ledger reference(s), 1 under `.codex/validation/` in the backup worktree:

- `phase82-ultra-continuation-20260911` (1)

## V04 — R2-backed maps and Scene media lifecycle

- **Status:** ACCEPTED
- **Accepted:** 2026-09-10
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/3

What was proven or remains to prove:

- `V04.1` ACCEPTED: Signed map upload, finalization and decoded delivery work, and Scenes save and reload with the map.
- `V04.2` ACCEPTED: A Campaign transfer preserves uploader ownership and the byte charge.
- `V04.3` ACCEPTED: Deletion restrictions, including live-only protection, hold, and provider prefixes are empty after the fence.

Evidence:

13 ledger reference(s), 13 under `.codex/validation/` in the backup worktree:

- `phase82-vtt-map-upload` (4)
- `phase82-scene-presentation` (4)
- `phase82-scene-web` (1)
- `phase82-scene-owner-live` (1)
- `phase82-v04-retention` (3)

## V05 — Session admission and presence

- **Status:** IN_PROGRESS
- **Accepted:** 2026-09-09 (reopened 2026-09-24, ADR 0033)
- **Proof tier:** AUTHORIZATION
- **Criteria met:** 0/5

Reopened 2026-09-24 under ADR 0033. Its earlier evidence proves the superseded Session-scoped contract and is historical; the case must pass again on the final source.

What was proven or remains to prove:

- `V05.1` IN_PROGRESS: Any ACTIVE Campaign member can get a ticket without an open Session; ticket issue and authority claim require current membership and an ACTIVE Campaign (ADR 0033).
- `V05.2` IN_PROGRESS: Tickets are signed, single-use, valid for one minute and bound to the Campaign's room.
- `V05.3` IN_PROGRESS: The Durable Object rejects invalid origins, signatures, claims, rooms and replay, and renews current authority under a lock before READY.
- `V05.4` IN_PROGRESS: Renewal closes removed or stale-role sockets, keeps valid users and rotates authority to another current member.
- `V05.5` IN_PROGRESS: The room activates on the first admitted socket, drains its outbox and releases authority after five minutes without one, and closes on Campaign archive or deletion (ADR 0033).

Evidence:

6 ledger reference(s), 6 under `.codex/validation/` in the backup worktree:

- `phase82-v05-final` (6)

## V06 — Transient collaboration through the Durable Object

- **Status:** ACCEPTED
- **Accepted:** not recorded; packet phase82-scene-live-acceptance-20260913
- **Proof tier:** LOCAL_E2E
- **Criteria met:** 3/3

What was proven or remains to prove:

- `V06.1` ACCEPTED: Owner and player exchange previews through the Durable Object before and after JWT expiry and renewal.
- `V06.2` ACCEPTED: After a socket disconnect the client reconnects, rehydrates and reloads, and a departed player is refused.
- `V06.3` ACCEPTED: Privacy, deadline expiry, hibernation, queued previews and membership/authentication races hold.

Evidence:

4 ledger reference(s), 4 under `.codex/validation/` in the backup worktree:

- `phase82-scene-live-acceptance-20260913` (1)
- `phase82-ultra-continuation-20260911` (3)

## V07 — Committed token movement and multi-client convergence

- **Status:** IN_PROGRESS
- **Accepted:** 2026-09-17 (notes; reopened 2026-09-25)
- **Proof tier:** LOCAL_E2E
- **Criteria met:** 3/5

Reopened 2026-09-25 for ADR 0034 player agency criteria. Earlier scoped acceptance evidence still backs the ACCEPTED criteria; the player agency criteria are unproven.

What was proven or remains to prove:

- `V07.1` ACCEPTED: Bound and standalone movement publish validated sampled paths and fog atomically, with current authority, token control, fences and replay.
- `V07.2` ACCEPTED: Movement reactions, Passage continuation, stopped-path fog and GM undo pass in the browser.
- `V07.3` ACCEPTED: Peers converge, and reconnect, reload and current departure refusal pass with exact cleanup.
- `V07.4` IN_PROGRESS: A player commits moves of tokens they control outside Encounters, and unbound tokens keep Scene token control (ADR 0034).
- `V07.5` IN_PROGRESS: Moves of Encounter-bound tokens follow the actor-control predicate, and a player's remaining movement is shown but not enforced (ADR 0034).

Evidence:

5 ledger reference(s), 5 under `.codex/validation/` in the backup worktree:

- `phase82-ultra-continuation-20260911` (1)
- `scene-passage-coordinator-20260914` (1)
- `movement-replay-duplicates-20260916` (3)

## V08 — Encounter lifecycle and optional Scene binding

- **Status:** IN_PROGRESS
- **Accepted:** 2026-09-11 (reopened 2026-09-24, ADR 0033)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 0/6

Reopened 2026-09-24 under ADR 0033. Its earlier evidence proves the superseded Session-scoped contract and is historical; the case must pass again on the final source.

What was proven or remains to prove:

- `V08.1` IN_PROGRESS: Encounter Runs belong to the Campaign and carry no Session reference, and a PREPARED Run can be deleted (ADR 0033).
- `V08.2` IN_PROGRESS: START requires no other ACTIVE Run in the Campaign, and an ACTIVE Run persists across sittings until COMPLETE (ADR 0033).
- `V08.3` IN_PROGRESS: Runs in Manual and Assisted mode freeze snapshots, accept normalized corrections and progress later (ADR 0034 removes AUTOMATIC).
- `V08.4` IN_PROGRESS: Run-to-Scene bindings are immutable and actor-token bindings are versioned, with successive token reuse and historical receipts.
- `V08.5` IN_PROGRESS: The Campaign presents zero or one live Scene, and presentation survives reconnects, Encounter completion and Session finish (ADR 0033).
- `V08.6` IN_PROGRESS: Forced rollbacks and real command, binding, presentation and ownership races leave consistent state, with exact cleanup.

Evidence:

7 ledger reference(s), 7 under `.codex/validation/` in the backup worktree:

- `phase82-blueprints` (1)
- `phase82-native-optional-combat-final` (1)
- `phase82-v08-automation-proof` (1)
- `phase82-v08-rollback-proof` (1)
- `phase82-v08-auth` (2)
- `phase82-v08-lifecycle` (1)

## V09 — Encounter actors and initiative

- **Status:** IN_PROGRESS
- **Accepted:** 2026-09-17 (reopened 2026-09-24, ADR 0033)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 0/7

Reopened 2026-09-24 under ADR 0033. Its earlier evidence proves the superseded Session-scoped contract and is historical; the case must pass again on the final source.

What was proven or remains to prove:

- `V09.1` IN_PROGRESS: Actor removal, remaining-turn reorder and initiative-position reinforcement preserve the cursor, history, pending decisions, source authority, privacy and checksums.
- `V09.2` IN_PROGRESS: Actor, side and cadence initiative scenarios pass current-round and next-round eligibility, same-version reinforcement races, exact replay and rollback.
- `V09.3` IN_PROGRESS: A Run takes its party from the Campaign's ACTIVE Character assignments, and the GM removes absent Characters before START (ADR 0033).
- `V09.4` IN_PROGRESS: Each Run actor has GM-set controllerUserIds limited to current players, and a Character actor's assigned player is always a controller.
- `V09.5` IN_PROGRESS: One predicate (encounters/actorController.ts) decides control: the GM always, and a controller for that actor.
- `V09.6` IN_PROGRESS: Each Run actor has a GM-editable disposition, FRIENDLY for Characters and HOSTILE for creatures by default.
- `V09.7` IN_PROGRESS: Removing a member drops them from every controller list, and development rows are migrated.

Evidence:

7 ledger reference(s), 7 under `.codex/validation/` in the backup worktree:

- `phase82-blueprints` (1)
- `movement-replay-duplicates-20260916` (4)
- `local-convex-linux-20260915` (1)
- `phase82-ultra-encounter-web (nativeWebEvidence)` (1)

## V10 — Actions, reactions, effects, and selected optional combat rules

- **Status:** IN_PROGRESS
- **Accepted:** 2026-09-17 (notes; reopened 2026-09-25)
- **Proof tier:** LOCAL_E2E
- **Criteria met:** 4/11

Reopened 2026-09-25 for ADR 0034 player agency criteria. Earlier scoped acceptance evidence still backs the ACCEPTED criteria; the player agency criteria are unproven.

What was proven or remains to prove:

- `V10.1` ACCEPTED: Actions and reactions resolve with selected optional combat rules, including Assisted Disarm evidence and the held-item transition.
- `V10.2` ACCEPTED: Effect saves resolve with correct outcomes and privacy.
- `V10.3` ACCEPTED: Enemy Feature action rolls evaluate immutable definitions once, spend exact charges atomically and replay without rerolling or recharging.
- `V10.4` ACCEPTED: Optional-combat selections can be replaced with checksum-protected, same-System, Campaign-enabled definitions on prepared or active Runs.
- `V10.5` IN_PROGRESS: A player resolves actions for actors they control on that actor's turn, and ends that turn.
- `V10.6` IN_PROGRESS: Actions for other actors or uncontrolled creatures, out-of-turn actions and hidden targets are refused with domain rejections.
- `V10.7` IN_PROGRESS: A granted companion can be used until control is revoked.
- `V10.8` IN_PROGRESS: Target disposition warnings compare dispositions, and the action drawer shows unavailable actions dimmed with their reasons.
- `V10.9` IN_PROGRESS: In Assisted mode, bendable rule checks warn and allow a logged "Do it anyway" that the GM sees as a badge, and never drive resources negative (ADR 0034).
- `V10.10` IN_PROGRESS: A player has at most one Encounter command in flight.
- `V10.11` IN_PROGRESS: GM undo reverts the last committed action exactly from its receipt's before-states, or refuses with an explanation when a later command or Sheet write touched an affected actor (ADR 0034).

Evidence:

5 ledger reference(s), 5 under `.codex/validation/` in the backup worktree:

- `phase82-native-optional-combat-final` (1)
- `scene-passage-coordinator-20260914` (1)
- `movement-replay-duplicates-20260916` (3)

## V11 — Decisions, pause, and resume

- **Status:** IN_PROGRESS
- **Accepted:** not recorded; packet v11-acceptance-20260916 (reopened 2026-09-25)
- **Proof tier:** LOCAL_INTEGRATION
- **Criteria met:** 3/10

Reopened 2026-09-25 for ADR 0034 player agency criteria. Earlier scoped acceptance evidence still backs the ACCEPTED criteria; the player agency criteria are unproven.

What was proven or remains to prove:

- `V11.1` ACCEPTED: Pending decisions reach only current audiences through private pending projections that follow authority changes.
- `V11.2` ACCEPTED: Paused state is preserved, validated sequential evidence resumes the flow, and DECLINE cancels.
- `V11.3` ACCEPTED: Disarm03 proves participant evidence, nonparticipant and stale refusal, terminal contention, one ACTION, one item transition and unchanged replay.
- `V11.4` IN_PROGRESS: A roll is answered by the controllers of the actor making it and by the GM; a player's spell against a creature pauses on the creature's save for the GM.
- `V11.5` IN_PROGRESS: "Roll dice" records every attempt in the roll log without settling.
- `V11.6` IN_PROGRESS: A response settles with the latest app roll ID or entered faces, never with a client-supplied app value.
- `V11.7` IN_PROGRESS: The chosen d20 mode is stored beside the derived mode and labeled when changed.
- `V11.8` IN_PROGRESS: In Assisted mode an authored automatic reaction becomes a Use/Decline choice for its controller.
- `V11.9` IN_PROGRESS: The "Auto-roll my dice" preference is stored server-side, defaults on, and only produces dice results without making choices (ADR 0034).
- `V11.10` IN_PROGRESS: GM void cancels a paused action whole and resolves declinable choices as declined (ADR 0034).

Evidence:

3 ledger reference(s), 3 under `.codex/validation/` in the backup worktree:

- `movement-decision-privacy-20260913` (1)
- `scene-passage-coordinator-20260914` (1)
- `v11-acceptance-20260916` (1)

## V12 — Player and GM privacy and redaction

- **Status:** IN_PROGRESS
- **Accepted:** not recorded; packet v12-authorization-20260916 (reopened 2026-09-25)
- **Proof tier:** AUTHORIZATION
- **Criteria met:** 3/8

Reopened 2026-09-25 for ADR 0034 player agency criteria. Earlier scoped acceptance evidence still backs the ACCEPTED criteria; the player agency criteria are unproven.

What was proven or remains to prove:

- `V12.1` ACCEPTED: The GM receives full data, Character controllers receive their decisions, other players receive redacted views, and hidden actors, targets and server snapshots are excluded.
- `V12.2` ACCEPTED: Anonymous, outsider, departed and revoked users are refused, and ownership transfer changes the audience.
- `V12.3` ACCEPTED: Every current producer uses the reviewed current-authority dispatcher.
- `V12.4` IN_PROGRESS: Every command result and replay a player receives is the redacted player projection, and the room refuses anything else.
- `V12.5` IN_PROGRESS: A replay by command ID is returned only to its issuer.
- `V12.6` IN_PROGRESS: The player projection carries no actor health by default.
- `V12.7` IN_PROGRESS: Health display is Hidden by default, Descriptive, Bar or Exact; each player sets it for their Character and the GM per Encounter with per-actor overrides, and the GM always sees exact values (ADR 0034).
- `V12.8` IN_PROGRESS: Another player's Character Sheet is GM-only unless its "Party can view" option is on, personality and background are never shown to other players, and the Campaign roster shows only public basics (name, portrait, level, class) (ADR 0034).

Evidence:

2 ledger reference(s), 2 under `.codex/validation/` in the backup worktree:

- `movement-decision-privacy-20260913` (1)
- `v12-authorization-20260916` (1)

## V13 — Receipts, replay, and reconnect

- **Status:** ACCEPTED
- **Accepted:** 2026-09-17 (notes)
- **Proof tier:** LOCAL_E2E
- **Criteria met:** 3/3

What was proven or remains to prove:

- `V13.1` ACCEPTED: Four gameplay journeys retain exact root, terminal and evidence comparisons, with no double spend, reroll or recharge.
- `V13.2` ACCEPTED: Retry and refusal, GM undo, and current authority and privacy hold after an actual reconnect and reload.
- `V13.3` ACCEPTED: Passage continuation spends nothing before the terminal step and rolls back and retries within the same mutation.

Evidence:

4 ledger reference(s), 4 under `.codex/validation/` in the backup worktree:

- `scene-passage-coordinator-20260914` (1)
- `movement-replay-duplicates-20260916` (3)

## V14 — Same-aggregate contention and unrelated concurrency

- **Status:** IN_PROGRESS
- **Accepted:** not recorded; packet v14-acceptance-20260916 (reopened 2026-09-24)
- **Proof tier:** CONCURRENCY
- **Criteria met:** 0/5

Reopened 2026-09-24 under ADR 0033. Its earlier evidence proves the superseded Session-scoped contract and is historical; the case must pass again on the final source.

What was proven or remains to prove:

- `V14.1` IN_PROGRESS: Lifecycle, binding, presentation and ownership race schedules pass against Campaign-keyed Runs and presentation (ADR 0033).
- `V14.2` IN_PROGRESS: Same-Scene movement contention and distinct-Scene writes stay consistent.
- `V14.3` IN_PROGRESS: Same-Run actions serialize while independent Runs proceed.
- `V14.4` IN_PROGRESS: A terminal reaction outcome race has one winner, one stale loser, one reaction spend and one mechanics receipt, and winner, root and loser replay preserve state.
- `V14.5` IN_PROGRESS: An Encounter reads a Character's HP and state live from the Character at capture time, fenced by the captured revisions; the Run keeps no Character HP, maximum, condition or stream-version mirror, so a Sheet write no longer refuses that Character's Encounter commands (ADR 0034).

Evidence:

2 ledger reference(s), 2 under `.codex/validation/` in the backup worktree:

- `phase82-ultra-continuation-20260911` (1)
- `v14-acceptance-20260916` (1)

## V15 — Local and managed performance simulation

- **Status:** IN_PROGRESS
- **Accepted:** never accepted
- **Proof tier:** PERFORMANCE
- **Criteria met:** 0/4

What was proven or remains to prove:

- `V15.1` IN_PROGRESS: The frozen local workload (one GM, five players, eleven actors, eight rounds, up to two actions and one reaction per actor turn) completes with same-aggregate conflicts, unrelated concurrency, replay, rollback and privacy.
- `V15.2` IN_PROGRESS: Local measurements meet ephemeral preview p95 of 150 ms or less, warm durable convergence p95 of 250 ms or less and p99 of 500 ms or less, and gameplay command p95 of one second or less.
- `V15.3` IN_PROGRESS: The workload includes player-issued commands for the actors players control (ADR 0034).
- `V15.4` NOT_STARTED: The managed workload passes the same thresholds as part of authorized R09 promotion.

Evidence:

1 ledger reference(s), 1 under `.codex/validation/` in the backup worktree:

- `phase82-goal-20260923` (1)
