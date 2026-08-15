# ADR 0005: Pure, policy-injected D&D 5e-family character engine

- **Status:** historical; superseded by [ADR 0019](0019-versioned-cross-domain-rules-runtime.md)
- **Date:** 2026-07-24
- **Scope:** character assembly, engine resolution, and rules-system contracts
- **Update when:** engine inputs/outputs, resolution ordering, side effects, or rules-system responsibilities change
- **Verification:** repository history for the removed implementation; current replacement in [ADR 0019](0019-versioned-cross-domain-rules-runtime.md) and the [D&D 5e 2014 rule-order contract](../../packages/functions/src/services/rules/systems/dnd5e/2014/RULE_ORDER.md)

## Context

The character creator needs a predictable preview and the Sheet needs repeatable derived values. The current snapshot, registry, and output contracts model D&D-5e-family concepts. Policy within that family still varies, so arithmetic, stacking, and ordering should not be scattered through application or UI code.

## Decision

`runEngine(snapshot, registry, rules)` was defined as a pure deterministic boundary with no persistence, UI, or event side effects. Identical `CharacterBuildSnapshot`, `CharacterAssemblyRegistry`, and `RulesSystem` inputs produced identical `EngineCharacterOutput`.

`RulesSystem` supplied D&D-5e-family policy: proficiency and ability calculations, modifier stacking, grant application order, and feature source order. Application orchestration resolved an explicit ruleset code/version through a fail-closed registry. `dnd5e2014RulesSystem` was its D&D 5e 2014 implementation.

During migration this implementation served as the parity oracle, not the production mechanical authority. After the required parity and lifecycle gates, `RulesSystem`, `runEngine`, and the duplicated mechanical resolvers were deleted. The versioned embedded Zen evaluator in [ADR 0019](0019-versioned-cross-domain-rules-runtime.md) is the sole current mechanical authority.

The engine consumes an assembled snapshot/registry rather than authored or database rows directly. Application orchestration is responsible for loading and compiling content, assembling those inputs, selecting a rules system, and persisting any resulting character state. The engine returns derived sheet data; it does not mutate the persisted Builder or Sheet state.

Phase 00 adds a closed mechanical-adjustment input to snapshot assembly. Adjustment labels, source categories, notes, permissions, actors, timestamps, and panel semantics remain application/Sheet metadata and do not enter the engine. Rules-system policy owns adjustment ordering: authored/equipment/feature contributions first, additive manual contributions through normal stacking, and an absolute target override last. Adjusted upstream values feed downstream calculations unless a downstream target has its own absolute override.

The same pure calculation returns both the effective value and its source-aware breakdown, including suppressed contributions retained for inspection. Effective totals and breakdowns are outputs and are never persisted as a parallel truth. Repeated spell sources, owned item instances, and companion instances retain independent calculation identities. Its injected random source is transitional parity infrastructure; the target evaluator accepts application-owned dice evidence as facts.

## Consequences

This ADR remains as the historical rationale for deterministic fact/result boundaries. Current ordering tests and fixtures live with the versioned Zen policies. A feature that requires I/O, user authorization, labels/notes, event persistence, or panel presentation belongs in an orchestrator/service around the evaluator; game-system mechanics belong in the pinned rule model.
