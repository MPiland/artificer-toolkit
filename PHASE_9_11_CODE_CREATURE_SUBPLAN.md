# Phase 9.11 - Code: Creature

## Status: Not Started

## Objective

Rebuild creature authoring as a category-driven authoring surface instead of a generic stat-block editor. This tranche must preserve the explicit category flows and keep mount and companion authoring visible rather than burying those concepts inside abstract grouping.

## Prerequisite

- [PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md](PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md)
- [PHASE_8_9_FIGMA_CREATURE_SUBPLAN.md](PHASE_8_9_FIGMA_CREATURE_SUBPLAN.md)

## Surface Set

- creature list route
- creature create route
- creature view or edit route
- locked-master copy flow

## Section Map

Derive sections from `CREATURE_NODE_MAP` and the locked Figma screens:

1. Overview
   - `Name`
   - quote
   - description
   - category
   - creature type
   - alignment
   - tags
2. Core Stats
   - ability scores
   - armor class
   - hit points
   - hit dice
3. Movement and Senses
   - speeds
   - senses
   - passive perception
4. Defenses and Rules
   - vulnerabilities
   - resistances
   - immunities
   - challenge rating
   - XP
5. Actions
   - actions
   - bonus actions
   - reactions
6. Category Profiles
   - legendary profile
   - lair profile
   - mount profile
   - companion profile
   - NPC profile
7. Details and Features
   - ordered details
   - features
   - proficiencies

## Transport and Data Requirements

- `GET /content/creatures`
- `GET /content/creatures/:id`
- `POST /content/creatures`
- explicit `provenance` and `permissions`
- reference data for:
  - creature types
  - alignments
  - challenge ratings
  - size and speed system data

## Implementation Tracks

1. Rebuild the creature list with category filters and locked-master indicators.
2. Render creature authoring through category-aware sections instead of abstract `Stat Block` or `Logistics` tabs.
3. Make mount and companion profile editing explicit and first-class.
4. Use proper textarea treatment for longform and detail-heavy creature fields.
5. Support copy-to-edit for master creature records.

## Stories, Tests, and Playwright

- Storybook:
  - creature list states
  - overview section
  - action row editor
  - mount profile
  - companion profile
  - locked-master creature view
- Vitest:
  - category-specific section visibility
  - nested action updates
  - copy-to-edit behavior
- Playwright:
  - create creature
  - edit creature
  - copy locked-master creature

## Legacy Cleanup

- retire any stale creature-browser assumptions from the provisional UI
- remove creature-specific mutation paths outside the shared adapter

## Exit Criteria

- Creature authoring is category-driven and explicit.
- Mount and companion flows are visible and usable.
- Locked-master copy matches the established domain pattern.
