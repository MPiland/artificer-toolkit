# Phase 1: Node Map Stabilization and DSL Standardization

## Objective

Stabilize the existing node-map system in the shared workspace and standardize every map implementation around the current `buildNodeMap().define(...)` DSL.

This phase is not a greenfield map project. The node-map foundation already exists and should be preserved. The work is to normalize the authored payloads, repair broken map definitions, align map outputs with compiler expectations, and define the validation rules that later resolver work will depend on.

## Why This Phase Exists

The shared workspace already contains a sophisticated node-map DSL in `packages/shared/src/utils/nodeDefinition.ts`. Current failures come from inconsistent usage of that DSL, stale map exports, authored-type mismatches, and drift between maps and compiler assumptions.

This phase exists to make node maps a stable domain primitive before deeper compiler and resolver work begins.

## Current Reality

### Existing assets to preserve

- `buildNodeMap().define(...)`
- `NodeBuilder`
- `ConditionIfBuilder`
- relationship/data builder helpers
- current domain map directories:
  - `effects/maps`
  - `grants/maps`
  - `shared/maps`
  - `subjects/maps`
  - `features/maps`

### Current failure modes from shared typecheck

- Broken exports in map barrels
- Maps written in shapes that do not match `NodeMap<T>`
- Incorrect DSL usage in several domain map files
- Implicit `any` parameters around map builder callbacks
- Authored types that no longer match map payload assumptions
- Missing or stale properties expected by compilers
- Broken import paths and stale module references

## Canonical Pattern

All node maps should follow one consistent authoring pattern.

```ts
const exampleNode = buildNodeMap<ExampleAuthored>()

export const EXAMPLE_NODE_MAP = exampleNode.define('example', ({ map, nodes, cond, data, logic }) => {
  map.set('name', nodes.text(['name'], 'Name'))
})
```

### Rules

- Use `buildNodeMap<T>().define(mapId, callback)` for every map
- Use `map.set(...)` or `map.merge(...)` only inside the callback
- Use node helpers from `nodes`, never ad hoc object literals
- Use `cond`, `logic`, and `data` from the DSL helpers instead of custom condition/query shapes
- Keep node IDs stable and semantic
- Every map file must export one canonical map constant and any explicitly intended helper maps

## Scope

### In scope

- Node-map payload normalization
- Node-map file rewrites where DSL usage is wrong
- Map barrel repair
- Import/export repair for map modules
- Validation rules for map structure and references
- Resolver contracts needed by later phases

### Out of scope

- Full runtime resolver execution
- Full compiler rebuild
- Frontend form rewrites
- API integration changes

## Target Domain Rollout Order

Implement the fixes in this order so the simplest shared primitives stabilize first.

1. `shared/maps`
2. `grants/maps`
3. `features/maps`
4. `subjects/maps`
5. `effects/maps`

This order lets common reusable structures settle before more complex subject and effect maps are rebuilt.

## Workstreams

### 1. DSL normalization

- Audit every map file for the canonical builder pattern
- Replace invalid static object map definitions
- Remove custom shapes that bypass the current helper API
- Add explicit callback typing where inference is currently failing

### 2. Payload alignment

- Verify each map's payload type matches the authored type it is meant to edit
- Remove stale properties from maps that no longer exist
- Add missing authored properties only if they are truly part of the domain model and required by later compiler phases
- Avoid temporary widening with `any`

### 3. Export and import repair

- Fix domain map barrel files
- Ensure each map module is reachable from `packages/shared/src/barrels/maps/index.ts`
- Replace stale direct `dist/...` references with package-local or import-map references
- Make the shared package export surface consistent for map consumers

### 4. Validation contract

Define the validation checks that map tooling or tests must eventually enforce.

- input path exists on payload type
- group path exists and points to object/array payloads
- node type matches payload field shape
- select nodes use a valid inline or data source
- condition paths point to legal fields
- id references point to legal ID-capable fields
- no unreachable or duplicate node IDs within a map
- no broken lazy child-map references

### 5. Resolver preparation

This phase should define the contracts required for resolver work later, even if full resolvers are not implemented yet.

- standard node traversal expectations
- child group traversal behavior
- conditional visibility semantics
- hidden behavior semantics
- data-backed select source contract
- stable map ID usage for lookup and diagnostics

## Known Current Blockers

These are the current blockers already visible from the shared workspace typecheck and should drive task ordering.

### Effects maps and compilers

- `effects/maps/index.ts` references missing map exports
- `effects/maps/moment.ts` uses an outdated builder signature
- effect and damage compilers reference stale authored/compiled shapes

### Features and grants maps

- `features/maps/feature.ts` uses the wrong callback shape
- `features/maps/option.ts` defines properties that do not match `NodeMap<T>`
- `grants/maps/proficiency.ts` uses outdated DSL expectations
- `grants/maps/spell.ts` includes stale node properties

### Shared map/compiler alignment

- `shared/core/speed.ts` and related types no longer match map expectations
- charge and starting-equipment compilers drift from authored payloads
- several map consumers expect properties that no longer exist

### Subject compiler dependencies

- subject compilers reference missing compiler exports and stale authored properties
- map payloads and compiled subject shapes need to be brought back into alignment

## Deliverables

- Canonical node-map authoring rules documented and enforced in code changes
- Correctly shaped node maps for the target domains
- Repaired map barrel exports
- Type-safe payload alignment between authored types and map definitions
- Resolver contract notes for later implementation
- Shared workspace map typecheck failures reduced to issues outside the map layer

## Success Criteria

### Functional

- All targeted map files use the DSL consistently
- Map barrels resolve correctly
- No map file depends on ad hoc map object shapes
- No map builder callback relies on implicit `any`

### Type safety

- Node paths line up with authored payloads
- Group nodes point to valid object or array payloads
- Select nodes use valid source definitions
- Shared typecheck no longer reports map-structure errors for the completed domains

### Architectural

- Node maps are clearly separated from compilers and resolvers
- Later phases can consume maps through stable exports
- The project has one node-map system, not competing patterns

## Implementation Sequence

1. Audit and normalize `shared/maps`
2. Repair map barrels and imports
3. Fix `grants/maps`
4. Fix `features/maps`
5. Fix `subjects/maps`
6. Fix `effects/maps`
7. Define validation helper/test targets
8. Hand off cleanly to the compiler phase

## Notes For Implementation

- Prefer fixing the domain model if a map is correct but the authored type has drifted incorrectly
- Prefer fixing the map if it is bypassing the established DSL
- Do not widen types just to quiet the compiler
- Do not create a separate "temporary map format"
- Keep this phase focused on map correctness and contracts, not full runtime resolution
