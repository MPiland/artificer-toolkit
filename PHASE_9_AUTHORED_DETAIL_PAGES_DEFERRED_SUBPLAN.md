# Phase 9 Authored Detail Pages Deferred Subplan

## Summary

Authored-content detail pages are intentionally frozen until they have a Figma-backed design. The current authored form is not a canonical detail page; it is the temporary read-only inspection surface for locked/master records and direct `/:id` navigation.

## Decision

- Direct authored detail URLs redirect from `/:id` to `/:id/edit`.
- List row view actions navigate to `/:id/edit`.
- Locked/master records render through the authoring form in read-only mode and expose duplicate-to-draft when allowed.
- Active code should not add new `DetailPage` components or standalone authored detail routes until a detail-page design is accepted.
- Future authored domains, including Vehicle, should follow this rule from the start.

## Deferred Design Requirements

Before unfreezing detail pages, create or accept Figma designs that define:

- Information architecture for player-facing read-only content.
- Provenance, ownership, draft, and locked/master status presentation.
- Primary actions for duplicate, edit, resume draft, and navigation.
- Responsive layout and copy rules that differ from authoring form language.

## Reopen Criteria

Detail pages can be reintroduced once the design is approved, route behavior is updated intentionally, and list view actions have tests proving the new detail flow.
