# Phase 9.6 - Code: Spell

## Status: Complete

## Objective

Rebuild the spell surfaces as the first authored-domain implementation on the new shell, transport, and shared form runtime. Spell is the proving ground for the canonical list pattern, the shared authored-form runtime, and the effect-editor behaviors that later domains reuse.

Implementation must use `apps/apis` as the only frontend product-data boundary. REST remains the active 9.6 transport through the shared web adapter; tRPC remains behind the adapter for a later parity-driven migration.

## Prerequisite

- [PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md](PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md)
- [PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md](PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md)
- [PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md](PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md)
- [PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md](PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md)
- [PHASE_8_3_FIGMA_SPELL_SUBPLAN.md](PHASE_8_3_FIGMA_SPELL_SUBPLAN.md)
- [PHASE_8_1_FIGMA_EFFECT_EDITOR_FLOW.md](PHASE_8_1_FIGMA_EFFECT_EDITOR_FLOW.md)

## Surface Set

- spell list route
- spell create route
- spell view or edit route
- locked-master copy flow
- effect editor surface within spell authoring

## Current Source Truth

- Figma source: `Spells` page frames `Spells List`, `IF1 - Spell Basics`, and `IF2 - Effects`.
- Shared effect source: `PHASE_8_1_FIGMA_EFFECT_EDITOR_FLOW.md` and the Figma `Capabilities` page.
- Current model source: `SpellAuthored.effects`, `EffectAuthored.paths`, and `OutcomeAuthored`.
- Stale wording such as `capabilities` or `branches` in older docs maps to current `effects` and `paths` and must not be reintroduced in code.
- The effect editor is a reusable app-level component, not a spell-specific component. It should accept a source/content label from the host domain instead of hardcoding Spell copy.
- The effect editor opens as a full-screen modal/drill-in surface, similar to opening a backlog item in Azure DevOps. It does not use the older inline-only or left-rail editor direction.
- Read-only effect summaries are view/open-only: they use the `ExternalLink` affordance and must not render destructive trash/remove actions.

## Section Map

Derive sections from `SPELL_NODE_MAP` and the locked Figma screens:

1. Spell Info
   - single IF screen, no left section navigator
   - visible section blocks for Basics, Details, and Components & Attributes
2. Basics
   - `Name`
   - level
   - classes
3. Details
   - magic school
   - casting time
   - description
4. Components & Attributes
   - attributes
   - components
   - conditional material description
5. Effects
   - effects summary list
   - effect add/edit/remove
   - full effect editor

## Transport and Data Requirements

- `GET /content/spells`
- `GET /content/spells/:id`
- `POST /content/spells`
- explicit `provenance` and `permissions` on list and detail responses
- reference data for:
  - magic schools
  - classes
  - damage types
  - condition types
  - skills
  - creatures where manifest outcomes need a linked creature option
  - spell attributes
  - components
  - effect-editor reference inputs from system data

## Implementation Tracks

1. Finish the spell list wiring on the shared list pattern, including create/view/edit navigation and locked-master copy behavior.
2. Build `/spells/new`, `/spells/$spellId`, and `/spells/$spellId/edit` using SSR loaders and TanStack Query hydration.
3. Render the sectioned spell form from the shared runtime plus spell-specific complex field renderers instead of the old spell-specific global store.
4. Rebuild the effects surface so Spell owns summary cards while `components/EffectEditor` owns the reusable full-screen modal editor.
5. Keep save, load, edit, and copy flows entirely on the shared REST adapter.
6. Ensure SSR renders the shell and initial spell payload while heavy effect editing hydrates client-side.

## Stories, Tests, and Playwright

- Storybook:
  - spell list states
  - spell list row owned vs locked-master
  - basics section
  - casting and traits section
  - effect summary card
  - representative effect editor states
- Vitest:
  - spell field rendering
  - conditional material description logic
  - effect-summary serialization and draft updates
  - REST adapter/reference-data mapping
- Playwright:
  - list load and filtering
  - create spell
  - edit owned spell
  - copy locked master spell into owned draft

## Post-Closeout Technical Audit

- Verified against the 9.9 impeccable technical audit issue class after Race approval.
- Spell detail/edit now parses draft payloads through `spellAuthoredDtoSchema` before passing them into the form.
- Spell detail/edit remounts the TanStack form with a route/draft-aware key so switching records or active/draft state cannot retain stale form state.
- Spell activation invalidates the owned draft query after successful save so the UI does not keep showing a stale draft over the active record.

## Legacy Cleanup

- retire the old spell form step implementation
- retire spell mutations routed through legacy web-side server functions
- retire the superseded assumptions in the archival spell docs after the replacement routes are live

## Exit Criteria

- Spell list and form run on the shared shell, data runtime, and form runtime.
- Locked-master spell copy works end to end.
- The effect editor supports all current schema-backed outcome families at v1 quality.
- The effect editor is stable enough to serve as the reusable pattern for later domains that author similar effect structures.

## Implementation Notes

- `/spells` now navigates to create, view, edit, and locked-master duplicate flows instead of staying fixture/list-only.
- `/spells/new`, `/spells/$spellId`, and `/spells/$spellId/edit` are live route files with SSR query loaders.
- Spell reference data is fetched through the shared REST adapter and `apps/apis`, including systems, classes, creatures, damage types, condition types, and magic schools.
- Spell's explicit reference-data loader and partial web-local node-condition handling are accepted as a temporary bridge for the first domain slice, not the long-term authored-form pattern. [PHASE_9_6_1_NODE_MAP_RESOLVER_SUBPLAN.md](PHASE_9_6_1_NODE_MAP_RESOLVER_SUBPLAN.md) has now added the trusted runtime path for resolved node visibility, requiredness, hidden behavior, and node-map `DATA` option sources behind `packages/functions` and `apps/apis`.
- 9.7 closeout corrected the Spell bridge: the isolated Spell form now consumes the node-runtime resolver for top-level class, school, component, attribute, and material-description field metadata while keeping the Figma IF layout and reusable EffectEditor composition. The remaining explicit Spell reference data is for effect-editor/reference inputs outside the current top-level node-map field option path.
- `SPELL_NODE_MAP` now owns the material-description `showIf` and `CLEAR` behavior, so client UX clearing and backend save normalization share the same authored metadata.
- Spell saves now run through node-runtime value normalization before persistence, so hidden `CLEAR` behavior is enforced server-side even while some field-option reference wiring remains temporary.
- `components/EffectEditor` owns the reusable effect authoring surface and opens as a full-screen modal/drill-in editor.
- The EffectEditor full-screen shell was reworked toward the Figma Effects frame: custom header, breadcrumb trail, canvas body, content panel, and footer actions instead of stock modal chrome.
- Read-only EffectEditor stories now hide remove actions and use the reusable `IExternalLink` icon for view/open.
- Spell form visual polish now uses the IF frame direction more closely: 22px page title, compact section panels, Figma-like field labels, chip styling, and a simpler sticky footer.
- Spell form interaction was corrected to match the IF screens: `Spell Info` shows Basics, Details, and Components & Attributes together, and `Next` advances to Effects. The generic shared runtime section-sidebar pattern is not used for the Spell IF flow.
- EffectEditor sections now use the existing `Collapse` component with borderless Figma-style rows and icon chevrons. The Effects flow avoids artificial cards/panels on the Figma `How it Starts` and `Outcome Paths` screens.
- The `How it Starts` effect editor screen now includes the Figma section structure: `Trigger`, `Reach & Area`, `Targeting`, and `Activation`.
- The EffectEditor monolith was split into composable pieces for the modal shell, invocation step, outcome path list, path editor, outcome rows, summary cards, shared collapse wrapper, and shared types.
- The EffectEditor modal drill-in was separated from the summary section. `EffectEditor` owns the local active-effect state, `EffectEditorModal` owns the drill-in flow, and `components/Modal/FullscreenModal` provides the reusable Mantine full-screen overlay foundation without routing form-local draft state through the global `ModalProvider`.
- The path detail outcomes screen now follows the Figma row pattern: `Path Basics` and `Outcomes` are separate collapsible sections, outcomes render as compact rows, and `+ Add outcome` is an action button/menu rather than an inline select field.
- The existing `Collapse` component was lightly modernized for this use: default-open support, explicit title id/class support, custom collapse icons, current `#`/relative imports, and foundation-token styling.
- New Phase 9 form fields now use split `AppSelect` and `AppMultiSelect` controls built on Mantine instead of the legacy overloaded `Dropdown`. The legacy dropdown remains only for unrebuilt forms. Ordinary multiselects do not expose authoring mode; the All shortcut is opt-in and can map to implicit `ALL` authoring semantics where a domain needs it.
- Multiselect selected values are now visually constrained to one input row with ellipsis overflow instead of wrapping into multiline input height. This keeps authored forms visually consistent with ordinary text, number, textarea, and select controls.
- Disabled/read-only input-like controls now use the same visual treatment across text, textarea, number, tags, select, and multiselect surfaces so locked master content does not appear partially editable or inconsistently disabled.
- Page-level authored form constraints are owned by a reusable `AuthoredFormPageFrame`, not by individual form components. Spell routes and Spell stories now wrap the fluid `SpellForm` in that frame so future authored domains can reuse the same max-width/gutter ownership rule.
- 9.7 consistency review extracted shared authored-form layout primitives (`AuthoredFormRoot`, `AuthoredFormHeader`, `AuthoredFormShell`, `AuthoredFormSectionStack`, `AuthoredFormSection`, and `AuthoredFormFooter`) so Spell uses the same form structure as Background while keeping its own Spell Info and Effects flow.
- The rebuilt Spell implementation is now the canonical `apps/web/src/domains/spells` implementation. The temporary `modern` folder was removed; older provisional Spell files were moved under `apps/web/src/legacy/domains/spells` as explicit retirement targets.
- Active Spell routes import from `#domains/spells`, not a versioned or temporary subfolder.
- `/spells/$spellId` now acts as the nested spell-detail layout/data route and renders an `Outlet`. The view surface lives at the index child route, while `/spells/$spellId/edit` mounts the edit child route correctly.
- The shared parent spell-detail loader owns the spell detail and reference-data prefetch for both view and edit routes so the edit child does not duplicate the same REST prefetch work.
- Spell owns only the Spell-specific form sections and effect summary placement.
- Legacy spell form code remains in place as a retirement target until the review gate accepts the replacement route path.

## Validation Notes

- `cmd /c yarn build:schema` passes.
- `cmd /c yarn workspace @artificer-toolkit/web test src/components/EffectEditor/EffectEditor.test.ts src/domains/spells/spellAuthoring.test.ts` passes.
- `cmd /c yarn workspace @artificer-toolkit/web test` passes.
- `cmd /c yarn workspace @artificer-toolkit/web build-storybook` passes with the existing Storybook chunk-size warning.
- `cmd /c yarn workspace @artificer-toolkit/web test:e2e:storybook` passes.
- `cmd /c yarn workspace @artificer-toolkit/web test src/components/Form/runtime/FormRuntime.test.tsx src/components/EffectEditor/EffectEditor.test.ts` passes after the shared input disabled-state and multiselect overflow polish.
- `cmd /c yarn workspace @artificer-toolkit/web test:e2e:storybook --grep "effect editor|spell form story|select"` passes after the shared select/form frame polish.
- `cmd /c yarn workspace @artificer-toolkit/web test src/components/Form/runtime/FormRuntime.test.tsx src/components/EffectEditor/EffectEditor.test.ts src/domains/spells/spellAuthoring.test.ts` passes after the authored form page-frame extraction.
- `cmd /c yarn workspace @artificer-toolkit/web test` passes.
- `cmd /c yarn workspace @artificer-toolkit/web test:e2e:app` passes for the current public/auth smoke suite.
- `cmd /c yarn workspace @artificer-toolkit/web build-storybook` passes with the existing Storybook chunk-size warning.
- Targeted typecheck filtering for the touched Spell, Select, Form runtime, and EffectEditor files reports no matching errors.
- `cmd /c yarn workspace @artificer-toolkit/web test src/routes/-spellRoutes.test.ts src/domains/spells/spellAuthoring.test.ts` passes after the nested spell edit route correction.
- Targeted typecheck filtering for the touched Spell route files reports no matching errors after the nested spell edit route correction.
- `cmd /c yarn workspace @artificer-toolkit/web test src/components/EffectEditor/EffectEditor.test.ts src/domains/spells/spellAuthoring.test.ts src/routes/-spellRoutes.test.ts` passes after the EffectEditor modal extraction.
- `cmd /c yarn workspace @artificer-toolkit/web test:e2e:storybook --grep "effect editor|spell form story|select"` passes after the EffectEditor modal extraction.
- `cmd /c yarn build:web` remains blocked only by the documented legacy `apps/web/src/utils` alias/type failures, not by 9.6 Spell or EffectEditor files.
- 9.7 closeout Spell correction validation:
  - `yarn test:shared node-sections` passes.
  - `yarn build:shared` passes.
  - `yarn build:functions` passes.
  - `yarn workspace @artificer-toolkit/web test src/components/Form/runtime/FormRuntime.test.tsx src/domains/spells/spellAuthoring.test.ts` passes.
  - `yarn workspace @artificer-toolkit/web test:e2e:storybook --grep "spell form"` passes.
  - `yarn workspace @artificer-toolkit/web build-storybook` passes with the existing Storybook chunk-size warning.
  - `yarn build:web` remains blocked only by the documented legacy `apps/web/src/utils` alias/type failures, not by Spell runtime files.

## Manual Review Checklist

- Accepted for closeout with known follow-up expectation that later domain forms reuse `AuthoredFormPageFrame` rather than reintroducing page width and gutter decisions inside form components.
- Additional token/radius tightening can continue opportunistically during the later authored-domain rollouts, but it is not blocking 9.6.
