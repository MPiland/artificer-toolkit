# Phase 8.11 - Figma: Character Sheet

## Objective

Design the character sheet as a separate read/play surface from the structural builder.

The sheet is not the primary place for structural edits. Structural changes belong in the builder. The sheet remains visible for both `ACTIVE` and `DRAFT` characters.

## Route Semantics

```text
routes/_authed/
  characters/
    $characterId.tsx
```

The sheet should support two states:

- `ACTIVE`
  - normal read/play presentation
  - primary CTA: `Edit Character`
- `DRAFT`
  - still readable
  - prominent warning banner
  - readiness and unresolved-choice summary
  - primary CTA: `Continue Draft`

## UX Contract

The character sheet is separate from the builder:

- structural build edits happen in `/characters/new[/id]` or `/characters/edit/:id`
- the sheet remains the place for reading the build and, later, managing play-state updates
- drafts are not hidden or redirected away from the sheet

## Core Surfaces

1. Header
- character name
- short concept or description
- draft or active badge
- level summary
- readiness badge
- primary CTA based on status

2. Build Summary
- species summary
- background summary
- classes summary
- granted content summary

3. Draft Warning State
- visible only for `DRAFT`
- explains that the build is incomplete
- shows blocking issue count and required outstanding-choice count
- links back to `Continue Draft`

4. Outstanding Choices / Validations
- unresolved builder choices remain visible on the sheet
- blocking validations remain visible on the sheet

5. Later Play-State Surfaces
These belong to the sheet or play phase, not the structural builder:

- inventory management
- currency management
- equipped / attuned state
- HP and resource tracking

Those surfaces may be incomplete in the current implementation, but this is still their ownership boundary.

## What This Replaced

This document supersedes the older assumptions that:

- the sheet is driven only by a separate engine-output route contract
- draft characters should be blocked from the sheet
- inline sheet editing is the primary post-creation edit UX

The current product direction is:

- sheet = read/play surface
- builder = structural edit surface
- drafts remain visible with warnings

## Exit Criteria

- `DRAFT` and `ACTIVE` characters are both readable on the sheet
- draft sheet state shows a clear warning banner and unresolved summary
- primary CTA is `Continue Draft` for drafts and `Edit Character` for active characters
- the sheet no longer assumes inline structural editing as the main edit workflow
