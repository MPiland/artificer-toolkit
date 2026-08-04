# Forms platform

`apps/web/src/forms` is the canonical frontend presentation adapter for backend-resolved Authoring Schemas. `NodeMap` is the shared DSL implementation; the web consumes its resolved transport contract and connects it to TanStack Form and the Authoring Workspace.

## Owns and does not own

- `app-form` defines the shared `useAppForm`/`withForm` hooks and field components.
- `authoring-schema` selects absolute nested scopes from the backend-resolved contract and identifies simple leaf field groups.
- `node-map` contains story/test resolution and form-friendly path/clearing utilities; production navigation and progress must not evaluate maps from this folder.
- `rendering/FormRenderer.tsx` orchestrates the active scope, renderer contexts, navigation target, and validation state.
- A domain may supply alternate canvas content, but `FormRenderer` must remain mounted as the sole owner of resolution, navigation, progress, and finalization state.
- `rendering/ResolvedInputControl.tsx` and the focused object/array/overview/leaf modules bind resolved nodes to real TanStack fields. Simple inline leaf objects use `withFieldGroup`; all modules share the one root form.
- `rendering/collectionPresentation.ts` translates resolved collection semantics into web-local labels, summaries, and icons; `collectionStyleMap.ts` maps semantic row-layout intent to vanilla-extract classes. Neither may branch on child-map IDs.
- `rendering/authoringNodeDefaultRegistry.ts` owns the map-ID to explicit default-factory routing. It is separate from rendering because default values are domain data, not presentation.
- `layout` owns Authoring Workspace navigation, steps, sections, responsive rails, the staged leaf drawer, action bar, progress, and reset behavior.
- Domain containers own API loading/saving and adapters/default values. This platform does not own API procedures, DB data, or character Builder business rules.

## Key flow

Domain form creates the top-level TanStack form → API Authoring Schema DTO supplies a root model plus absolute nested scopes → `FormRenderer` selects the active scope and delegates focused rendering modules → visibility/required/clear paths update form state → `AuthoringLayout` presents navigation, validation, previews, and actions from the same resolved scopes.

Character Builder is intentionally distinct from this Authoring Schema platform, even when it reuses `useAppForm`, field primitives, or layout patterns.

## Invariants

- Only top-level domain forms and isolated harnesses call `useAppForm`.
- Keep array/object groups connected to TanStack Form; do not introduce local Zustand drafts or nested local forms.
- Guided presentations write to the same root form values and must bridge unsupported data to the resolved Advanced renderer without reshaping it.
- Render resolved nodes directly; do not add duplicate resolved-field wrappers, generic group shells, domain-local modal/resolver stacks, or production static-map evaluation.
- Treat Authoring Schema `authoring` metadata as content intent only. It may declare system-owned fields, labels, joins, add/remove capability, row expansion/layout, action presentation, and row-summary semantics. CSS classes, icons, responsive geometry, and concrete overlay behavior remain web-owned.
- `ui/primitives` and `ui/overlays` remain the homes for primitive controls and overlay infrastructure.

## Focused validation

Use `yarn workspace @artificer-toolkit/web test:forms` and `test:authoring`, then `yarn turbo:typecheck:web` for shared type changes. For layout changes, run `yarn workspace @artificer-toolkit/web test:e2e:authoring-storybook`; use `yarn dev` and the authenticated app for final route-backed inspection when persistence or permissions are involved.

## Canonical references

- [Authoring Schema](../../../../docs/architecture/authoring-schema.md)
- [Character Builder and Sheet](../../../../docs/architecture/character.md)
- [Transport and tRPC](../../../../docs/architecture/transport.md)
- [Product intent](../../../../PRODUCT.md) and [design system](../../../../DESIGN.md)
