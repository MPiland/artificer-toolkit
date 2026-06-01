# Forge Authoring Implementation Brief

## Impeccable Shape Gate

The authoring workspace should follow the cleaned Stitch north stars: Black Forge for dark mode, White Forge for light mode, and the desktop race/spell/creature scenarios as canonical layout references. The primary user action is focused content editing with constant orientation: structure rail on the left, focused editor in the center, optional preview/inspector on the right, and persistent actions at the bottom.

The color strategy is restrained product UI with a stronger brand accent: orange owns primary action, creation momentum, draft/progress, and dice/data highlights. Teal is secondary and functional for focus rings, technical selection, and supportive navigation. Purple remains rare for arcane emphasis.

Responsive behavior should keep the same mental model:
- Desktop: structure rail, editor canvas, optional preview/inspector.
- Tablet landscape: rail and editor remain; preview may collapse.
- Tablet portrait and mobile: editor first, structure and preview as drawer destinations.

Quick Start is intentionally out of scope. Label help tooltips and long-hover/press option descriptions are planned extension points, not part of this pass.

Implementation shape delivered in this pass:
- Top-level authoring layout supports structure rail, focused editor canvas, optional preview rail, and mobile/tablet drawer destinations for structure and preview.
- Top-level authoring layout now includes a default Context rail when a domain does not provide a richer preview, so desktop authoring keeps the Stitch three-region shape instead of collapsing to a sparse two-column form. The default rail uses the Stitch vocabulary of Outcome Context and Rule Preview, backed by current step status, field count, required count, and draft activity.
- Authoring sections render as Forge panels with charcoal surfaces, low-contrast outlines, and compact spacing to better match the cleaned Stitch Black Forge screens.
- Structure rails include the stable top-level steps and can expose the active step's visible section outline as the current branch's child context.
- Nested group editing now uses `AuthoringFocusedWorkspace` instead of the previous fullscreen modal shell.
- Nested workspaces keep the same mental model: title/context header, structure rail when the nested group has stable steps, editor canvas, Context rail, and persistent action bar.
- The rail shows stable resolved steps and uses text-backed dirty markers, not color-only signals.

## Impeccable Critique Gate

The current app risks came from modal-feeling nested authoring, blue-heavy accents, weak mobile structure navigation, and scaling rows that looked like generic collapsible content instead of compact data entry. The Stitch direction fixes the topology, but its generated design-system copy over-weights IDE/admin language and sometimes treats orange as warning or global decoration.

Implementation corrections:
- Keep the interaction model product-native, not fantasy parchment and not IDE chrome.
- Make orange the primary action/craft accent while preserving warning and destructive semantics.
- Keep dirty/warning/error markers visible with labels or icons, never color alone.
- Treat nested object editing as a focused workspace and remove the obsolete fullscreen modal component path.
- Use compact input rows for damage scaling and similar repeated numeric entries.

Critique outcome:
- P1 risk addressed: modal-first nested editing now has a workspace route-like surface.
- P1 risk addressed: blue-heavy authoring surfaces now use Black Forge and White Forge token direction with forge orange as the primary CTA/brand accent and teal as focus/technical support.
- P2 risk partially addressed: tablet/mobile now have reachable structure and preview drawers, but a live visual pass is still required to tune the final compact navigation pattern.
- P2 risk addressed for damage scaling: repeated damage level entries render as compact input rows rather than collapsible row stacks.

## Impeccable Polish Gate

Polish checks for this pass:
- Button vocabulary is consistent across page footer and nested editor footer.
- Structure rows have consistent active, hover, dirty, warning, error, disabled, and focus states.
- Form spacing uses tokenized 4px-derived rhythm and does not create nested-card stacks.
- Orange appears with intent and does not overwhelm dense authoring surfaces.
- White Forge and Black Forge keep matching hierarchy rather than becoming separate products.

Polish outcome:
- Page and nested editor footers now share the same `AuthoringActionBar` surface treatment.
- Reset Step is disabled when the active step has no changes.
- Nested editor tests assert the focused workspace behavior instead of `dialog` behavior.
- Storybook authoring walkthrough coverage now tracks nested focused workspaces instead of modal/dialog depth.
- Singular add/edit/remove labels are now asserted consistently in focused tests.
- The focused test suite covers form platform, race, background, feat, vehicle, and equipment authoring paths.

## Impeccable Audit Gate

Technical audit checks after implementation:
- Accessibility: visible keyboard focus, labelled drawer controls, sufficient contrast, no color-only statuses.
- Performance: no layout-property animation, no expensive decorative effects, no unnecessary extra render state.
- Theming: no new one-off hard-coded authoring colors outside tokens.
- Responsive: no horizontal scroll on mobile/tablet, drawer destinations remain reachable, touch targets are at least 44px where practical.
- Anti-patterns: no side-stripe accents, decorative gradients, glassmorphism, nested cards, or modal-as-default flow.

Audit evidence:
- `node .agents/skills/impeccable/scripts/detect.mjs --json DESIGN.md apps/web/src/css/foundations.css.ts apps/web/src/forms apps/web/src/domains/races apps/web/src/domains/feats` returned `[]`.
- `node .agents/skills/impeccable/scripts/detect.mjs --json apps/web/src/forms apps/web/src/css/foundations.css.ts apps/web/src/domains/races apps/web/src/domains/feats` returned `[]` after the Stitch-alignment pass.
- Stitch reference screenshots were downloaded to `output/design/stitch-black-forge.png`, `output/design/stitch-cinder-drake.png`, and `output/design/stitch-mobile-editor.png`.
- Current implementation review screenshots were captured at `C:\tmp\forge-spell-effect-open-right-rail.png`, `C:\tmp\forge-spell-tablet-effects.png`, `C:\tmp\forge-spell-tablet-portrait.png`, `C:\tmp\forge-spell-mobile-basics.png`, and `C:\tmp\forge-spell-mobile-context-drawer-wait.png`.
- Mobile, tablet portrait, and tablet landscape screenshot passes reported no horizontal document overflow.
- Storybook console audit for the exercised spell authoring path reported no warnings or errors after the shared authoring form opted out of native browser validation.
- `rg` found no active form references to `AuthoringEditorModal`, `FullscreenModal`, `ui/overlays`, or authoring `dialog` tests. The remaining active `dialog` hits are unrelated confirmation and character save modals.
- `yarn turbo:test:authoring` passed after the Stitch-alignment pass: `FormPlatform.test.tsx`, `RaceAuthoring.test.tsx`, `BackgroundAuthoring.test.tsx`, `FeatAuthoring.test.tsx`, `VehicleForm.test.tsx`, and `EquipmentForm.test.tsx` (42 tests).
- `yarn turbo:typecheck:web` passed for `typecheck:app` and `typecheck:tests`; a repeat run replayed both from Turbo cache in 89ms.
- `yarn workspace @artificer-toolkit/web typecheck:app` passed after the Context rail and rail-outline changes.
- `yarn workspace @artificer-toolkit/web typecheck:stories` passed after moving Storybook story types to `@storybook/tanstack-react`.
- `yarn workspace @artificer-toolkit/web build-storybook` passed on Storybook 10.4.1 with `@storybook/tanstack-react`; Vite still reports existing chunk-size/plugin-timing warnings.
- `yarn workspace @artificer-toolkit/web test:e2e:authoring-storybook` passed 33 Storybook authoring walkthrough tests and no longer hits the prior TanStack Start browser import failure.
- `yarn turbo:test:authoring --dry`, `yarn turbo:affected:test --dry`, and `yarn turbo:affected:typecheck --dry` confirmed the new focused and affected validation entrypoints resolve to the intended package tasks.
- The focused form test harness now clones default values and resolved models per render input to prevent nested authoring tests from mutating shared fixtures.
- Storybook now uses the official `@storybook/tanstack-react` framework instead of local TanStack Start import aliases. Mantine Storybook theming follows the Mantine guide pattern with `forceColorScheme`, shared `AppProviders`, and `ColorSchemeScript`.

Current open alignment gaps:
- The core authoring layout now follows the Stitch three-region shape and uses the Stitch right-rail vocabulary, but domain-specific preview content is still generic outside character builder. Spell, race, and creature previews should eventually supply outcome/rule/reference summaries that match the Stitch examples more closely.
- Storybook authoring stories do not include the full app shell/header, so Storybook screenshots prove the form-platform layout but not the complete in-app composition.
- Mobile has Structure and Context destinations plus a stronger action layout, but the final mobile navigation pattern still needs iteration against the Stitch mobile north stars.
