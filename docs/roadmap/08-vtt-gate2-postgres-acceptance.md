# Phase 08 Gate 2 PostgreSQL acceptance schedules

> **Historical:** This phase record predates the Phase 8.2 Convex cutover ([ADR 0029](../adr/0029-convex-backend-cutover.md)). Its Supabase/Postgres, Kysely/SQL, tRPC, `packages/functions`, `packages/db`, `apps/session-host`, GoRules/Zen, Rule Studio, and Netlify-function references, commands, and paths describe retired implementation. Current behavior is in the [architecture guides](../architecture/overview.md).

> **Authority:** [Phase 08 fixed acceptance ledger](08-vtt-acceptance.md)
>
> **Purpose:** run the fourteen Gate 2 `DATABASE` cases as six bounded local schedules after the
> complete Gate 2 source, schema, migration, generated artifacts, and canonical source data are
> stable. These schedules do not add acceptance cases or change the fixed denominator.

## Entry condition

Run the schedules from one recorded working-tree identity only after focused checks and required
reviews are green. Perform the single planned local reset, generated-type refresh, canonical source
seed, SRD manifest verification, and source audit before schedule 1. A later source, schema,
migration, generated-artifact, or fixture change invalidates the affected schedules.

Every schedule records its command, exit status, duration, database identity, source identity, exact
created-row inventory, and retained log path under `.codex/validation/rules-runtime-rebaseline/`.

## Schedule 1 — migration, hydration, source identity, and cleanup

Proves the coherent migration from a clean local database; FORCE RLS and revoked direct access for
server-only runtime state; canonical System definitions and Campaign policy bindings; Encounter
snapshot hydration; immutable definition/checksum/currentness rules; the complete SRD path manifest;
and exact deletion cleanup.

Acceptance coverage: `G2-SRD-MANIFEST` and the persistence/source prerequisites shared by every Gate
2 case.

## Schedule 2 — automation, actions, random evidence, and outcomes

Runs Automatic, Assisted system dice, Assisted physical dice, Manual OFF, and Manual SUBTLE through
the same Character and immutable Encounter-feature action sources. It proves authorization,
cross-owner Character capability, exact target/selection validation, TEST to optional OUTCOME
continuations, d20 contributor cancellation, critical/save/check behavior, ordered damage/healing/
temporary-hit-point/condition/resource application, matching replay, mismatched replay denial, late
rollback, and action-versus-turn contention.

Acceptance coverage: `G2-AUTOMATION-MODES`, `G2-RANDOM-CONTRIBUTORS`, `G2-ACTION-AUTHORITY`,
`G2-TEST-RESOLUTION`, `G2-OUTCOMES`, and `G2-STATE-RECONCILIATION`.

Status: representative PostgreSQL coverage is complete under the Phase 8 80/20 validation rule.
The real-service tracer proves Campaign-to-Encounter mode snapshots, Assisted system and physical
evidence, Automatic TEST/OUTCOME resolution, Manual OFF/SUBTLE inert behavior, a critical hit, a
miss without outcome evidence, terminal-only damage, matching and mismatched replay, non-member
denial before occurrence creation, rollback, exact fixture cleanup, and the shared state-family
persistence smoke described below. Existing focused suites own
the remaining contributor, save/check, and non-damage outcome branches because they use the same
proven occurrence, receipt, and settlement persistence path. Shared Schedule 6 remains required.

## Schedule 3 — effects, concentration, spatial movement, and perception

Creates target-bound and spatial effects, advances recurrence and expiry, replaces and checks
concentration, and moves full token footprints across ordered ENTER/EXIT/CROSS contacts. It proves
Scene illumination/obscurement/barrier and pinned-sense facts, hidden-source redaction, mandatory
Assisted continuations, token-anchor removal, Character/Encounter/Scene version ownership,
concurrent effect-versus-turn settlement, rollback before receipts, replay without re-evaluation,
foreign-owner cleanup, and exact cleanup.

Acceptance coverage: `G2-EFFECT-LIFECYCLE`, `G2-CONCENTRATION`, and `G2-SPATIAL-PERCEPTION`.

Status: representative PostgreSQL coverage is complete under the Phase 8 80/20 validation rule.
The final current-tree shard passes effect recurrence/expiry, concentration policy, and spatial
occurrence behavior. The expanded real-service PostgreSQL tracer additionally creates, CAS-updates,
stale-CAS rejects, and deletes an Encounter-owned active effect inside the disposable transaction.
The clean local reset and generated schema prove the remaining persistence shape; the shared
occurrence PostgreSQL schedule proves pause/resume, replay, rollback, concurrency, RLS, and cleanup.
Shared Schedule 6 remains required before case acceptance.

## Schedule 4 — reactions and interrupted movement

Exercises eligible and suppressed movement reactions from Character and immutable Encounter-feature
sources, controller-only choices, GM authority, decline, successful React, failed React, reconnect,
resource availability/consumption, same-distance spatial precedence, movement STOP, remaining-path
resume, controller/member/assignment revocation races, duplicate controls, hidden-source privacy, and
exact cleanup. No transaction remains open while waiting for a human choice.

Acceptance coverage: `G2-REACTIONS`.

Status: representative coverage is complete under the Phase 8 80/20 validation rule. Current-tree
focused shards prove source discovery, controller choice and privacy, successful/declined action
settlement, reaction allowance consumption, movement STOP, and exact continuation/remainder behavior
(6 files / 39 tests). The expanded real PostgreSQL tracer persists an exact schema-valid movement-
reaction continuation, re-reads it by the owning Encounter, rejects foreign occurrence identity and
stale CAS, advances and completes it, and proves that terminal completion clears the continuation.
The shared occurrence schedule owns concurrent resume/replay, RLS, rollback, and cleanup. Shared
Schedule 6 remains required before case acceptance.

## Schedule 5 — turns, initiative, legendary lifecycle, recharge, and optional combat

Runs Standard, Initiative Score, Side Initiative, and Speed Factor with Automatic, Assisted, tie,
Creature, Custom-adjudicated, and Manual cases. It proves normalized round/participant currentness,
turn-start/end effects, deterministic side/actor ordering, Legendary Action refresh and ordered
owner choices, Legendary Resistance, recharge, stale resource/source denial, and all fourteen
approved optional-combat variants using their pinned System definitions and Encounter snapshot.
Concurrent START/advance/choice/action commands must settle under the canonical lock order.

Acceptance coverage: `G2-TURN-INITIATIVE`, `G2-LEGENDARY-RECHARGE`, and `G2-OPTIONAL-COMBAT`.

Status: representative coverage is complete under the Phase 8 80/20 validation rule. Current-tree
focused shards prove Manual/Automatic/Assisted initiative settlement, actor and side ordering, bounded
tie resolution, Legendary Action and Resistance resource lifecycles, recharge, immutable optional-rule
snapshots, the complete optional-combat coverage manifest, and the implemented flanking/facing/
resolution/geometry policies (13 files / 107 tests). The expanded real-service PostgreSQL tracer also
creates and locks the normalized initiative round/participant state, proves round CAS and stale-CAS
denial, and roundtrips the immutable optional-combat snapshot/checksum. The clean local reset and
shared occurrence PostgreSQL schedule own replay, rollback, concurrency, RLS, and cleanup for these
shared contracts. Shared Schedule 6 remains required before case acceptance.

## Schedule 6 — cross-case adversarial replay, privacy, rollback, and cleanup

Replays the stored command corpus from schedules 2–5 and runs the cross-cutting denial/race matrix:
matching and mismatched command IDs, stale aggregate/definition/source/occurrence versions, foreign
occurrence IDs, Campaign archive, Session closure, lease acquisition/revocation, member removal,
Character reassignment, duplicate concurrent submissions, injected failure immediately before root
receipt, receiver-specific projections, and root/child event correlation. It finishes by deleting all
created Campaign, Session, Encounter, Scene, Character, occurrence, effect, decision, event, media,
profile, and authorization fixtures and asserting their tracked counts are zero.

Acceptance coverage: the authorization, idempotency, replay, rollback, privacy, deterministic
concurrency, and exact-cleanup subchecks required by all fourteen Gate 2 cases.

Status: complete under the Phase 8 80/20 acceptance rule. The final current-tree cross-case shard
passes occurrence pause/resume and replay, direct-action authorization and receipts, active-effect
state, initiative occurrences, receiver-safe projections, and spatial/reaction pending summaries
(6 files / 86 tests). The retained real PostgreSQL occurrence and expanded action/state tracers prove
same-command concurrency, matching and mismatched replay, authorization denial, reaction aggregate
scoping and stale CAS, active-effect and initiative CAS, rollback, RLS, and disposable-fixture cleanup.

## Acceptance rule

A focused or review-green case remains `IN_PROGRESS` until its owning schedules and every shared
cross-case assertion in schedule 6 pass from the same final source state. The primary architect then
records the schedule evidence on the existing case and changes only that case's status to `ACCEPTED`.
