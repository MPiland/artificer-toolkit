# Phase 9.3 - App Shell, Navigation, and List Patterns

## Status: Not Started

## Objective

Build the authenticated app shell and the canonical list-view pattern that will be reused across all domain index pages. The spell list in Figma is the primary pattern reference, but this tranche defines the shared structure for every domain list before any domain-specific form work begins.

## Inputs

- [PHASE_9_2_PUBLIC_AUTH_AND_MARKETING_SUBPLAN.md](PHASE_9_2_PUBLIC_AUTH_AND_MARKETING_SUBPLAN.md)
- Figma authenticated shell and spell list screens
- `apps/web/src/Layout/*`
- `apps/web/src/components/List/*`
- `apps/web/src/domains/spells/Spells.tsx`

## Locked Decisions

- Start with shell, wrappers, and list views before the forms.
- The spell list visual pattern becomes the main list pattern for all content domains.
- Master or seeded records are visible in lists, locked from direct edit, and copyable.
- Do not assume virtualization unless a concrete performance need appears after the new list pattern exists.

## Scope

- Authenticated shell:
  - desktop nav
  - mobile nav
  - app header
  - user menu
  - page headers
  - footer action bar pattern
- Canonical list pattern for all domain indexes:
  - search
  - filters
  - sort
  - empty states
  - loading states
  - error states
  - list item actions
- Locked-master list behavior:
  - visual provenance badge
  - view allowed
  - edit disabled
  - copy enabled

## Deliverables

- Reusable authenticated shell components.
- A single list-page composition model reused by spells, backgrounds, feats, races, equipment, creatures, vehicles, classes, characters, features, and systems.
- Storybook states for:
  - page header
  - filter bar
  - empty/loading/error states
  - list item card or row
  - locked-master row
  - owned row

## Implementation Plan

1. Rebuild the authenticated shell around the locked Figma navigation and page structure.
2. Replace the old navbar/header utilities with a reusable app-shell layer.
3. Define the canonical list layout from the spells list screen and extract it into shared list primitives.
4. Add list-state affordances for owned, locked-master, empty, loading, and error rows.
5. Build shared list interactions so every domain index can compose them instead of forking list behavior.
6. Add Storybook coverage for the full list-state matrix.
7. Add Playwright coverage for shell navigation and a representative list interaction flow.

## Review Gate

- Authenticated shell is ready for domain rollout.
- Shared list pattern is visually and behaviorally approved before domain-specific index pages are built.
- Playwright verifies at least one authenticated navigation flow and one list interaction flow.
- Storybook demonstrates the approved list state matrix.

## Exit Criteria

- The app has a production-grade authenticated shell.
- There is one approved list pattern for all domains.
- Later domain subplans can focus on domain behavior instead of re-inventing shells and indexes.
