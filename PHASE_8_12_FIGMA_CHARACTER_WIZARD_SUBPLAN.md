# Phase 8.12 - Figma: Character Builder

## Status: Designed in Figma / Ready for Phase 9 Planning

## Figma Reference

- [Characters page](https://www.figma.com/design/go78XTRyvTifjh2HsA14qv/App-Design-v2?node-id=4044-182)

## Objective

Design the shared character builder for both creation and post-creation structural edits. The builder is modern, source-local, 2014-correct, and separate from the play-state sheet.

## Locked UX Decisions

- Use `Race`, never `Species`.
- Keep source-local choices on the screen that grants them.
- Do not use a standalone `Selections` screen.
- Do not use persistent builder `Status` or `Edit Rules` panels.
- Keep invalid multiclass class options visible but disabled before selection.
- Use expandable class cards with contextual `Overview`, `Features`, and conditional `Spells`.
- Keep review screens minimal and concrete.
- Keep edit save preview as a plain-language consequence modal.

## Screen Set

### Creation flow

1. `CC1 - Character Basics`
2. `CC2 - Character Race`
3. `CC3 - Character Classes`
4. `CC4 - Character Background`
5. `CC5 - Character Details`
6. `CC6 - Character Personality & Notes`
7. `CC7 - Character Abilities & Hit Points`
8. `CC8 - Character Equipment & Currency`
9. `CC9 - Character Review`

### Structural edit flow

1. `EC1 - Edit Character Basics`
2. `EC2 - Edit Character Race`
3. `EC3 - Edit Character Classes`
4. `EC4 - Edit Character Background`
5. `EC5 - Edit Character Details`
6. `EC6 - Edit Character Personality & Notes`
7. `EC7 - Edit Character Abilities & Hit Points`
8. `EC8 - Edit Character Equipment Choices`
9. `EC9 - Edit Character Review`
10. `EC10 - Edit Save Preview`

## Screen Contracts

### Basics

- `Name`
- concept `Description`
- `Advancement Method`

### Race

- `Race`
- conditional `Subrace`
- inline ancestry choices
- read-only granted and inherited summary

### Classes

- prominent add-class chooser
- invalid multiclass options shown but disabled with prerequisite helper copy
- selected classes rendered as expandable cards
- each class card shows class identity, level, subclass, specialization, and remove action
- each class card supports:
  - `Overview`
  - `Features`
  - `Spells` when the class can cast at the chosen level

### Background

- `Background`
- background-owned choices stay on this screen
- granted summary stays on this screen

### Details

- alignment
- lifestyle
- faith
- gender
- age
- eyes / hair / skin / height / weight
- physical characteristics

### Personality & Notes

- personality traits
- ideals
- bonds
- flaws
- organizations
- allies
- enemies
- backstory
- notes

### Abilities & Hit Points

- ability generation method
- method-specific assignment UI
- roll provenance summary
- HP method
- per-level HP entries for higher-level starts

### Equipment & Currency

- class starting-equipment choices
- background starting-equipment choices
- manual inventory seed rows
- manual currency seed rows

### Review

- concrete missing items only
- no abstract readiness dashboard
- no global choice-cleanup surface
- finalize / save action

### Edit Save Preview

- removed downstream choices
- cleared starting-equipment intent
- next-step guidance in plain language

## Ownership Split

- Structural build choices belong in the builder.
- Play-state interactions belong on the character sheet.
- The builder is the place for class, race, background, HP intent, equipment intent, and profile edits.
- The sheet is the place for inventory management, spell use, attunement, equipped state, and resource tracking.

## Exit Criteria

- No user-facing `Species` wording remains.
- No standalone `Selections` screen remains.
- Class choices, feature picks, and spell picks are handled in source context.
- Review screens show concrete completion issues instead of generic status panels.
- The builder can be implemented without reintroducing older wizard-era assumptions.
