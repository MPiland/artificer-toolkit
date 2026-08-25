# Phase 08 fixed acceptance ledger

> **Status:** active rebaseline
>
> **Scope:** fixed product acceptance scenarios for the rules runtime, Encounter automation, VTT workflows, presentation, and complete local release proof
>
> **Machine-readable ledger:** [08-vtt-acceptance.json](08-vtt-acceptance.json)
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

## Gate 1 — Rules foundation (1/12)

1. Game System capability isolation.
2. Rules Catalogue and Content Source binding.
3. UUID identity and same-System reference integrity.
4. Bounded typed graph validation and rejection. **ACCEPTED** — `321af79`; 13 focused tests,
   affected build/lint/format green, independent review clean.
5. Draft, Publish, and current-active lifecycle.
6. Runtime capability discovery.
7. Runtime execution, continuation, and receipt lifecycle. **IN PROGRESS** — `9c4bc299`
   implements sealed server-only pause/resume with sequential evidence and no prior-node reexecution;
   17 focused tests, affected builds/lint/format, and independent review are green. Aggregate-owned
   persistence, authorization, receipt replay, rollback, cleanup, and concurrent settlement remain.
8. Live source updates with frozen occurrences.
9. Override, Edit Source, and Create New separation.
10. Campaign and Character compatibility enforcement.
11. Reusable Encounter Blueprint and independent Encounter Run persistence.
12. Neutral portability tracers plus canonical documentation and ERDs.

## Gate 2 — Authoritative mechanics (0/14)

1. Automatic, Assisted, Manual, and sanitized reminder behavior.
2. Random evidence, d20 contributors, cancellation, and other supported tests.
3. Action authorization, selections, targets, and cross-owner outcomes.
4. Attacks, criticals, saving throws, and checks.
5. Damage, healing, temporary hit points, conditions, and resources.
6. Grants, modifiers, aggregate state, and rules-based reconciliation.
7. Active/passive effects, recurrence, duration, and expiry.
8. Concentration start, replacement, checks, cleanup, and privacy.
9. Movement, spatial geometry, perception, auras, and traps.
10. Reactions, durable choices, interruption, reconnect, and resource use.
11. Turn lifecycle and every approved initiative mode.
12. Legendary resources/actions/resistance and recharge.
13. Every approved 2014 DMG optional combat rule.
14. Exhaustive 2014 SRD path classification and seed/homebrew parity.

Every Gate 2 scenario includes authorization, canonical locking, idempotency, replay, rollback,
privacy/redaction, and deterministic-concurrency subchecks where applicable.

## Gate 3 — Authoring and VTT workflows (0/10)

1. System-aware application shell and capability-driven navigation.
2. Guided and Advanced typed definition authoring.
3. Guided and Advanced domain-item authoring.
4. Override, source-editing, and new-content workflows.
5. Campaign System, catalogue, automation, and optional-rule settings.
6. Encounter Blueprint authoring and Encounter Run creation.
7. Action discovery, selection, targeting, and outcome presentation.
8. Straight/waypoint movement, preview, and commit.
9. Rolls, reactions, decisions, initiative, GM control, and reconnect.
10. Evidence, conflicts, privacy, keyboard, screen-reader, and selector coverage.

## Gate 4 — Scene and token presentation (0/8)

1. Token art, identity, and deterministic colour precedence.
2. Conditions, effects, halos, ordering, and overflow.
3. Full footprints, large tokens, containment, dragging, and rotation.
4. Facing, arcs, marks, and positional cues.
5. Range, target, path, aura, and trap previews.
6. Light, darkness, obscurement, senses, and hidden-information rendering.
7. Injuries, morale, reactions, and other System-driven state presentation.
8. Low zoom, performance, responsiveness, and non-colour accessibility.

## Gate 5 — Complete local acceptance (0/10)

1. Final source identity, documentation, and release manifest.
2. Complete build, test, typecheck, format, and lint lifecycle.
3. Migration, generated-type, canonical-SQL, seed, and audit parity.
4. Complete 2014 SRD manifest and seed/homebrew equivalence.
5. Three-user Automatic Encounter journey.
6. Assisted/Manual decisions, physical/system rolls, reconnect, and GM control.
7. Effects, spatial movement, reactions, concentration, and turn lifecycle.
8. Initiative and optional-combat representative combinations.
9. WebSocket, privacy, replay, rollback, concurrency, and performance.
10. Exact database/media/event cleanup and final architect acceptance.

## Deferred product scope

- D&D 2024 catalogue ingestion and a second product Game System.
- User-created Systems, plugins, or arbitrary scripts.
- Campaign epic-level and spell-rank overrides.
- General targetable environment/object/material simulation.
- Adventure Module Package implementation and marketplace distribution.
- A production Rule Studio; only a local/internal inspector and fixture/trace tool remains.
