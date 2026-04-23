# Phase 9.5 - Shared Form Runtime

## Status: Not Started

## Objective

Build the shared authored-form runtime used by all non-character domains. This tranche keeps the `AppField` pattern but replaces the old global step-store architecture with section-aware node maps, typed per-domain stores, and a reusable renderer that can drive every authored domain from shared metadata.

## Inputs

- [PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md](PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md)
- `apps/web/src/hooks/useFormField.tsx`
- `apps/web/src/components/Form/*`
- `apps/web/src/store/formStore.ts`
- `apps/web/src/hooks/useDomainForm.ts`
- `packages/shared/src/utils/nodeDefinition.ts`
- `packages/shared/src/domains/subjects/maps/*`

## Locked Decisions

- Keep the `AppField` pattern for type-safe binding.
- Replace the old global union store and step model with a typed store factory per domain and surface.
- Put section descriptors in shared node-map metadata.
- Use proper textarea controls for longform fields.
- Support locked-master read-only forms with copy-to-edit entry points.

## Required Shared Metadata Change

Extend `NodeMetaSpec` so renderable fields and groups can declare their form section. Use this shape for the shared runtime:

- `section.id`
- `section.label`
- `section.order`

Child nodes inherit the nearest parent section unless they explicitly override it. Top-level authored maps should assign every user-visible field or group to a stable section.

## Scope

- Typed store factory for authored forms
- Shared node-map renderer
- Section navigation model
- Field primitive catalog
- Nested array and object editing model
- Read-only locked-master mode

## Store Model

Each authored form store should manage:

- `initial`
- `draft`
- `dirtyPaths`
- `validation`
- `activeSectionId`
- nested collection UI state
- modal or drawer UI state
- read-only mode and copy-to-edit affordances

No store state may hard-code character-only editing indices or old stepper assumptions.

## Required Field Catalog

- text input
- textarea
- rich text
- number input
- single select
- multi select
- inline chips or tags where the design calls for them
- nested object editors
- nested collection editors
- relationship pickers backed by transport data

## Deliverables

- Shared section-aware authored-form renderer.
- Typed store factory reusable across spells, backgrounds, feats, races, equipment, creatures, vehicles, classes, features, and feat grants.
- Rebuilt field primitive layer under `AppField`.
- Storybook stories for:
  - text
  - textarea
  - single select
  - multi select
  - rich text
  - nested arrays
  - section navigator
  - locked-master read-only form with copy action

## Implementation Plan

1. Extend shared node metadata with section descriptors.
2. Update subject node maps so their top-level authored surfaces emit stable section groupings.
3. Build the new typed store factory and retire the old step-based global form store.
4. Rebuild the field catalog under `AppField`, including proper textarea support.
5. Build section navigation and nested editor composition around the node maps.
6. Add locked-master read-only form mode and copy affordances.
7. Add Storybook, Vitest, and Playwright coverage for the shared runtime.

## Review Gate

- Node maps can emit stable sections for every authored domain.
- Shared field primitives and nested editors are story-driven and browser-reviewed before domain rollout.
- Unit tests cover store updates, section resolution, and nested editing paths.
- A locked-master record can render read-only and transition into a copy flow.

## Exit Criteria

- The authored-domain runtime is ready before the first domain rebuild starts.
- Later domain subplans can focus on domain-specific UX rather than inventing new store or form primitives.
