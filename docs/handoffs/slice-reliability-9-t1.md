# Slice workbook: RELIABILITY-9.T1 (in-progress edits survive server refreshes; sign-out failure is shown)

**Status:** OPEN (started 2026-10-13)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Two user-visible web bugs.

1. **RELIABILITY-9.1, data loss.** Editors seeded from server data reset local state in an effect whenever the server record refreshes, wiping in-progress edits. `EncounterActorCard.tsx:80-86` resets initiative, HP, temp HP, visibility and notes on every `actor` change; `CampaignClockEditor.tsx:42-48` resets day, time, dawn and dusk on every `clock` change. The AC note lists the second pass: `SocialListingFormPage.tsx:81-85`, `CharacterSelectionModal.tsx:28-30`, `CharacterStartingEquipmentChoices.tsx:227`, `ProfileSettingsPage.tsx:68-107` (derivable availability states), `CharacterBuilderAuthoringRuntime.tsx:35-38`, and about 15 more prop-to-state reset effects. Fix: key each editor by its record identity so a new record remounts it; an incoming change to a field the user is editing is surfaced (not silently applied, not silently dropped). Where state is derivable, compute it during render instead.
2. **RELIABILITY-9.6.** `apps/web/src/auth/pages/SignOutPage.tsx:13-31` returns silently on `!result.ok` (the page shows "Signing you out..." forever) and calls `queryClient.clear()` before the cancelled check. On failure, say so and offer a retry; clear cached data only after sign-out succeeds and the page is still mounted.

Read first: the RELIABILITY-9 ledger entry and its notes; PRODUCT.md and DESIGN.md for the surfaced-conflict copy and placement (reuse an existing pattern; escalate only if no pattern fits); React's "You might not need an effect" guidance on keys and derived state.

## Closes

- Task RELIABILITY-9.T1: RELIABILITY-9.1 and RELIABILITY-9.6.

## File scope

The components named above and the other prop-to-state reset effects you find (list every one in the status log), plus their tests under `apps/web`. Out of scope: RELIABILITY-9.2/9.3/9.7/9.8 changes in the same files (later tasks), the VTT stage and action drawer (parallel drawer session), node-map resolution and Builder hit points (RELIABILITY-7 session; do not touch `useAuthoringResolvedModel.ts`, `staticResolvedModel.ts` or `CharacterHitpointProgression.tsx`).

## Red-first checklist

1. Encounter actor card: the user edits HP, the server pushes an unrelated actor change, the edit survives (red today).
2. The same actor card: the server changes the field being edited; the user sees the incoming value surfaced and keeps their edit until they choose.
3. Campaign clock editor: same two cases.
4. A different record (another actor) remounts the editor with that record's values.
5. Each second-pass editor: one regression test per pattern fixed.
6. Sign-out failure shows an error and a retry; retry succeeds and then clears cached data (red today).
7. Sign-out that resolves after unmount clears nothing.

Tests render the real components with the real query layer; fake only the network.

## Status log

- 2026-10-13: workbook written; session started.

## Proposed ledger edits (filled by the slice session)
