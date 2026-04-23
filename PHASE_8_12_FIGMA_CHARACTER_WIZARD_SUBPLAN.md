# Phase 8.10 - Figma: Character Builder

## Objective

Design the shared character builder that now powers both character creation and post-creation structural edits.

The builder is not a final-submit-only wizard anymore. It is a screen-staged authored builder with explicit section saves, destructive-change previews, and a draft/active lifecycle.

## Route Semantics

The route structure stays the same:

```text
routes/_authed/
  characters/
    index.tsx
    $characterId.tsx
    $action/
      $_characterId.tsx
```

Visible route behavior:

- `/characters/new[/id]`
  - creation draft flow
  - opening the builder does not persist anything
  - the first successful section save creates or resumes a persisted `DRAFT`
  - finalizing promotes the character to `ACTIVE`
- `/characters/edit/:id`
  - post-creation structural edit flow for an existing character
  - uses the same builder screens and backend semantics as creation
- `/characters/:id`
  - character sheet / read-play surface
  - drafts stay visible here with warnings

## Builder Contract

The builder is shared between create and edit. We do not maintain a separate inline edit product.

Core UX rules:

- each screen keeps local staged changes
- each screen has `Save Section` and `Reset Section`
- no per-field autosave
- saves that would remove dependent choices or downgrade `ACTIVE -> DRAFT` must show a preview before persisting
- obvious source-local choices stay on their source screens
- unresolved or deferred choices collect in `Selections`

## Builder Screens

1. `Home`
- `Name`
- concept `Description`
- `Advancement Method`

2. `Species`
- `Race`
- `Subrace`
- ancestry selections
- resolved species summary

3. `Classes`
- class rows
- class level per row
- subclass selection
- specialization selection
- multiclass validation summary

4. `Background`
- `Background`
- profile subgroups:
  - character details
  - physical characteristics
  - personal characteristics
  - other notes

5. `Abilities & HP`
- ability generation method
- assignments / rolled provenance
- hit point method
- per-level HP entries

6. `Equipment`
- starting-equipment intent
- create flow may include initial inventory/currency seeding
- edit flow should not own ongoing inventory/currency management

7. `Selections`
- unresolved feature choices
- spell choices
- proficiency or expertise choices
- ancestry choices not already resolved inline

8. `Review`
- readiness summary
- blocking validations
- finalization action

## Draft / Active Lifecycle

- new user-authored characters begin as `DRAFT`
- section saves persist draft progress
- `Finalize Character` promotes to `ACTIVE` only when readiness passes
- editing an `ACTIVE` character into an invalid or incomplete state drops it back to `DRAFT`
- resolving blockers and finalizing again restores `ACTIVE`

## Destructive Save Preview

Before a section save persists, the client performs a dry-run preview when needed.

Preview-worthy changes include:

- removed ancestry selections
- removed feature acquisitions
- removed option-derived acquisitions
- removed spell selections
- removed resource grants
- cleared starting-equipment intent for changed sources
- status downgrade from `ACTIVE` to `DRAFT`

If no destructive changes are predicted, the section save can continue immediately.

## Ownership Split

Builder-owned structural choices:

- species
- classes / subclass / specialization
- background
- ability method and assignments
- HP intent
- starting-equipment intent
- explicit feature / spell / resource selections
- profile fields

Sheet or play-surface-owned mutable state:

- inventory changes
- currency changes
- HP and resource tracking
- equipped / attuned state

## What This Replaced

This document supersedes the older assumptions that:

- creation only persists on a final submit
- edit mode is primarily an inline accordion
- editing should dispatch granular command diffs from a final review submit

The current builder is section-staged and backed by authored upsert plus reconciliation semantics.

## Exit Criteria

- `/characters/new[/id]` stays in the create flow until finalization
- `/characters/edit/:id` uses the same builder with edit semantics
- drafts remain visible and resumable
- destructive saves show a preview before persisting
- finalization promotes to `ACTIVE` and returns to the sheet
- the builder no longer depends on final-submit-only wizard assumptions
