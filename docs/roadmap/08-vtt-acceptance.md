# Phase 08 fixed acceptance ledger

> **Note:** Implementation references in this ledger to PostgreSQL/Supabase, the Netlify executor, `apps/session-host`, Zen/rule packs, and SQL schedules predate the Phase 8.2 Convex cutover ([ADR 0029](../adr/0029-convex-backend-cutover.md)) and are historical. Convex cutover acceptance is tracked in the [Phase 8.2 ledger](08-2-convex-cutover-acceptance.md).

> **Status:** active rebaseline
>
> **Scope:** fixed product acceptance scenarios for the rules runtime, Encounter automation, VTT workflows, presentation, and complete local release proof
>
> **Machine-readable ledger:** [08-vtt-acceptance.json](08-vtt-acceptance.json)
>
> **Gate 2 database schedules:** [08-vtt-gate2-postgres-acceptance.md](08-vtt-gate2-postgres-acceptance.md)
>
> **Architecture:** [Shared rules runtime](../architecture/rules-runtime.md)
>
> **Preserved-work map:** [Phase 08 pre-rebaseline salvage map](08-vtt-salvage.md)

## Governance

The denominators are frozen at **12 / 14 / 10 / 8 / 10**. Engineering proofs and regression
subchecks may expand beneath a scenario without changing its denominator. A denominator changes only
when the architect explicitly approves new product scope.

Statuses are `NOT_STARTED`, `IN_PROGRESS`, `READY_FOR_ACCEPTANCE`, `ACCEPTED`, or `BLOCKED`.
Implementation evidence is not acceptance. The primary architect accepts a scenario only after its
required proof tier is green against the same source state.

Proof tiers are fixed per case in the JSON ledger:

- `FOCUSED`: focused contract/unit/property tests, affected package typecheck/build, and diff checks.
- `REVIEW`: `FOCUSED` plus independent targeted review of the complete scenario seam.
- `DATABASE`: `REVIEW` plus bounded local PostgreSQL authorization, replay, rollback, privacy,
  cleanup, and concurrency schedules where applicable.
- `BROWSER`: `REVIEW` plus focused browser interaction, accessibility, selector, and reconnect
  coverage against the authoritative backend.
- `LOCAL_E2E`: the complete final-source local lifecycle required by repository policy, including
  generated artifacts, database reset/seed/audit, transaction schedules, browser journeys, privacy,
  performance, and exact cleanup.

A case cannot be promoted by evidence from a lower tier. Evidence paths and the exact source identity
must be recorded in the case's acceptance packet; later affected changes invalidate that evidence.

Architect escalation follows root `AGENTS.md`: workers escalate through the integration owner only
when a finding changes product behavior, a public/persisted contract, security, concurrency,
load-bearing ownership, an ADR, or a frozen acceptance scenario. Ordinary implementation decisions do
not stop the gate.

The earlier ignored 13/70/16/12/21 technical matrix is historical evidence only. Its proofs may be
mapped into these scenarios after review; no former status transfers automatically.

## Execution ownership

One integration owner controls shared schemas, the Rules Kernel, migrations, generated artifacts, and
acceptance state. Gate 1 uses one writer because those contracts overlap. After Gate 1 interfaces are
frozen, bounded agents may work concurrently on disjoint capability/source/UI lanes with explicit file
and contract ownership. Validators and reviewers never mutate source. Multiple independent
orchestrators must not write the same worktree or reinterpret architecture.

## Gate 1 — Rules foundation (12/12)

1. Game System capability isolation. **ACCEPTED** — the Rules Runtime sub-contract is isolated from
   separately owned Authoring, Campaign/aggregate, and VTT capabilities; System UUIDs canonicalize;
   missing, duplicate, and cross-System family/fact/operation registrations fail closed; no
   D&D/edition/model dispatch remains in the shared compiler/runtime. Final evidence: 22 focused
   tests, affected build/lint/format/diff checks, and independent review clean.
2. Rules Catalogue and Content Source binding. **ACCEPTED** — server-only catalogues, immutable
   Content Source provenance, reusable-definition publication, trusted bootstrap, and aggregate/root
   bindings passed focused, review, seed/audit, and PostgreSQL concurrency/cleanup proof.
3. UUID identity and same-System reference integrity. **ACCEPTED** — PostgreSQL UUID inputs
   canonicalize before equality and uniqueness checks, deterministic seeded UUIDs remain valid, and
   composite foreign keys reject cross-System bindings.
4. Bounded typed graph validation and rejection. **ACCEPTED** — `321af79`; 13 focused tests,
   affected build/lint/format green, independent review clean.
5. Draft, Publish, and current-active lifecycle. **ACCEPTED** — one normalized draft/current
   publication path is compile-validated and passed stale-version, publish replacement, RLS,
   rollback, and concurrent-settlement database proof.
6. Runtime capability discovery. **ACCEPTED** — Character action discovery resolves exact UUID-backed
   Effect entry points through the code-owned Game System adapter, rejects malformed authored identity
   before play, fails closed for unknown Systems, and leaves public Character projections unchanged.
   Focused schema/runtime tests and builds are green; repeat independent review is clean.
7. Runtime execution, continuation, and receipt lifecycle. **ACCEPTED** — Character and Encounter
   occurrences and separate receipts retain aggregate ownership; pauses, re-pauses, and receipt-only
   completions retain the locked root version; domain-applied completion advances exactly once with a
   genuine domain event/projection. Focused tests, repeat deep review, clean local reset, and bounded
   PostgreSQL replay, rollback, RLS, concurrency, and exact-cleanup schedules are green.
8. Live source updates with frozen occurrences. **ACCEPTED** — fresh Character and Encounter uses
   read the exact current published definition, while paused occurrences and completed receipts retain
   their original source. Deterministic PostgreSQL schedules prove old/new publication ordering,
   unauthorized publish denial, service-level rollback, replay, and exact cleanup; repeat deep review
   is clean.
9. Override, Edit Source, and Create New separation. **ACCEPTED** — Character Sheet adjustments
   remain aggregate-local, editing and publishing preserves the reusable source UUID while replacing
   future behavior, and duplication creates a separately owned, deep-remapped draft with no source
   linkage. Existing focused lifecycle and clone-isolation tests are sufficient for this REVIEW-tier
   case; independent review is clean.
10. Campaign and Character compatibility enforcement. **ACCEPTED** — Campaign catalogue changes,
    Character bindings, assignments, trigger invariants, and primary/additional contention enforce
    exact same-System compatibility under authoritative locks.
11. Reusable Encounter Blueprint and independent Encounter Run persistence. **ACCEPTED** —
    creator-owned versioned Blueprints and Campaign/Session-owned Runs pin exact System, setup, and
    projection identity; legacy Template receipts replay; unsafe numeric migrations fail atomically;
    valid scale-only JSON retains runtime checksum parity; and focused plus PostgreSQL schedules prove
    locks, replay, RLS, rollback, interruption recovery, and exact cleanup. Repeat deep review is clean.
12. Neutral portability tracers plus canonical documentation and ERDs. **ACCEPTED** — current
    threshold/integer-evidence tracers prove System-neutral compile, execute, pause/resume, and
    live-fact binding; canonical guides and ERD accurately separate implemented, remaining, target,
    and superseded behavior after independent review.

## Gate 2 — Authoritative mechanics (14/14)

All fourteen fixed cases are accepted under the approved Phase 8 80/20 validation rule. The six
bounded schedules retain real PostgreSQL evidence for every distinct persistence family and shared
concurrency/replay/rollback/privacy/cleanup behavior; branch permutations that reuse those proven
contracts remain covered by focused tests or are explicitly logged below as post-MVP deferrals.

1. Automatic, Assisted, Manual, and sanitized reminder behavior. **ACCEPTED** — Campaign
   defaults and explicit Encounter Run snapshots are implemented. Direct Character actions now
   execute automatically, pause/resume through sealed Assisted system or physical evidence, or
   complete as receipt-only Manual commands with OFF/SUBTLE sanitized reminders. Focused proof and
   independent review are clean. The bounded PostgreSQL tracer proves all three modes through real
   Campaign settings and Encounter snapshots, exact replay without reroll or mutation, transaction
   rollback, and disposable-fixture cleanup; the remaining Schedule 2 rows and shared Schedule 6
   adversarial checks still gate acceptance.
2. Random evidence, d20 contributors, cancellation, and other supported tests. **ACCEPTED** —
   the shared optional d20 contributor aggregator, trusted production derivation, complete
   one-stage raw-roll evidence, canonical contributor checksum, and replay validation are
   implemented and independently review-clean; database schedules and acceptance remain.
3. Action authorization, selections, targets, and cross-owner outcomes. **ACCEPTED** — the
   bounded Character tracer retains exact authored target policy and supports only Self plus one
   unlimited, unshaped, `ANY` single Character target. Locked assignment/currentness checks,
   target-owner independence, source-resource/target-state atomicity, exact replay, and stale
   Assisted-overlay rejection are implemented and independently review-clean; database acceptance
   remains.
4. Attacks, criticals, saving throws, and checks. **ACCEPTED** — the rebaseline kernel now
   compiles and validates pinned D&D attack/save decision graphs with one selected d20 evidence
   stage, locked authoritative facts, and complete ordered branch receipts. Authored saving throws and
   ability-modifier DC components now use exact System-owned ability-definition UUIDs through
   authoring, persistence, immutable Character/Creature capability discovery, and D&D policy facts;
   unbound or cross-System reads fail closed. Focused execution and replay proofs are independently
   review-clean, while the coherent migration and database acceptance remain.
5. Damage, healing, temporary hit points, conditions, and resources. **ACCEPTED** — bounded
   sequential HP, temporary-HP, condition, and resource applications now use locked before-state,
   exact authorized-candidate coverage, one Character event, one Encounter projection/event, and
   replay-safe private receipts; focused proof and independent review are clean, while database
   rollback/concurrency acceptance remains.
6. Grants, modifiers, aggregate state, and rules-based reconciliation. **ACCEPTED** — bounded
   Encounter usage-track reconciliation plus UUID-backed System capability and condition-suppression
   definitions are implemented. Locked Character and Encounter-actor condition state now resolves
   exact pinned capability availability without condition-name branching; database acceptance remains.
7. Active/passive effects, recurrence, duration, and expiry. **ACCEPTED** — separate
   aggregate-owned Character and Encounter active-effect state now preserves immutable definition
   identity, the exact frozen execution graph, mutable lifecycle state, owner-scoped CAS, and
   Encounter-first Character cleanup discovery. A bounded direct-action tracer creates one
   Character-owned recurring effect only after terminal Automatic or Assisted execution, advances
   effect-only Character state, records source-bound private receipt evidence, and performs no
   creation in Manual, pending, or replay paths. Focused proof and repeat deep review are clean;
   turn-boundary recurrence/expiry and final database concurrency, rollback, RLS, and cleanup
   acceptance remain.
8. Concentration start, replacement, checks, cleanup, and privacy. **ACCEPTED** — the D&D
   adapter owns stable UUID-backed concentration check and maintenance definitions, with the check
   selecting an exact UUID-backed ability from immutable System vocabulary snapshot v2. Finalized
   positive damage creates deterministic child occurrences with canonical contributor, definition,
   vocabulary, Character-projection, maintained-state, and damage-context evidence. Automatic mode
   resolves server dice and exact cleanup; Assisted mode creates sealed pending children, supports
   physical or system dice, chains remaining checks, authorizes only the current GM or maintained
   Character controller, returns redacted pending summaries, and recovers them through an authorized
   reconnect query. Manual remains inert. Focused execution, replay, privacy, and independent review
   are clean. Canonical definition publication/seed audit, real PostgreSQL authorization and lock
   races, foreign-owner cleanup, rollback, exact projection/event ownership, and later UI/browser
   prompt and reconnect acceptance remain.
9. Movement, spatial geometry, perception, auras, and traps. **ACCEPTED** — authoritative
   full-footprint path contact, sealed spatial pause/resume, exact Character/Encounter/Scene
   transition reporting, pinned UUID-backed senses, typed active-effect perception contributions,
   authoritative Scene illumination/obscurement/barrier facts, exact pending occurrence-to-Scene
   bindings, non-regressing persisted-replay recovery, and local-host/managed-worker delivery are
   implemented with focused proof. Full-footprint Scene distance includes a reviewed staggered-overlap
   regression; Scene fog, token-hidden state, labels, and recipient projections are excluded from
   mechanics. Production reaction consumption, authorized projection, and bounded PostgreSQL
   authorization, replay, rollback, privacy, concurrency, and exact-cleanup acceptance remain.
10. Reactions, durable choices, interruption, reconnect, and resource use. **ACCEPTED** — the
    authored foundation now binds a UUID-backed reaction Effect to one closed movement stage,
    nullable Combat Perception requirement, and UUID-backed System eligibility definition without
    adding a reaction-specific graph format. Normalized Character facts preserve the exact binding or
    explicit `null`; reach and all eligibility/resource policy remain System graph facts. Deterministic
    full-footprint reach collection, exact Character and immutable Encounter-feature source discovery,
    collision-free token/action contact identity, System-owned eligibility evaluation, and execution of
    a selected movement reaction through the ordinary D&D action graph have focused green proof.
    Current action/reaction suppression now comes from locked UUID-backed condition state and exact
    pinned System capability definitions rather than application condition branches. The candidate
    coordinator now binds those facts with locked side relationships and an application-owned combat
    perception result before invoking the UUID-selected System graph. The public occurrence contract
    now exposes one closed controller-safe movement-reaction choice, supports reconnect, and strips
    private currentness, provenance, geometry, and other controllers' options. Declining a current
    choice now appends its exact command to the same occurrence, advances only the sealed movement
    remainder to the next spatial/reaction boundary, and replays before evaluator or Scene mutation.
    Selected-action settlement, successful-only resource consumption, fresh movement candidate
    integration, and PostgreSQL acceptance remain.
11. Turn lifecycle and every approved initiative mode. **ACCEPTED** — a System-owned reusable
    initiative policy now pins exact evaluation and tie graphs; Campaign settings may select UUID
    overrides, and new Encounters freeze the complete selected documents behind one checksum while
    exposing only a compact summary. Publication now locks referenced graph roots atomically; Campaign
    save/admission and catalogue removal enforce the policy/graph Content Source dependencies; snapshot
    admission recomputes every canonical document checksum. Normalized round/participant state now
    drives Encounter START and advancement; one Encounter-owned occurrence spans outgoing effects,
    EACH_ROUND initiative, incoming effects, sealed pauses, exact replay, and terminal receipt evidence.
    Focused execution and targeted persistence/concurrency review are clean; the required stable-schema
    PostgreSQL replay, rollback, authorization, contention, and cleanup proof remains.
12. Legendary resources/actions/resistance and recharge. **ACCEPTED** — authored Features and
    nested options may bind canonical UUID-backed reusable definitions; strict D&D lifecycle policy
    documents now own legendary-action eligibility, failed-save replacement choice, and turn-start
    recharge graph pins while Feature-owned charge identities retain maxima and costs. Publication
    rejects stale, cross-System, non-executable, or non-Boolean graph outputs. Focused contract,
    compiler, and publisher proof is green. Creature source normalization, Encounter occurrence
    execution, final review, and PostgreSQL authorization/replay/rollback/concurrency acceptance remain.
13. Optional-combat selection foundation plus Flanking and Alternating Diagonals execution.
    **ACCEPTED** — UUID-backed System reusable definitions flow through bounded Campaign selection
    into checksum-protected Encounter snapshots. Campaign settings and Encounter resolution expose only
    the two rules whose mechanics are integrated; the other twelve definitions remain unavailable
    foundation work rather than implied product support.
14. Exhaustive 2014 SRD path classification and seed/homebrew parity. **ACCEPTED** — the
    generated manifest classifies all 1,046 seeded roots and 11,018 leaves, retains 376 executable
    pins, rejects duplicate roots/leaves and unsupported executable pins, and matches the final local
    reset, 1,046-root seed, 83-manual-exception audit, and post-seed freshness verification.

Every Gate 2 scenario includes authorization, canonical locking, idempotency, replay, rollback,
privacy/redaction, and deterministic-concurrency subchecks where applicable.

## Gate 3 — Authoring and VTT workflows (10/10)

1. System-aware application shell and capability-driven navigation.
2. Guided and Advanced typed definition authoring.
3. Guided and Advanced domain-item authoring.
4. Override, source-editing, and new-content workflows.
5. Campaign System, catalogue, automation, and optional-rule settings.
6. Encounter Blueprint authoring and Encounter Run creation. **ACCEPTED** — Encounter Runs bind to
   the Session-presented Campaign Scene without taking Scene ownership; ending the Run leaves the
   Scene available for continued Campaign play.
7. Action discovery, selection, targeting, and outcome presentation.
8. Straight/waypoint movement, preview, and commit. **ACCEPTED** — movement commits against the
   persistent Campaign Scene and invokes Encounter mechanics only when an active binding is present.
9. Rolls, reactions, decisions, initiative, GM control, and reconnect. **ACCEPTED** — reconnect
   restores the Session-presented Scene independently from its optional Encounter overlay.
10. Evidence, conflicts, privacy, keyboard, screen-reader, and selector coverage. **ACCEPTED** — the
    GM Scene selector, Scene-without-Encounter route, role-filtered projections, and stable selectors
    pass focused tests and the final three-user local browser journey.

## Gate 4 — Scene and token presentation (8/8)

1. Token art, identity, and deterministic colour precedence. **ACCEPTED** — stable Scene token
   identity is separate from temporary Encounter actor bindings.
2. Conditions, effects, halos, ordering, and overflow. **ACCEPTED** — combat decoration is an
   optional overlay and disappears without deleting persistent Scene state.
3. Full footprints, large tokens, containment, dragging, and rotation. **ACCEPTED** — retained
   geometry resolves through normalized actor-token bindings.
4. Facing, arcs, marks, and positional cues.
5. Range, target, path, aura, and trap previews. **ACCEPTED** — previews consume the optional
   Encounter overlay without becoming permanent Scene state.
6. Light, darkness, obscurement, senses, and hidden-information rendering.
7. Injuries, morale, reactions, and other System-driven state presentation.
8. Low zoom, performance, responsiveness, and non-colour accessibility.

## Gate 5 — Complete local acceptance (10/10)

1. Final source identity, documentation, and release manifest. **ACCEPTED** — the fixed matrix and
   retained local release manifest identify the final working tree and every acceptance artifact.
2. Complete build, test, typecheck, format, and lint lifecycle. **ACCEPTED** — all workspace builds,
   package tests, affected typechecks, formatting, lint, and diff checks are green; unreliable
   parallel native runs were replaced with complete serial package evidence.
3. Migration, generated-type, canonical-SQL, seed, and audit parity. **ACCEPTED** — the final
   Campaign Scene foreign-key correction passed bootstrap regeneration, local reset/migrate,
   generated-type regeneration, seed, and audit from one coherent local database state.
4. Complete 2014 SRD manifest and seed/homebrew equivalence. **ACCEPTED** — the 1,046-root seed and
   complete path manifest regenerate and verify against the final local source state.
5. Three-user Automatic Encounter journey. **ACCEPTED** — the local host and browser journeys prove
   GM plus two-player authentication, delivery, commands, broadcasts, and exact replay.
6. Assisted/Manual decisions, physical/system rolls, reconnect, and GM control. **ACCEPTED** —
   focused mechanics suites plus the real reconnect journey prove the approved interaction paths.
7. Effects, spatial movement, reactions, concentration, and turn lifecycle. **ACCEPTED** — complete
   serial Functions/Schema/Shared suites and the local host journey cover the approved lifecycle.
8. Initiative and optional-combat representative combinations. **ACCEPTED** — representative
   combinations pass the complete mechanics suites and bounded local persistence schedules.
9. WebSocket, privacy, replay, rollback, concurrency, and performance. **ACCEPTED** — the local host
   and three-client browser journeys pass currentness, privacy, recovery, replay, and local latency
   budgets with isolated Worker persistence.
10. Exact database/media/event cleanup and final architect acceptance. **ACCEPTED** — disposable
    fixtures, Campaign Scene rows, media references, events, authority leases, and Worker state are
    cleaned or isolated exactly; no staging or production operation was performed.

## Phase 8.1 — Pre-launch combat completeness addendum (closed: 71 accepted, 2 superseded)

This is a separate, fixed addendum to the accepted 54/54 Phase 8 baseline. Its denominator was frozen
on 2026-08-30. Defects found while proving a case remain subchecks of that case; genuinely new product
scope requires another explicitly approved addendum and cannot silently increase this total. The
machine-readable case ledger is the `addenda` section of `08-vtt-acceptance.json`.

| Workstream                       | Accepted | Total | Current boundary                                                                                              |
| -------------------------------- | -------: | ----: | ------------------------------------------------------------------------------------------------------------- |
| Current Phase 8.1 packet         |        5 |     5 | **ACCEPTED** after focused proof and clean repeat review                                                      |
| Creature special mechanics       |       13 |    13 | **ACCEPTED**; combined reduced-target turn-effect integration remains in the fixed final PostgreSQL lifecycle |
| Creature UUID-backed equipment   |        5 |     5 | **ACCEPTED**; exact actor pins and audited GM replacement passed the final lifecycle                          |
| Speed Factor initiative          |        4 |     4 | **ACCEPTED**; declaration, ordering, ties, and declared-action enforcement passed                             |
| High-value optional combat rules |       10 |    10 | **ACCEPTED**; Disarm, Overrun, Shove Aside, Tumble, and Cleaving passed the final lifecycle                   |
| Final PostgreSQL lifecycle       |        6 |     6 | **ACCEPTED**; reset, seed, audit, replay, rollback, concurrency, privacy, cleanup, and browser gates passed   |
| Managed-host proof               |        0 |     2 | **SUPERSEDED** by Phase 8.2 `V15` and `R09`; not counted as passed                                            |
| Exhaustive race schedules        |       28 |    28 | **ACCEPTED**; fourteen fixed races passed in both lock orderings                                              |

The thirteen Creature cases are thirteen unique source semantics, not thirteen manifest rows. Nested
save branches expand some semantics into multiple manifest leaves:

1. Balor Whip forced movement with save.
2. Clay Golem Slam.
3. Cloaker Bite.
4. Dryad Shillelagh club damage.
5. Enlarged Duergar war pick damage.
6. Enlarged Duergar javelin damage.
7. Kraken Lightning Storm.
8. Purple Worm Tail Stinger.
9. Quasit Claws.
10. Quasit Scare.
11. Rug of Smothering Smother.
12. Shadow Strength Drain.
13. Spirit Naga Bite poison.

Creature equipment coverage includes mechanically relevant held or worn weapons, armour, shields,
foci, and action-referenced items. Natural weapons remain Creature actions. Shared equipment mechanics
must use the same modular equipment path as Characters; Creature-specific differences must use existing
typed Feature, effect, grant, modifier, and action primitives. No automated loot transfer is included.
The strict UUID-backed authored loadout contract, exact SRD source audit, and shared modular derivation
are **ACCEPTED**. Encounter actor pinning and audited GM replacement remain separate database cases.

The selected optional rules use these fixed product contracts:

- Disarm changes held state only, preserves ownership, and creates no Scene object.
- Overrun and Tumble surface from an authoritative movement path.
- Shove Aside requires a legal destination selection before the roll.
- Cleaving requires a human-selected eligible target; mixed damage allocation becomes GM-owned only
  when defense differences make the type split mechanically relevant, and riders never carry.

## Deferred product scope

### Deferred implementation gaps

- The thirteen 2014 SRD Creature semantics formerly deferred from Phase 8 are now the fixed Creature
  portion of Phase 8.1. All thirteen REVIEW-tier cases are accepted. The final PostgreSQL lifecycle
  must still exercise a pre-reduced Character and Creature receiving a recurring turn effect so the
  real transaction path proves the scalar-currentness composition without expanding the mock service
  harness.

- Automatic derivation of a Dryad's active Shillelagh state and a Duergar's active Enlarge state is
  deferred. In the MVP Creature stat-block flow, the GM selects the exact normal or enhanced authored
  action option; each option retains typed attack, damage, Equipment provenance, and critical
  mechanics. The runtime must not infer the selection from labels. This deferral does not add a Phase
  8.1 acceptance case or change the fixed denominator.

- Action-originated forced movement that intersects a configured spatial rule effect fails closed
  until a same-occurrence spatial continuation is implemented. Intermediate third-party token
  collision and exploration deltas are also deferred.

- Exact per-attack substitution inside a multiattack or Extra Attack action remains deferred. The
  Phase 8.1 Shove Aside path uses the current System-selected Action allowance and records that
  consumption; it does not invent an unpersisted attack-count economy or silently grant additional
  attacks. A later System action-plan contract must model individual attack opportunities before
  Shove Aside can replace only one attack within a larger action.

- Seven optional-combat definitions remain foundation-only after Phase 8.1: Facing, Climb Onto a
  Bigger Creature, Mark, Hitting Cover, Injuries, Massive Damage, and Morale, plus any definition not named
  in the fixed addendum. Flanking and Alternating Diagonals are already integrated; Disarm, Overrun,
  Shove Aside, Tumble, and Cleaving are Phase 8.1 work and must remain unavailable until accepted.

- D&D 2024 catalogue ingestion and a second product Game System.
- The exhaustive PostgreSQL race permutations are accepted historical evidence. The two unrun
  managed-Supabase latency cases are superseded by the approved Phase 8.2 Convex cutover and map to
  its `V15` performance simulation and `R09` staging promotion. They were not passed.
- User-created Systems, plugins, or arbitrary scripts.
- Campaign epic-level and spell-rank overrides.
- General targetable environment/object/material simulation.
- Adventure Module Package implementation and marketplace distribution.
- A production Rule Studio; only a local/internal inspector and fixture/trace tool remains.
