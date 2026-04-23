# Phase 8.13 - Figma: Character Sheet

## Status: Designed in Figma / Ready for Phase 9 Planning

## Figma Reference

- [Characters page](https://www.figma.com/design/go78XTRyvTifjh2HsA14qv/App-Design-v2?node-id=4044-182)

## Objective

Design the responsive character sheet as the read and play surface. Structural edits belong in the builder; the sheet is where players read the character, manage play-state, and interact with the most common at-table controls.

## Locked UX Decisions

- The sheet is separate from the structural builder.
- Structural edits happen through `Edit Character`, not inline across the sheet.
- High-frequency play actions stay on the sheet:
  - actions
  - spells
  - inventory
  - resources
  - equip / attune
  - currency
- Dense areas use filters, chips, and progressive disclosure instead of flat long lists.
- Builder-style starting-equipment semantics do not appear on the sheet.

## Screen Set

### Desktop sheet screens

1. `CS1 - Character Sheet Overview`
2. `CS2 - Character Sheet Actions`
3. `CS3 - Character Sheet Resources`
4. `CS4 - Character Sheet Spells`
5. `CS5 - Character Sheet Inventory`
6. `CS6 - Character Sheet Reference`
7. `CS7 - Character Sheet Background & Notes`

### Mobile sheet states

1. `CM1 - Mobile Character Sheet Overview`
2. `CM2 - Mobile Character Sheet Inventory & Spells`

## Surface Contracts

### Overview

- name
- concept / short description
- class and level summary
- race and background summary
- portrait surface
- short rest / long rest entry points
- `Edit Character`
- core stats snapshot

### Actions

- filtered views for:
  - `Actions`
  - `Bonus Actions`
  - `Reactions`
  - `Other`
- weapon attacks
- spell attacks
- action-granting features

### Resources

- limited-use class, race, and feat resources
- recovery context tied to rest cadence
- hit dice as a tracked resource

### Spells

- spell save DC
- spell attack
- prepared / granted / cantrip organization
- slot tracking
- spell filtering
- sheet-side spell management emphasis, not spell browser semantics

### Inventory

- carried gear
- notable possessions
- currency
- add item
- remove item
- equip / unequip
- attune / unattune
- quantity-visible item management

### Reference

- defenses
- traits / features reference
- proficiencies / languages / training

### Background & Notes

- background summary
- alignment
- lifestyle
- backstory
- notes
- personality traits
- ideals
- bonds
- flaws
- allies / enemies
- organizations

## Implementation Guidance

- Use the sheet as the source of truth for play-state interaction surfaces.
- Keep class/build ownership out of the sheet except for summary and navigation back to `Edit Character`.
- Desktop and mobile layouts should preserve the same information architecture even when the presentation condenses.

## Exit Criteria

- The sheet clearly separates play-state interaction from structural editing.
- Actions, spells, inventory, resources, and reference surfaces all exist in Figma.
- Desktop and mobile states both exist for the sheet.
- The sheet no longer depends on earlier builder-summary or inline-edit assumptions.
