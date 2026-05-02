# Phase 9.5 - Shared Form Runtime

## Status: Complete

## Objective

Build the shared authored-form runtime used by all non-character authored domains. This tranche replaces the old global Zustand step-store model for new work with TanStack Form composition, section-aware node maps, Mantine-backed field primitives, and a reusable renderer that can drive domain forms from shared metadata.

Full domain form pages begin in 9.6. The legacy store and old provisional domain forms remain only to keep unrebuilt routes alive until each domain cutover.

## Inputs

- [PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md](PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md)
- TanStack Form composition, array, and SSR/TanStack Start guidance
- `apps/web/src/hooks/useFormField.tsx`
- `apps/web/src/components/Form/*`
- `apps/web/src/store/formStore.ts`
- `apps/web/src/hooks/useDomainForm.ts`
- `packages/shared/src/utils/nodeDefinition.ts`
- `packages/shared/src/domains/subjects/maps/*`

## Locked Decisions

- Use TanStack Form as the authored form engine for new Phase 9 forms.
- Keep the `form.AppField` ergonomics through TanStack `createFormHook`.
- Do not create a new global form draft store.
- TanStack Form owns draft values, dirty/touched/error/submission state per form instance.
- A small UI state helper owns only active section, nested editor state, and read-only mode.
- Add section descriptors to shared node-map metadata.
- Use proper Mantine controls for text, textarea, number, select, multiselect, tags, buttons, and accessible form behavior.
- Use the existing rich text editor as the registered rich-text field, with required Tiptap extension dependencies installed.
- Support locked-master read-only forms with copy-to-edit entry points.
- Preserve the Phase 9.4 `apps/apis` transport boundary for saves; do not make TanStack Start server actions the primary submit path in 9.5.

## Shared Metadata Change

`NodeMetaBase`, `NodeMetaSpec`, and `GroupMetaSpec` now accept:

- `section.id`
- `section.label`
- `section.order`

Top-level authored maps now assign user-visible nodes and groups to stable sections for:

- spell
- background
- feat
- race
- equipment
- creature
- vehicle
- class

Section helper utilities now resolve grouped sections and nested inherited sections from shared node maps.

## Runtime Shape

The frontend form platform now lives under `apps/web/src/forms`. The old `components/Form` tree remains only as a compatibility surface for legacy callers while routes migrate.

The form platform includes:

- `useAppForm` from TanStack `createFormHook`
- pre-bound Mantine/Tiptap field components
- app-level `AppSelect` and `AppMultiSelect` wrappers around Mantine select controls for new runtime fields
- `ModalEditorFrame`
- `ResolvedNodeFields`
- `SectionNavigator`
- `NestedObjectShell`
- `NestedCollectionShell`
- `useResolvedNodeModel`
- `useAuthoredFormUiState`
- node visibility handling for basic local `showIf` conditions

The runtime intentionally does not yet build full Spell/Background/etc. form pages. Domain-specific layout, relationship picker transport, and submit behavior begin in 9.6 and reuse this runtime.

## SSR / TanStack Start Rule

For rebuilt domain form pages:

- route loaders fetch initial authored detail payloads
- initial values flow into TanStack Form `defaultValues`
- drafts are not persisted globally through Zustand
- saves go through the Phase 9.4 REST adapter
- server validation state can later follow TanStack's `formOptions` / `mergeForm` SSR pattern if needed
- `@tanstack/react-form-start` server-action submission remains a future option, not the 9.5 baseline

## Legacy Handling

The following remain temporary and should not be used by new 9.5+ runtime code:

- `apps/web/src/store/formStore.ts`
- `apps/web/src/hooks/useTypedFormStore`
- `apps/web/src/hooks/useDomainForm.ts`
- `apps/web/src/hooks/useFormField.tsx`
- old domain form components that depend on step metadata or web-local draft stores
- `apps/web/src/components/Dropdown`, which remains a legacy compatibility surface until old forms are retired

Do not delete these until the relevant domain route has been rebuilt and imports are clean.

## Stories

Storybook coverage now exists for:

- text, textarea, number, single select, multiselect, tags, and rich text field primitives
- standalone `AppSelect` and `AppMultiSelect` states, including grouped options, disabled fields, and the opt-in All shortcut
- sectioned node-map rendering
- locked-master read-only rendering with copy affordance
- nested collection editing
- nested object editing

## Tests

Shared package tests cover:

- section metadata accepted by node builder helpers
- nested section inheritance
- stable sections for every authored subject node map

Web tests cover:

- TanStack Form field value updates
- SSR-style initial values
- section navigation without draft mutation
- read-only locked mode
- nested array add/remove through TanStack array APIs
- locked-master copy wiring

Storybook Playwright covers:

- field primitive input behavior
- section switching
- locked/read-only behavior
- nested collection add behavior

## Validation Notes

Passed:

- `yarn build:shared`
- `yarn test:shared`
- `yarn workspace @artificer-toolkit/web test`
- `yarn workspace @artificer-toolkit/web build-storybook`
- `yarn workspace @artificer-toolkit/web test:e2e:storybook`

Accepted non-blocker:

- `yarn build:web` still fails on known legacy `src/utils` alias/type failures that predate 9.5 and are already tracked as retirement targets. No new 9.5 runtime failure was exposed by the focused web tests or Storybook build.

Known follow-up:

- Storybook emits chunk-size warnings, especially for the rich text runtime story. This is acceptable for 9.5 Storybook coverage, but domain routes should avoid eagerly loading rich text where it is not needed.
- Manual Storybook review accepted the runtime as directionally good enough. Token and radius tightening is deferred to integrated domain form polish during 9.6, when the runtime is visible inside the real Spell form.
- Follow-up correction: the 9.5 runtime resolves sections, inline options, and basic local visibility, but it does not yet execute the complete node-map runtime model: `source.kind === 'DATA'`, relationship filters, requiredness, hidden behavior, and cross-client resolved node state. [PHASE_9_6_1_NODE_MAP_RESOLVER_SUBPLAN.md](PHASE_9_6_1_NODE_MAP_RESOLVER_SUBPLAN.md) is required before later domains repeat hand-wired reference-data loaders or web-local node-condition logic.

## Review Gate

- Node maps emit stable sections for every authored subject map.
- Shared field primitives and nested editors are story-driven.
- Unit tests cover runtime updates, section resolution, and nested editing paths.
- Locked-master forms render read-only and expose copy-to-edit wiring.
- Manual Storybook review is accepted; 9.6 can begin.

## Exit Criteria

- The authored-domain runtime is ready before the first domain rebuild starts.
- Later domain subplans can focus on domain-specific UX and transport rather than inventing new form state or field primitives.
