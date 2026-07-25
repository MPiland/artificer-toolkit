# ADR 0005: Pure, policy-injected D&D 5e-family character engine

- **Status:** decision
- **Date:** 2026-07-24
- **Scope:** character assembly, engine resolution, and rules-system contracts
- **Update when:** engine inputs/outputs, resolution ordering, side effects, or rules-system responsibilities change
- **Verification:** `packages/shared/src/domains/engine/contracts/rulesSystem.ts`; `packages/shared/src/domains/engine/kernel.ts`; `packages/shared/src/domains/engine/rulesRegistry.ts`; `packages/shared/src/domains/engine/registry.ts`; engine tests and `dnd5e2014/RULE_ORDER.md`

## Context

The character creator needs a predictable preview and the Sheet needs repeatable derived values. The current snapshot, registry, and output contracts model D&D-5e-family concepts. Policy within that family still varies, so arithmetic, stacking, and ordering should not be scattered through application or UI code.

## Decision

`runEngine(snapshot, registry, rules)` is pure and deterministic. It performs no persistence calls and no UI or event side effects. Identical `CharacterBuildSnapshot`, `CharacterAssemblyRegistry`, and `RulesSystem` inputs produce identical `EngineCharacterOutput`.

`RulesSystem` supplies D&D-5e-family policy: proficiency and ability calculations, modifier stacking, grant application order, and feature source order. Application orchestration resolves an explicit ruleset code/version through a fail-closed registry. `dnd5e2014RulesSystem` is one implementation; the kernel and resolution modules inject these policies while retaining their explicit 5e-shaped class, armor, spell-slot, resource, and rest contracts.

The ruleset registry is the future extension seam. A compatible 5e-family ruleset may reuse this kernel. A materially different game system should provide its own snapshot/output contracts and engine adapter rather than forcing unrelated mechanics into this interface.

The engine consumes an assembled snapshot/registry rather than authored or database rows directly. Application orchestration is responsible for loading and compiling content, assembling those inputs, selecting a rules system, and persisting any resulting character state. The engine returns derived sheet data; it does not mutate the persisted Builder or Sheet state.

Phase 00 adds a closed mechanical-adjustment input to snapshot assembly. Adjustment labels, source categories, notes, permissions, actors, timestamps, and panel semantics remain application/Sheet metadata and do not enter the engine. Rules-system policy owns adjustment ordering: authored/equipment/feature contributions first, additive manual contributions through normal stacking, and an absolute target override last. Adjusted upstream values feed downstream calculations unless a downstream target has its own absolute override.

The same pure calculation returns both the effective value and its source-aware breakdown, including suppressed contributions retained for inspection. Effective totals and breakdowns are outputs and are never persisted as a parallel truth. Repeated spell sources, owned item instances, and companion instances retain independent calculation identities. Dice-based recovery accepts an injected random source so production can use a CSPRNG and tests can remain deterministic.

## Consequences

Engine tests can use small in-memory snapshots and alternate compatible rules policies. Ordering contracts are explicit and must be tested when grant/provenance or adjustment behavior changes. Clearing an adjustment changes engine input rather than restoring a cached prior total. A feature that requires I/O, user authorization, labels/notes, event persistence, or panel presentation belongs in an orchestrator/service around the engine, not in `runEngine`. A future non-5e engine should preserve this purity boundary without being required to reuse the current D&D-shaped contracts.
