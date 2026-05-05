# Phase 9.15 - Character Sheet

## Status: Active - Command Hardening Implemented

## Objective

Rebuild the character sheet as the play-state surface, separate from structural editing. This tranche implements the locked desktop and mobile sheet states, consumes the dedicated sheet read model and command endpoints, and avoids turning the sheet into a builder summary page.

## Prerequisite

- [PHASE_9_14_CHARACTER_BUILDER_SUBPLAN.md](PHASE_9_14_CHARACTER_BUILDER_SUBPLAN.md)
- [PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md](PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md)
- [PHASE_8_13_FIGMA_CHARACTER_SHEET_SUBPLAN.md](PHASE_8_13_FIGMA_CHARACTER_SHEET_SUBPLAN.md)

## Screen Set

### Desktop

- `CS1 - Character Sheet Overview`
- `CS2 - Character Sheet Actions`
- `CS3 - Character Sheet Resources`
- `CS4 - Character Sheet Spells`
- `CS5 - Character Sheet Inventory`
- `CS6 - Character Sheet Reference`
- `CS7 - Character Sheet Background & Notes`

### Mobile

- `CM1 - Mobile Character Sheet Overview`
- `CM2 - Mobile Character Sheet Inventory & Spells`

## Transport Requirements

- `GET /characters/:id/sheet`
- `GET /characters/:id/history`
- `POST /characters/:id/commands`

The sheet reads from the dedicated sheet payload and sends play-state commands through backend handlers. Structural editing remains a builder concern.

## Current Hardening Checkpoint

- The placeholder `/characters/:id` page has been replaced by the active sheet route.
- Character sheet commands are handled through a dedicated functions service instead of route-local helpers.
- Commands enforce active-character existence, ownership, expected stream version, transactional persistence, stream-version increments, and history event creation.
- The sheet read model hydrates labels and options for visible sheet surfaces so web UI should not expose raw IDs when labels exist.
- Backend and web focused tests now cover command round trips, concurrency, history creation, stale-version rejection, non-active rejection, command validation, and initial sheet command wiring.
- Storybook now covers the initial sheet review states: overview, draft banner, resources/rest controls, spells, inventory, reference, history, mobile-width overview, empty character, and command-error messaging.

## Locked Decisions

- The sheet is separate from structural editing.
- `Edit Character` routes back to the builder; it is not inline structural editing.
- Actions, spells, resources, inventory, equip or attune, currency, reference, and notes stay on the sheet.
- Dense surfaces should feel manageable through chips, filters, and disclosure, not generic browser tables.

## Implementation Tracks

1. SSR the sheet shell and first sheet payload.
2. Rebuild the overview, actions, resources, spells, inventory, reference, and notes surfaces on the new app shell.
3. Ship desktop and mobile states together instead of leaving mobile as a follow-up.
4. Wire play-state actions through command mutations, not builder or authored-content flows.
5. Keep inventory, equip, attune, spell-slot, and resource interactions task-oriented.

## Stories, Tests, and Playwright

- Storybook:
  - overview panel states
  - actions tabs
  - resource cards
  - spell list states
  - inventory states
  - mobile sheet slices
- Vitest:
  - sheet read-model rendering helpers
  - command-action optimistic or pending state handling
  - inventory and spell filter state
- Playwright:
  - navigate across sheet surfaces
  - use commands on resources and inventory
  - validate desktop and mobile behaviors

## Legacy Cleanup

- remove old builder-summary-style character page assumptions
- remove sheet code that depends on structural-edit ownership
- retire provisional character page surfaces replaced by the new sheet

## Exit Criteria

- The sheet is clearly the play-state surface.
- Desktop and mobile are both shipped.
- Structural editing no longer leaks into the sheet experience.
