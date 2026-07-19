# Authoring Form Pattern Review

> **Document status:** Historical/working pattern review. The current authoring contract is [the node-map ADR](docs/adr/0004-backend-resolved-node-maps.md) and the current UI/product intent is [PRODUCT.md](PRODUCT.md) plus [DESIGN.md](DESIGN.md). This review provides context, not an overriding API or runtime contract.

## Purpose

This note defines a holistic pattern direction for Artificer Toolkit authored forms across all content domains: races, classes, spells, feats, backgrounds, equipment, creatures, vehicles, and future authoring surfaces that reuse the same node-runtime platform.

The current race editor exposed the core problem: deeply nested authored objects can produce modal headers and breadcrumbs that read like a serialized data path rather than a usable editing workflow. That is not a race-only issue. It is a platform pattern issue.

## Product Constraints

Artificer authoring is not a simple admin form and not a one-time application flow. It is repeat-use creative construction of structured game objects.

The pattern must support:

- large objects with multiple top-level chapters
- nested authored objects such as features, grants, effects, paths, outcomes, options, scaling rows, and conditions
- branching mechanics where later fields depend on earlier choices
- repeated collections with summaries, validation, and reordering
- draft save, partial reset, activation, and review
- both novice guidance and semi-expert direct navigation
- desktop and mobile layouts without treating mobile as a collapsed afterthought

The UI must keep authored contracts human-readable. It should not expose persistence shape, join-table thinking, or backend normalization as the primary authoring experience.

## External Pattern Signals

The relevant external examples are not one category. Artificer needs a hybrid.

- Government and public-service forms show the value of breaking complexity into small logical pieces. GOV.UK recommends starting from one thing per page for complex or branching services, but that pattern is optimized for low-frequency guided completion rather than repeat creative editing. Source: [GOV.UK form structure](https://www.gov.uk/service-manual/design/form-structure).
- Step indicators are useful for linear flows, but USWDS warns against them when steps are not required to be completed in order, when steps are conditional, or when users need to navigate freely. Source: [USWDS step indicator](https://designsystem.digital.gov/components/step-indicator/).
- Carbon's create-flow guidance separates small modal edits, medium side-panel tasks, and complex wide/page-level workflows. That supports the idea that deeply nested authored objects should not keep escalating inside modal stacks. Source: [Carbon create flows](https://carbondesignsystem.com/community/patterns/create-flows/).
- Healthcare and public-sector forms use fieldsets to group related controls under a shared question or concept. This reinforces grouping by user-meaningful concept rather than by storage path. Source: [NHS fieldset guidance](https://service-manual.nhs.uk/design-system/components/fieldset).
- CMS and structured content tools group fields and nested objects, but they avoid unlimited nested sections. Contentful field groups organize fields into sections; that limit is useful because nested sections quickly become orientation debt. Source: [Contentful field groups](https://www.contentful.com/help/fields/field-groups/).
- Sanity's object fields show that nested object editing is a real content-authoring problem, and that collapsibility becomes necessary as depth grows. Source: [Sanity object type docs](https://www.sanity.io/docs/studio/object-type).

## Current Pattern Smells

These are signs that the current shared form platform is leaking the object graph into the UI:

- Fullscreen editor headers can become a long breadcrumb path: `Race / Ancestry / Options / Black / Features / Breath Weapon / Mechanics / Effects / Saving Throw / Outcome Paths / On Save Failure / Result / Outcomes / Damage`.
- Breadcrumbs are doing structure navigation work. Breadcrumbs should orient, not be the primary editor model.
- Nested fullscreen editors and collapsible rows can make the user feel like they are descending through implementation layers.
- Inline rendering lacks a consistent rule for when a collection is simple enough to stay inline versus complex enough to open a focused editor.
- The footer currently has actions whose scope is not obvious: step, object, draft, or whole form.
- The user's mental model is "I am building a feature or spell mechanic", while the UI can make it feel like "I am editing a path inside a result block inside an outcome".

## Recommended Canonical Pattern

Use a structure-driven object editor, not a wizard and not unlimited nested modals.

### 1. Record Workspace

The top-level authored record remains a page-level workspace.

Examples:

- Race: Basics, Ancestry, Traits, Features, Review
- Spell: Basics, Casting, Effects, Scaling, Review
- Class: Basics, Class Details, Progression, Features, Review
- Creature: Basics, Stats, Defenses, Actions, Features, Review

The top-level navigation can be tabs, a step nav, or a compact chapter rail. It should represent stable authored chapters, not every nested child.

### 2. Structure Rail

Nested editing should use an outline or structure rail for the current authored branch.

The rail owns:

- hierarchy
- validation markers
- dirty markers
- add/remove affordances for major child objects
- direct navigation between sibling objects
- current selection

Example for a focused feature branch:

```text
Breath Weapon
  Basics
  Mechanics
    Saving Throw
      On Save Failure
        Damage
      On Save Success
        Damage
  Grants
  Options
```

The rail is not a full database tree. It should show all non-conditional top-level steps. Inactive conditional branches stay hidden, but when the user enters a conditional branch, that branch's own non-conditional child steps should also be visible.

### 3. Focused Object Editor

When a nested object becomes complex, open it as a focused editor state.

The focused editor header should show:

- object title: `Damage`
- short context line: `Breath Weapon / On Save Failure`
- optional full-path menu: `Show full path`
- close/back action

It should not show the full object path as the main header.

The focused editor body owns fields for the current object only. Ancestors remain visible through the structure rail, not through a breadcrumb chain.

### 4. Collection Presenter

Every array needs an explicit presentation mode.

Use simple inline rows when:

- each item has two to four scalar fields
- the item has no nested child collections
- the item can be understood without a prose summary

Use summary list rows when:

- each item has a title and short summary
- the item has more fields than fit comfortably inline
- the item is usually edited as a unit

Use a table-like editor when:

- all rows share the same compact scalar columns
- users compare values across rows
- examples include level scaling, cost tiers, or breakpoint rows

Use focused object editing when:

- the item contains nested arrays or objects
- the item has branching fields
- the item has its own lifecycle, validation, or review needs

Do not default every array to a collapsible row. Collapsible rows are a fallback for moderate nested content, not the universal collection pattern.

### 5. Review Surface

Every authored domain should have a review mode before activation.

The review mode should show the user-readable result:

- prose preview
- rule/mechanic summary
- validation issues grouped by chapter and object
- unresolved optional gaps
- changes since last saved draft, if available

Review is especially important because the editor is structural, but the finished content is read and played.

## Pattern Selection Rules

| Shape | Use This Pattern | Avoid |
|---|---|---|
| One to four simple scalar fields | Inline fields or compact row | Modal or fullscreen editor |
| Repeated scalar breakpoints | Table-like rows | Collapsible cards |
| Medium object with title, description, and a few children | Summary row plus focused editor | Fully inline nested form |
| Deep object with branching mechanics | Focused editor with structure rail | Long breadcrumb modal stack |
| Linear one-time setup | Guided steps | Freeform outline |
| Nonlinear repeat editing | Structure rail and direct navigation | Step indicator as primary nav |
| High-risk activation | Review surface | Immediate submit from last field |

## Domain Applications

### Races

Use the record workspace for Basics, Ancestry, Traits, Features, Review.

Race ancestry options and features should be summary rows. Editing a feature's mechanics should open the focused object editor with a branch rail. Damage level scaling should stay table-like.

### Classes

Classes need a stronger outline because progression and features interact.

Recommended chapters:

- Basics
- Progression
- Class Features
- Resources
- Subclass Hooks
- Review

Class feature editing should use the same focused object editor as race features, especially for grants, spell packages, and active mechanics.

### Spells

Spells likely need the focused editor most.

Recommended chapters:

- Basics
- Casting
- Delivery
- Outcomes
- Scaling
- Review

Upcasting and conditional outcomes should use structure navigation and preview summaries. A pure wizard would be too rigid because spells vary heavily.

### Creatures

Creatures are closer to stat-block authoring.

Recommended chapters:

- Basics
- Stats
- Defenses
- Senses and Movement
- Actions
- Traits
- Review

Creature actions should use the same focused object editor as feature mechanics. The review surface should resemble a stat block.

### Equipment

Equipment mixes simple metadata with nested contents, variants, and magic properties.

Recommended chapters:

- Properties
- Economy
- Contents
- Mechanics
- Variants
- Review

Contents can often be table-like. Magic variants and active item powers should use focused object editing.

### Backgrounds, Feats, Vehicles

These should reuse the same platform rules:

- simple descriptive fields inline
- grants as summary rows with focused editing when nested
- features and active mechanics through the focused object editor
- review mode that previews the finished game-facing content

## Action Scope Model

The sticky action bar should make action scope explicit.

Recommended actions:

- `Save draft`: global draft action
- `Done`: exits current focused editor
- `Activate`: available from top-level review or valid final state
- reset menu:
  - `Reset current step`
  - `Reset current object`
  - `Reset whole draft`
- destructive actions:
  - delete object from row or object header
  - require confirmation when the object has nested children or saved content

The reset menu should disable unavailable scopes. For example, `Reset current step` should be disabled when the step is clean, even if another step is dirty.

## Header Model

Use three levels of orientation, each with a job.

1. App shell breadcrumb: record-level location, such as `Races / Dragonborn Copy`.
2. Top-level chapter nav: record chapter, such as `Ancestry`.
3. Focused object header: current object title and short parent context, such as `Damage` and `Breath Weapon / On Save Failure`.

Do not merge all three into one breadcrumb line.

## Mobile Model

Mobile should preserve the same information architecture.

Recommended behavior:

- record workspace remains chapter-based
- structure rail becomes a drawer or object switcher
- all non-conditional top-level steps remain available from the structure control
- active conditional branches expose their own stable child steps
- focused editor body stays full width
- sticky action bar remains visible
- full path is available through a context menu, not permanently visible
- review mode remains a first-class step

## Migration Plan

### Phase 1: Pattern Hardening

- Keep existing node-runtime contracts.
- Add explicit rendering categories for arrays: compact row, summary row, table row, focused object.
- Stop using collapsible rows as the default nested pattern.
- Replace long focused-editor breadcrumbs with title plus short context.
- Make reset/save action scopes explicit.

### Phase 2: Structure Navigation

- Introduce a structure model derived from the current resolved node tree and active editor path.
- Add validation and dirty markers to structure items.
- Let focused editors navigate siblings and ancestors through the rail.
- Keep breadcrumbs for location only.

### Phase 3: Review Mode

- Add a shared review surface contract.
- Implement domain presenters for at least race, spell, class, and creature.
- Show validation grouped by record chapter and nested object.

### Phase 4: Mobile Refinement

- Convert the structure rail to a drawer or switcher.
- Verify focused editing, footer actions, and validation navigation at mobile widths.
- Avoid desktop-only hierarchy.

## Concept Probe

A concept image was generated for a single focused editor step: editing `Damage` inside `Breath Weapon / On Save Failure`.

Preview artifact: [output/design/authoring-focused-object-editor-concept.png](output/design/authoring-focused-object-editor-concept.png)

Follow-up critique and design-system delta: [AUTHORING_FORM_UX_CRITIQUE.md](AUTHORING_FORM_UX_CRITIQUE.md)

The concept direction shows:

- short focused header instead of a full breadcrumb trace
- structure rail for nested orientation
- central focused editor body for the current object
- table-like rows for scaling levels
- optional rule preview panel
- sticky scoped actions

Treat the image as a topology probe, not a final visual spec.

## Open Decisions

- Should the focused object editor be implemented as a route-like subworkspace, a wide drawer/tearsheet, or a fullscreen overlay with route semantics?
- Should the structure rail be global for the whole record or scoped to the currently focused branch?
- Should review mode be a top-level chapter for every authored domain, or a persistent secondary panel that can open from any chapter?
- Which domains should pilot the new pattern first? Race is convenient because it exposed the smell, but spell or creature may be more representative of true platform complexity.

## Recommended Decision

Adopt the structure-driven object editor as the canonical authoring platform pattern.

Do not continue deepening the current fullscreen modal breadcrumb model. It can be patched visually, but the core issue is structural: orientation, validation, and object navigation need a dedicated surface. Breadcrumbs cannot carry that load.
