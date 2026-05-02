# Phase 9.x Authored Detail Pages Subplan

## Summary

Authored-content detail pages are unfrozen as a Phase 9.x interruption before Character Builder. These pages are reader/reference surfaces, not authoring forms. They use a shared `AuthoredDetail` system with domain-specific presenter mappers for spells, backgrounds, feats, races, equipment, creatures, vehicles, and classes.

## Design Decision

- D&D Beyond is an information-architecture reference only: strong title, compact facts, jump navigation, prose, and mechanics/trait sections.
- Artificer detail pages should be cleaner, more modern, less busy, and aligned to the current product design system.
- Do not clone D&D Beyond visuals, parchment skinning, nested cards, browse buttons, or fantasy-cliche decoration.
- Use compact header actions for `Create New`, `Edit`, `Resume Draft`, and `Duplicate` when permissions allow.

## Route Behavior

- Direct authored `/:id` routes render detail pages.
- `/edit` routes remain the authoring routes.
- List row click/view navigates to `/:id`; explicit edit actions navigate to `/:id/edit`.
- Locked/master records are readable on detail pages and expose duplicate-to-draft when `permissions.canCopy` allows.

## Draft Behavior

- Valid owned drafts are previewed by default.
- Active-with-draft detail pages clearly state that the active version remains unchanged until activation.
- Active records with invalid drafts show the active detail page plus an invalid-draft recovery notice.
- Invalid draft-only records show a recovery state with discard/back behavior instead of crashing.
- Draft preview state must be visually unmistakable.

## Implementation Criteria

- Shared detail primitives live in `apps/web/src/components/AuthoredDetail`.
- Domain detail pages live under each active domain `pages` folder.
- Domain presenters avoid raw UUIDs when labels are unavailable, using neutral configured/count copy instead.
- Node-runtime/reference data may hydrate labels later, but detail pages are not a fully node-driven renderer.
- Vehicle and future authored domains should add detail pages only through this shared detail system.

## Acceptance

- Detail routes render for spells, backgrounds, feats, races, equipment, creatures, vehicles, and classes.
- `/edit` routes still mount authoring forms.
- Draft preview, invalid-draft fallback, locked/master read-only, and duplicate-to-draft behavior are covered.
- Storybook includes the shared detail layout states.
- `$impeccable` audit/critique/polish is run before closeout.
