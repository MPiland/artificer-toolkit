# ADR 0004: Authoring Schemas are backend-resolved structure

- **Status:** decision
- **Date:** 2026-07-10
- **Scope:** Authoring Schema contract, node-map DSL, resolvers, and client presentation adapters
- **Update when:** node kinds, condition/visibility semantics, map registry, resolution DTOs, or form rendering ownership changes
- **Verification:** `packages/shared/src/utils/nodeDefinition.ts`; `packages/shared/src/utils/nodeRuntime.ts`; `packages/shared/src/domains/**/maps`; `packages/authoring/src/nodeRuntime`; `apps/apis/convex/authoring/nodeRuntime.ts`; node-runtime and node-map inventory tests

## Context

Authored subjects contain nested objects and arrays whose visible fields, required state, choices, and child groups depend on values in local, parent, or ancestor scope. The frontend needs a stable structure to render, but it should not independently interpret the DSL or duplicate backend rule semantics.

## Decision

The **Authoring Schema** is the typed, serializable contract for authoring structure. `NodeMap` is its current shared DSL implementation. It describes `INPUT` and `GROUP` nodes, paths, IDs, conditions, visibility, required behavior, hidden-field clearing, nested scope relationships, and explicit semantic presentation intent. Maps are registered by subject/domain in `packages/shared`.

Group presentation is deterministic rather than inferred. Object groups declare `inline` or `branch`. Array groups declare `inline`, `table`, `summary`, `branch`, or `focused`. `branch` represents navigable hierarchy; `summary` is a staged terminal list; `focused` also exposes collection rows through navigation. Descendants render inside the same focused editor, and the frontend never stacks drawers.

Maps may add narrow `authoring` metadata for semantic display intent: system-owned field exposure; closed collection actions; derived/manual ordering; group and collection labels; AND/OR joins; row layout/expansion; stable row-summary kind; and responsive action, heading, and surface recipes. This metadata is resolved with the normal contract. It is not a CSS schema: each client maps the shared design-system vocabulary to concrete components, tokens, iconography, responsive contexts, and overlay geometry.

The backend resolves a map against current values and returns one root model plus flat, absolute-path scopes for every visible populated nested object or array row. Resolution evaluates local/parent/ancestor references and conditions and applies the map's hidden behavior once. Web rendering, navigation, progress, and validation targeting consume those same scopes; production clients do not reimplement map evaluation or infer persistence layout.

Resolvers and orchestrators have separate jobs:

- a **resolver** is a pure/domain operation that turns a map plus values/context into resolved structure or compiled meaning;
- an **orchestrator** coordinates loading, validation, persistence, and cross-package calls for a user operation.

Node maps are for reusable authored-content structure. They are not a general-purpose character progression or sheet-state workflow language.

## Consequences

Adding a group requires an explicit presentation assignment in addition to updating the typed definition/registry, backend resolution behavior when needed, the shared/API contract, and focused tests. Inventory tests enforce the presentation set and staged-leaf boundary. Frontend domain adapters provide defaults and factories but must not add duplicate resolved-field wrappers, local draft stores, nested form engines, or production static-map evaluation.

Frontend renderer behavior must consume resolved authoring semantics instead of testing map IDs. A client-local presentation adapter may map semantic schema values to its CSS and components, but schema definitions never import client styles. Explicit map-to-default routing is allowed in a dedicated default registry because default values are domain factories rather than renderer presentation; it must stay separate from shared rendering orchestration.
