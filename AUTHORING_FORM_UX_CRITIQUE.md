# Authoring Form UX Critique and Design-System Delta

## Scope

This critique compares four design inputs for the shared Artificer authoring platform and locks the next implementation pass to the Black Forge palette direction.

- Local concept image: [output/design/authoring-focused-object-editor-concept.png](output/design/authoring-focused-object-editor-concept.png)
- Stitch project: `Artificer Toolkit Authoring Patterns` (`10723212834699713676`)
- Stitch screen: `Dragonborn Damage Editor` (`71b051bf0b9849339da6c50e9a82de57`)
- Stitch screen: `Ember Lance - Upcast Scaling Editor` (`0f406d43b4664e0db95844d842127a22`)
- Stitch screen: `Cinder Drake - Tail Sweep Action Editor` (`7be34e94f30e4293a1d07ec1ee8e4f16`)
- Black Forge Stitch design-system asset: `4fb587a749c04acda6ae3ee9d24828e0`
- Black Forge Stitch variants:
  - `Upcast Scaling - Black Forge Edition` (`2db12d8bc7f24467b77b799b70290085`)
  - `Dragonborn Damage Editor - Black Forge Edition` (`fefedf01f323499990f5dc3fac5ef586`)
  - `Cinder Drake - Tail Sweep Action Editor - Black Forge Edition` (`093f7570302e4593a3ee6e08794e7afa`)

This is a pattern critique, not a production UI audit. The inputs are generated mockups and design probes, so the useful output is a system direction: what interaction model, layout components, and visual rules should become canonical before implementation.

## Evaluation Lens

The decision criteria come from `PRODUCT.md`, `DESIGN.md`, and `$impeccable` product guidance:

- Keep complex creation inviting, not bureaucratic.
- Use familiar product UI patterns when users are doing repeat work.
- Preserve strong orientation through nested structure.
- Make action scope obvious: step, object, draft, or record.
- Avoid arbitrary modal stacks and full data-path breadcrumbs.
- Use density where it helps comparison and editing.
- Keep the tone Artificer: creative, familiar, playful, reliable.
- Preserve the existing Mantine, vanilla-extract, TanStack Start, and node-runtime direction.

## Executive Decision

Adopt the structure-driven focused object editor.

The strongest pattern is not a wizard, not a flat long form, and not deeper fullscreen modal nesting. It is a record workspace with a scoped structure rail, a focused editor for the selected object, a domain-specific preview panel, and a sticky action bar with explicit scope.

The local concept image is still the best north-star topology. The Stitch screens prove the same topology can survive race, spell, and creature authoring, but the Stitch-generated design theme drifts too corporate, IDE-like, and blue-heavy. Use Stitch for layout and color pressure tests. Use `DESIGN.md` for the actual Artificer tone.

## Critique Matrix

| Input | Score | What Works | Main Risk | Decision |
|---|---:|---|---|---|
| Local concept image | 8.5/10 | Best overall topology: structure rail, focused editor, right preview, compact scaling rows, scoped footer. It solves the long breadcrumb smell without flattening complexity. | The rail can become noisy if it mirrors the whole object graph. Validation marker rules need to be formalized. | Use as primary topology reference. |
| Dragonborn Damage Editor | 8/10 | Validates the exact race problem: nested damage editing becomes understandable when current object, siblings, and preview are separated. | Race-specific examples may under-test branching and non-linear authoring. Avoid copying Stitch's corporate tone. | Use as continuity proof for the current UI pain. |
| Ember Lance Upcast Scaling Editor | 8/10 | Strong proof that repeated scalar breakpoints should be rows or table-like inputs, not collapsible cards. The preview can show final spell language. | Spell structures can become wider than the rail. Upcast scaling needs clear separation between editable values and derived preview text. | Use as the primary proof for collection presenter rules. |
| Cinder Drake Tail Sweep Action Editor | 8.5/10 | Strongest domain stress test. Creature actions benefit from stat-block preview, validation surfaced in context, and object-level editing. | Can become too dense if every mechanic section is visible at once. Needs a clear section order for action basics, attack, damage, save rider, recharge, and preview. | Use as the best proof that the pattern is platform-level, not race-only. |

## Cross-Screen Findings

### 1. The Structure Rail Is Required

The rail should replace long focused-editor breadcrumbs as the primary nested orientation model.

Rules:

- Show all non-conditional top-level steps.
- Hide inactive conditional branches.
- When the user enters a conditional branch, show that branch's own non-conditional child steps.
- Include validation and dirty markers on meaningful nodes.
- Show siblings when sibling comparison matters.
- Collapse ancestors that are only context.
- Keep item labels user-facing: `On Save Failure`, `Damage`, `Upcast Scaling`, not persistence or DTO terms.

### 2. The Header Must Stay Short

The focused editor header should show:

- current object title: `Damage`
- object type or status badge when useful
- short parent context: `Breath Weapon / On Save Failure`
- optional full path in a menu or inspector

It should not display the complete path as the main header. A long path is a smell that the structure model is missing.

### 3. Collections Need Presentation Kinds

The current universal collapsible-row instinct should become an explicit renderer decision.

Recommended kinds:

- `inline`: one to four simple scalar fields
- `table`: repeated scalar breakpoints such as level scaling
- `summary`: title, description, status, and primary actions
- `focused`: nested object with child arrays, branching logic, lifecycle, or review needs

Scaling levels are the clearest example of `table`. Race ancestry options and feature mechanics are usually `summary` into `focused`.

### 4. Preview Is a First-Class Work Surface

The right panel is not decoration. It is how a structural editor stays connected to the player-facing result.

Preview rules:

- Race feature preview should show final rule prose.
- Spell preview should show spell card language and upcast text.
- Creature preview should show stat-block or action text.
- Validation in preview should point back to rail nodes and fields.
- Preview can collapse below the editor on narrower widths.

### 5. Action Scope Needs Its Own Vocabulary

The sticky footer should not force users to infer what a button resets or saves.

Canonical action scopes:

- `Done`: exit current focused object.
- `Save draft`: save the whole authored record.
- `Reset current step`: only the active top-level chapter.
- `Reset current object`: only the selected focused object.
- `Reset whole draft`: entire unsaved record state.
- `Activate`: top-level review or valid final state only.

Unavailable scopes should be disabled with a clear reason, not just visually muted.

### 6. Tone Needs Correction Before Implementation

Stitch's generated design system currently says "Precise, Functional, Systematic" and "Modern / Corporate." It also leans too heavily into blue surfaces. That is useful as a warning. Artificer should be structured and reliable, but it should not feel like a database admin tool.

Corrective rules:

- Move dark surfaces toward black and charcoal, not blue slate.
- Use cyan for current selection, primary action, and focus.
- Use orange for draft, creation, progress, warning, and craft-energy moments.
- Use purple sparingly for arcane or special selected-state emphasis.
- Keep orange under roughly ten percent of dense authoring surfaces.
- Avoid IDE metaphors as copy or visual language.
- Do not add fantasy parchment, medieval type, or novelty controls.

## Design-System Delta

These are the components and rules that should be added to the shared authoring platform.

### `AuthoringWorkspaceShell`

The top-level authored record workspace.

Responsibilities:

- record title and record-level status
- top-level chapter navigation
- save, activate, review, and draft lifecycle access
- layout slots for rail, editor, preview, and footer

### `AuthoringStructureRail`

A scoped outline for the active authored branch.

Responsibilities:

- hierarchy and sibling navigation
- dirty, warning, error, and valid markers
- add/remove for major child nodes
- keyboard navigation
- mobile drawer/switcher behavior

Desktop target width: `280px` to `320px`.

### `FocusedObjectHeader`

The title and context strip for the selected nested object.

Responsibilities:

- current object title
- short context path
- object status and validation summary
- close/back action
- overflow menu for full path and destructive actions

### `FocusedObjectEditor`

The central editor body for one selected object.

Responsibilities:

- render fields for the current object only
- allow one local tab row at most
- avoid showing ancestor forms inline
- route nested children through the rail and collection presenter

### `AuthoringPreviewPanel`

A domain-specific rendered output panel.

Responsibilities:

- show the player-facing result
- show validation feedback in context
- link preview issues back to source fields
- collapse responsively when space is constrained

Desktop target width: `320px` to `380px`.

### `CollectionPresenter`

A shared renderer decision for arrays and repeated objects.

Presentation kinds:

- `inline`
- `table`
- `summary`
- `focused`

The renderer should not infer everything from depth. The resolved node metadata should be able to express the intended presentation.

### `ScalarRowTable`

The compact row/table pattern for repeated scalar breakpoints.

Use for:

- spell upcast levels
- damage scaling
- resource progression rows
- cost or tier rows

Rules:

- each row has fixed columns
- delete/reorder affordances are aligned at row end
- labels stay visible on mobile by stacking each row into labeled cells
- no collapsible row unless the row contains nested content

### `ScopedActionBar`

The sticky footer used across page and focused object modes.

Responsibilities:

- left: back/cancel/done
- center: reset or secondary draft actions
- right: primary forward/save action
- explicit disabled states and scope labels

The page footer and focused editor footer should share this component and differ only by padding or container context.

### `AuthoringStatusMarker`

A small marker vocabulary for rail rows, section headers, and preview issues.

States:

- clean
- dirty
- warning
- error
- valid
- locked
- inherited

The state must never depend on color alone. Pair color with icon, label, or tooltip.

### `FieldGuide`

A contextual help panel or popover for complex mechanics.

Use when:

- a field needs rule explanation
- the user is choosing between mechanic models
- a domain term is correct but not obvious

This should be available on demand, not permanently occupying the main editor.

## Node-Runtime Implications

The platform likely needs presentation metadata in the resolved node tree. Keep it reusable and contract-driven rather than domain-local.

Possible metadata:

```ts
type AuthoringPresentationKind = 'inline' | 'table' | 'summary' | 'focused'

type AuthoringPresentationMetadata = {
  kind: AuthoringPresentationKind
  titleField?: string
  summaryFields?: string[]
  previewPresenter?: string
  validationPath?: string
}
```

This shape is illustrative, not final. The important decision is that presentation should be explicit where the generic renderer cannot know the user's mental model from schema shape alone.

## Implementation Strategy

Start with one vertical slice, then prove portability.

1. Race feature mechanics: use the existing Dragonborn Breath Weapon pain as the continuity test.
2. Spell scaling: prove the table collection presenter and preview model.
3. Creature action: prove domain-specific preview and branching action mechanics.

Do not start by rebuilding every domain. The platform should grow from a slice that exercises rail navigation, focused object editing, table rows, preview, dirty markers, and scoped footer actions.

## Anti-Decisions

Do not do these:

- make the main authoring model a pure wizard
- continue unlimited fullscreen modal nesting
- use a long breadcrumb as the structure model
- make every array a collapsible row
- turn the right preview into decorative chrome
- copy Stitch's corporate/IDE tone into the product
- implement race-only shortcuts that cannot carry to spells, creatures, classes, and equipment

## Open Decisions Before Code

- Should focused object editing be route-like state, a full-page subworkspace, or an overlay with route semantics?
- Should the structure rail show the whole record or only the focused branch?
- Should preview be always visible on desktop, user-toggleable, or domain-specific?
- Should reset scopes be one popover button or separate visible actions in high-risk contexts?
- Which validation states belong in the rail versus only inline near fields?

## Recommended Next Step

Before implementation, convert this delta into a focused component and metadata plan:

- component inventory and ownership under `apps/web/src/forms`
- node metadata changes in shared contracts
- one pilot user flow for Race Breath Weapon damage editing
- one portability proof for Spell upcast scaling

That gives us a narrow path from concept to code without turning the whole form platform into a speculative rewrite.
