# Phase 9.6.1 - Node Map Runtime Resolver and Engine-Backed Form Runtime Correction

## Status: Complete

## Objective

Close the runtime gap discovered during the Spell review: shared node maps already describe more than static form layout. They also describe conditional visibility, requiredness, hidden behavior, data-backed option sources, filtering, chained relationships, conditional relationships, and relationship-derived option sets. Phase 9.6 proved the UI and transport shape, but it still hand-wired Spell reference data and evaluated only a small slice of node behavior in the web app where the node-map DSL should drive the resolved form model.

This correction must land before Background and later authored domains repeat the same pattern.

## Problem Statement

The current frontend form runtime can render node-map sections, inline options, and basic local `showIf` conditions, but it does not yet resolve the complete node-map runtime model.

That means:

- select and multiselect options can drift from shared node-map metadata
- each domain is tempted to create custom reference-data fetches
- filtering, chained relationships, and `mapValues`/`condition` plans are not reusable
- conditional visibility, requiredness, and hidden-value behavior can drift between web, future mobile, APIs, and backend validation
- future mobile clients would need to reimplement the same option logic
- complex stateful domain behavior risks being recreated in the UI instead of using backend services and engine-backed flows

Spell currently uses explicit reference-data wiring as a temporary bridge. That should not become the default domain pattern.

## Locked Decisions

- `packages/shared` remains the source of truth for node-map DSL metadata.
- `packages/functions` owns trusted execution of relationship plans against persistence/reference data.
- `apps/apis` exposes node-runtime resolution DTOs to clients.
- `apps/web` consumes resolved option DTOs through the Phase 9.4 API adapter.
- The frontend must not execute arbitrary table/relationship plans locally.
- The frontend must not send arbitrary relationship plans to be executed. It requests a trusted full-map or nested-scope runtime model by `mapId`, current local values, optional parent/ancestor context, and optional system scope.
- Stateful authored-domain updates, previews, validations, and engine-derived consequences should be service/API backed where the behavior is domain-significant. The UI can own local draft state, but it should not reimplement backend domain engines.

## Required Runtime Shape

Add a trusted node-map runtime resolver flow:

1. Client asks `apps/apis` for the resolved runtime model for a known node map:
   - `mapId`
   - local draft values
   - optional parent values
   - optional ancestor context
   - optional system/user scope
2. `apps/apis` maps the request to trusted shared node maps.
3. `packages/functions` resolves the node-map runtime state:
   - section ordering and node ordering
   - node visibility from `showIf`
   - required state from `requiredIf`
   - hidden behavior from `hiddenBehavior`
   - read-only or disabled state where source/provenance/domain rules require it
   - inline options
   - inline option groups with `showIf`
   - data table relationships
   - relationship `where` clauses
   - chained relationship plans
   - conditional relationship plans
   - `mapValues` and `seed` steps where supported
4. `apps/apis` returns a stable runtime DTO per section/node:
   - section metadata
   - node metadata
   - visibility
   - required state
   - hidden behavior
   - field options where the node is a select or multiselect
   - option metadata such as `value`, `label`, `description`, `disabled`, and `group`
   - optional UI-safe metadata needed by the renderer
5. `apps/web` renders from that resolved runtime model and feeds option DTOs into `AppSelect` and `AppMultiSelect` without hardcoding domain-specific reference loaders.

The frontend may still use the same shared pure-condition utilities for optimistic local interactivity between API round trips, but the resolved server/API model is the source of truth for cross-client consistency.

## Implementation Plan

1. Add schema DTOs for node-map runtime resolution requests and responses.
2. Add a `packages/functions` node-map runtime resolver service that executes trusted node-map metadata.
3. Resolve the relationship and condition shapes currently used by authored node maps:
   - inline options
   - inline option groups
   - inline `ALLOW` / `DENY` filters
   - `LOCAL`, `PARENT`, and `ANCESTOR` `showIf`
   - `requiredIf`
   - `hiddenBehavior`
   - direct table relationships
   - `WhereExpr` `=`, `!=`, `IN`, `and`, `or`, `not`, and `IdRef`
   - `TABLE`, `MAP_VALUES`, root/continue `CHAIN`, `UNION`, `CONDITION`, and `SEED`
4. Add tests using real shared node maps, especially:
   - Spell effect options
   - Background proficiency/equipment options
   - shared starting-equipment options
5. Expose REST endpoints in `apps/apis` for resolving node-map runtime state.
6. Add web adapter methods and query helpers for node-map runtime resolution.
7. Update the form runtime so rendered sections, visible nodes, required state, hidden behavior, and `DATA` source options come from the API-backed runtime model instead of being partially hand-resolved in the web app.
8. Reuse the runtime normalizer in rebuilt authored-domain save paths so hidden `CLEAR` behavior is enforced before persistence.
9. Replace Spell's temporary hand-wired reference-data usage during follow-up domain/form integration where the node-map DSL already provides the source.
10. Keep explicit reference-data loaders only where the UI genuinely needs page-level data outside node-map field options.

## Implementation Notes

- Added `POST /node-runtime/resolve` and `POST /node-runtime/normalize-values` contracts in `packages/schema`.
- Added a trusted node-map registry in `packages/functions`; clients provide `mapId` and values, never executable relationship plans.
- Added a node-runtime service that resolves sections, node visibility, required state, hidden `CLEAR` paths, inline/grouped options, filtered options, and current relationship-plan DSL output.
- Added allowlisted dynamic DB reads for relationship execution in `packages/db`; untrusted table/column inputs fail safely.
- Added REST handlers in `apps/apis` using schema-overload validation so malformed bodies return structured 422 responses instead of generic 500s.
- Added node-runtime methods and query helpers to the web API adapter.
- Updated the shared form runtime to accept an API-backed runtime model for visibility, required state, options, read-only/disabled state, and hidden clear paths.
- Updated local fallback condition logic to use the shared runtime condition evaluator so Storybook fixtures and optimistic local rendering no longer drift from backend semantics.
- Changed unresolved `DATA` sources in fallback rendering from silent empty options to an explicit disabled "Runtime options unavailable" option.
- Added Spell save-time normalization through `normalizeNodeRuntimeValues`; client clearing is UX, backend normalization is the persistence guard.

## Accepted Non-Blockers

- Spell still has explicit page-level/reference-data wiring from 9.6. That is documented as temporary until the integrated Spell follow-up replaces field-option fetches with the node-runtime model.
- Full `build:web` remains blocked by known legacy `apps/web/src/utils` alias/type failures unrelated to 9.6.1. No new 9.6.1 type failures were reported before the legacy failures stopped typecheck.

## Engine-Backed Stateful Updates

This correction also records the broader rule for later form and character work:

- local TanStack Form state owns unsaved draft values and ordinary field edits
- backend functions/services own domain-significant state transitions, previews, validations, and engine-derived consequences
- character builder and sheet flows must use engine-backed resolution/preview APIs rather than resurrecting old frontend hook graphs
- authored forms should use backend preview/normalization services where field changes affect derived structure or validity beyond simple UI visibility

## 9.7 Gate

Background should not start as another hand-wired reference-data implementation. Before 9.7 is accepted:

- `BACKGROUND_NODE_MAP` rendered sections and visible nodes resolve through the node-map runtime resolver
- `BACKGROUND_NODE_MAP` `DATA` sources resolve through the node-map runtime resolver
- starting equipment option behavior comes from shared relationship metadata where possible
- web tests prove the resolver returns expected options for owned/master content scope
- Storybook stories can use fixtures, but route/runtime code must use the API-backed resolver

## Test Plan

- Shared/functions unit tests for visibility, requiredness, hidden behavior, inline options, grouped options, table relationships, conditional relationships, and chained option resolution.
- API tests for validation errors, trusted map/node lookup, auth scope, and option DTO shape.
- Web adapter tests with MSW for runtime-resolution queries and error states.
- Form runtime tests proving hidden nodes do not render, required state is exposed, hidden behavior is respected, and `DATA` sources no longer silently render empty options.
- Spell regression tests proving existing form/effect editor option behavior still works after moving away from hand-wired references.

## Exit Criteria

- Node-map runtime state is executable through `packages/functions` and `apps/apis`.
- `apps/web` has one reusable runtime resolver path for form layout, field state, and field options.
- Background can begin without duplicating Spell's temporary reference-data pattern.
- Any remaining explicit reference loaders are documented as page-level data, not node field option resolution.

## Validation Notes

- `yarn build:schema` passes.
- `yarn build:shared` passes.
- `yarn build:db` passes.
- `yarn build:functions` passes.
- `yarn build:apis` passes.
- `yarn test:schema` passes.
- `yarn test:shared` passes.
- `yarn vitest run packages/functions/src/services/nodeRuntime/nodeRuntimeService.test.ts` passes.
- `yarn vitest run packages/functions/src/services/nodeRuntime/relationshipExecutor.test.ts` passes.
- `yarn vitest run packages/functions/src/services/nodeRuntime/nodeRuntimeService.test.ts packages/functions/src/services/nodeRuntime/relationshipExecutor.test.ts` passes.
- `yarn vitest run apps/apis/src/routes/nodeRuntime.test.ts` passes.
- `yarn vitest run packages/functions/src/services/nodeRuntime/nodeRuntimeService.test.ts packages/functions/src/services/nodeRuntime/relationshipExecutor.test.ts apps/apis/src/routes/nodeRuntime.test.ts` passes.
- `yarn workspace @artificer-toolkit/web test src/lib/api.test.ts` passes.
- `yarn workspace @artificer-toolkit/web test src/components/Form/runtime/FormRuntime.test.tsx` passes.
- `yarn workspace @artificer-toolkit/web test` passes.
- `yarn workspace @artificer-toolkit/web build-storybook` passes with the existing Storybook chunk-size warning.
- `yarn workspace @artificer-toolkit/web test:e2e:storybook` passes.
- `yarn build:web` still fails only on the documented legacy `src/utils` alias/type failures.
