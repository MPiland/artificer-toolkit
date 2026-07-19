# Shared engine

`packages/shared/src/domains/engine` is the pure, deterministic D&D-5e-family character-resolution layer. It converts an ephemeral `CharacterBuildSnapshot` plus a caller-populated `CharacterAssemblyRegistry` and compatible `RulesSystem` policy into `EngineCharacterOutput`.

## Owns and does not own

- `kernel.ts` (`runEngine`) coordinates grant accumulation, modifier stacking, derived stats, spell state/slots, resources, and item contribution provenance.
- `contracts/` defines `RulesSystem`, engine input/output, and stacking contracts; `registry.ts` describes compiled records supplied by the caller; `snapshot.ts` defines the ephemeral input.
- `resolution/` contains pure grant, modifier, spell, resource, and derived-stat resolvers. `dnd5e2014/` supplies the first concrete rules system and ordering contract.
- Does not load from DB, call tRPC, persist snapshots, or own Builder/Sheet orchestration.

## Key flow

Character services load and compile authored content, populate a registry, assemble a snapshot from current character state, and call `runEngine(snapshot, registry, rules)`. The engine accumulates grants, applies system-specific stacking/order, computes derived output, and returns a DTO-ready result. Services then format it for the Sheet.

## Invariants

- Identical snapshot/registry/rules inputs produce identical output; keep resolution side-effect free.
- D&D-5e-family arithmetic, stacking, and ordering policy is injected through `RulesSystem`. A materially different game should use a system-specific engine adapter and contracts behind the registry seam rather than adding cross-system branches to this kernel.
- `CharacterBuildSnapshot` is ephemeral and distinct from persisted character authored/state records.
- Compiled records are supplied by the caller; the engine never reaches through repositories.

## Focused validation

Use `yarn workspace @artificer-toolkit/shared test` with the engine, modifier, grant, spell-slot, resource, and character snapshot tests. When changing order or stacking, update the relevant `dnd5e2014/RULE_ORDER.md` contract and focused tests together.

## Canonical references

- [Engine architecture](../../../../../docs/architecture/engine.md)
- [Character Builder and Sheet](../../../../../docs/architecture/character.md)
- [Data lifecycle](../../../../../docs/architecture/data-lifecycle.md)
