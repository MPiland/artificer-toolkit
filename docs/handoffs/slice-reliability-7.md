# Slice workbook: RELIABILITY-7 (the web uses the shared resolver and rules instead of copies)

**Status:** OPEN (started 2026-10-13)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Two copies of product logic live in the web.

1. **RELIABILITY-7.1.** `apps/web/src/forms/node-map/staticResolvedModel.ts` (493 lines) mirrors the server's `nodeRuntimeService.ts`, embeds fixture options (Sorcerer, Wizard, Shortsword, Evocation and more roots than the server registry), and is imported by the production hook `useAuthoringResolvedModel.ts:39-50`. Authoring stories and tests must resolve node maps through the real `packages/authoring` resolver over an in-memory registry; delete the static copy and its fixture options from the production bundle.
2. **RELIABILITY-7.2.** The Builder, class detail and Creature stat blocks compute hit points, hit-die averages, ability modifiers and proficiency bonus locally: `characterAbilities.ts:1-222`, `CharacterHitpointProgression.tsx:81-127`, `ClassDetail.model.ts:94` and `321-331`, `CreatureDetail.model.ts:306`, `EncounterEnemyStatBlock.tsx:80`. Use the shared rules-runtime functions (ADR 0036; the server already uses them in `builderHitPoints.ts:108-146` and `characterVitals.ts:175`). Delete the legacy hit-point override and its "HP gained (legacy)" input, remove the field from the contract, and migrate development data in the same change (the main session resets and reseeds after merge).

Read first: the RELIABILITY-7 ledger entry and notes; ADR 0036; AGENTS.md "Web Folder Organization" (node maps resolve on the backend; only harnesses build forms locally); `packages/authoring` resolver entry points.

## Closes

- RELIABILITY-7.1 and RELIABILITY-7.2 (then RELIABILITY-7 is DONE once the journey is verified).

## File scope

`apps/web/src/forms/node-map/*`, `useAuthoringResolvedModel.ts`, authoring stories and test harnesses that import the static model, the Builder hit-point and ability files named above, `ClassDetail.model.ts`, `CreatureDetail.model.ts`, `EncounterEnemyStatBlock.tsx`, the hit-point override field in `packages/schema` and its Convex reads and writes, and their tests. Out of scope: prop-to-state reset fixes (RELIABILITY-9.T1 session owns `CharacterBuilderAuthoringRuntime.tsx`), the action drawer and VTT stage.

## Red-first checklist

1. An authoring story or test resolves a node map through `packages/authoring` and gets the server's options (red today: the static copy returns its embedded fixtures, for example roots the server registry lacks).
2. A production bundle check (or import-graph test) proves `staticResolvedModel` and its fixtures are absent from production code.
3. Builder, class detail, Creature detail and the Encounter enemy stat block show the same hit points, hit-die average, ability modifiers and proficiency bonus as the server for real SRD content, including one case where the local copy disagrees today (find it; if none disagrees, record why the test would still catch drift).
4. The legacy override is gone from the contract, the UI and stored development data; a Character that had one reads its hit points from the shared rules.

Storybook cannot run in a worktree: list the stories to run after merge in the status log.

## Status log

- 2026-10-13: workbook written; session started.

## Proposed ledger edits (filled by the slice session)
