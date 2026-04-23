# Phase 9: Frontend Code — All Domains

## Status: Not Started (blocked on Phase 8 Figma approval per domain)

## Objective

Implement all frontend screens as React components using the approved Figma designs from Phase 8 as the reference.

## Deliverable

Working React components wired to the REST API. No Figma work happens in this phase.

## Prerequisite

Per domain: the corresponding Phase 8 Figma subplan must be approved before coding begins. Coding can start domain-by-domain as approvals land.

## Rule

Per-domain code subplans (9.3 onward) are written just before coding begins for that domain — not all upfront.

---

## Domain Subplans

| # | Domain | Figma reference | Code subplan | Status |
|---|---|---|---|---|
| 9.1 | Foundation & design system | PHASE_8_1_FIGMA_FOUNDATION_SUBPLAN.md | PHASE_9_1_CODE_FOUNDATION_SUBPLAN.md | Not started |
| 9.2 | Spell | PHASE_8_2_FIGMA_SPELL_SUBPLAN.md | [PHASE_9_2_CODE_SPELL_SUBPLAN.md](PHASE_9_2_CODE_SPELL_SUBPLAN.md) | Not started |
| 9.3 | Background | PHASE_8_3_FIGMA_BACKGROUND_SUBPLAN.md | PHASE_9_3_CODE_BACKGROUND_SUBPLAN.md | Not started |
| 9.4 | Feat | PHASE_8_4_FIGMA_FEAT_SUBPLAN.md | PHASE_9_4_CODE_FEAT_SUBPLAN.md | Not started |
| 9.5 | Features (standalone) | PHASE_8_5_FIGMA_FEATURES_SUBPLAN.md | PHASE_9_5_CODE_FEATURES_SUBPLAN.md | Not started |
| 9.6 | Race | PHASE_8_6_FIGMA_RACE_SUBPLAN.md | PHASE_9_6_CODE_RACE_SUBPLAN.md | Not started |
| 9.7 | Equipment | PHASE_8_7_FIGMA_EQUIPMENT_SUBPLAN.md | PHASE_9_7_CODE_EQUIPMENT_SUBPLAN.md | Not started |
| 9.8 | Creature | PHASE_8_8_FIGMA_CREATURE_SUBPLAN.md | PHASE_9_8_CODE_CREATURE_SUBPLAN.md | Not started |
| 9.9 | Vehicle | PHASE_8_9_FIGMA_VEHICLE_SUBPLAN.md | PHASE_9_9_CODE_VEHICLE_SUBPLAN.md | Not started |
| 9.10 | Class | PHASE_8_10_FIGMA_CLASS_SUBPLAN.md | PHASE_9_10_CODE_CLASS_SUBPLAN.md | Not started |
| 9.11 | Character Wizard | PHASE_8_11_FIGMA_CHARACTER_WIZARD_SUBPLAN.md | PHASE_9_11_CODE_CHARACTER_WIZARD_SUBPLAN.md | Not started |
| 9.12 | Character Sheet | PHASE_8_12_FIGMA_CHARACTER_SHEET_SUBPLAN.md | PHASE_9_12_CODE_CHARACTER_SHEET_SUBPLAN.md | Not started |

---

## Stack

- React 19, TanStack Router, TanStack Query
- Mantine UI, Vanilla Extract CSS
- Zustand form store (`useTypedFormStore`, `useFormField`, `useFieldUpdates`)
- REST transport via `apps/web/src/lib/api.ts`
- Zod schemas from `packages/schema`

## Rules

- Do not write Figma work here — that is Phase 8
- Do not modify domain models, DB schema, or API routes unless a blocker is found (log it, don't silently fix it)
- Every screen implemented must have a corresponding approved Figma frame
