# Phase 9.6 - Code: Spell

## Status: Not Started

## Objective

Rebuild the spell surfaces as the first authored-domain implementation on the new shell, transport, and shared form runtime. Spell is the proving ground for the canonical list pattern, the shared authored-form runtime, and the effect-editor behaviors that later domains reuse.

## Prerequisite

- [PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md](PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md)
- [PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md](PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md)
- [PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md](PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md)
- [PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md](PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md)
- [PHASE_8_3_FIGMA_SPELL_SUBPLAN.md](PHASE_8_3_FIGMA_SPELL_SUBPLAN.md)
- [PHASE_8_1_FIGMA_EFFECT_EDITOR_FLOW.md](PHASE_8_1_FIGMA_EFFECT_EDITOR_FLOW.md)

## Surface Set

- spell list route
- spell create route
- spell view or edit route
- locked-master copy flow
- effect editor surface within spell authoring

## Section Map

Derive sections from `SPELL_NODE_MAP` and the locked Figma screens:

1. Basics
   - `Name`
   - description
   - level
   - magic school
   - classes
2. Casting & Traits
   - casting time
   - attributes
   - components
   - conditional material description
3. Effects
   - effects summary list
   - effect add/edit/remove
   - full effect editor

## Transport and Data Requirements

- `GET /content/spells`
- `GET /content/spells/:id`
- `POST /content/spells`
- explicit `provenance` and `permissions` on list and detail responses
- reference data for:
  - magic schools
  - classes
  - spell attributes
  - components
  - effect-editor reference inputs from system data

## Implementation Tracks

1. Rebuild the spell list on the shared list pattern, including locked-master copy behavior.
2. Render the sectioned spell form from the shared runtime instead of the old spell-specific step store.
3. Rebuild the effects surface so summary cards and the full effect editor match the approved design direction.
4. Keep save, load, edit, and copy flows entirely on the shared REST adapter.
5. Ensure SSR renders the shell and initial spell payload while heavy effect editing hydrates client-side.

## Stories, Tests, and Playwright

- Storybook:
  - spell list states
  - spell list row owned vs locked-master
  - basics section
  - casting and traits section
  - effect summary card
  - representative effect editor states
- Vitest:
  - spell field rendering
  - conditional material description logic
  - effect-summary serialization and draft updates
- Playwright:
  - list load and filtering
  - create spell
  - edit owned spell
  - copy locked master spell into owned draft

## Legacy Cleanup

- retire the old spell form step implementation
- retire spell mutations routed through legacy web-side server functions
- retire the superseded assumptions in the archival `PHASE_9_3_CODE_SPELL_SUBPLAN.md`

## Exit Criteria

- Spell list and form run on the shared shell, data runtime, and form runtime.
- Locked-master spell copy works end to end.
- The effect editor is stable enough to serve as the reusable pattern for later domains that author similar effect structures.
