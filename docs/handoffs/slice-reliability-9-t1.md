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
- 2026-10-13: shared pattern added at `apps/web/src/components/ServerDraft/` (`useServerDraft`, `ServerDraftConflicts`). An editor keeps per-field `{value, seen}` edits over the server snapshot; an edit is pruned when it equals the server value; an edited field whose server value moved away from `seen` is a conflict, shown as a yellow alert with "Use latest" (drop the edit) and "Keep mine" (re-baseline `seen`). Nothing is applied or dropped silently. No effects.
- 2026-10-13: **Reset-effect audit** (every prop/server-to-state reset effect found):

  | Site | Disposition |
  | --- | --- |
  | `EncounterActorCard.tsx` (reset on `actor`) | Fixed: `useServerDraft`; outer component keys the editor by `actor.id`. |
  | `CampaignClockEditor.tsx` (reset on `clock`) | Fixed: `useServerDraft`; `CampaignClockControl` keys the editor by `campaign.id`. |
  | `CampaignSessionSchedulePanel.tsx` (reset on `session`) | Fixed: `useServerDraft`; `CampaignSessionPrepareView` keys the panel by `session.id`. |
  | `CharacterSheetTextEditor.tsx` (reset on `editor.value`) | Fixed: `useServerDraft`; editors were keyed only by `editor.field`, so `CharacterSheetInspectorContent` is now keyed by the selected target (an unsaved edit can no longer leak to another item or spell). |
  | `SocialListingFormPage.tsx` (seed effect) | Fixed: render-phase seed; outer component already keyed by `listingPublicId ?? 'new'`. |
  | `CharacterSelectionModal.tsx` (query reset on `opened`) | Fixed: query state lives in a content component that Mantine mounts only while open. |
  | `CharacterStartingEquipmentChoices.tsx` gold field (`setGoldInput` effect) | Fixed: render-phase re-seed when `totalGold` changes (an emptied input stays empty until a roll sets it, as before). |
  | `ProfileSettingsPage.tsx` (availability/error effect) | Fixed: `available`, `not_allowed`, `checking` and check errors are derived during render; only the 300 ms debounced `getUsernameStatus` call remains an effect, writing the async result. |
  | `CharacterBuilderAuthoringRuntime.tsx` (`setDraftOpenFailed(false)` in effect) | Fixed: failure is keyed to the attempt number (`failedAttempt === openAttempt`). |
  | `SignOutPage.tsx` (9.6) | Fixed: failure state with retry; cache cleared only after success while mounted. |
  | `CampaignNotebook`, `CampaignSessionNotes`, `CampaignSceneEditor` | Reviewed, left alone: edits are dirty-guarded (a refresh never overwrites a dirty draft). |
  | `CharacterSheetView.tsx` `initialTab` effect | Reviewed, left alone: resets a view tab, no user data. |
  | `CampaignInventory.tsx` owner-to-asset reset | Reviewed, left alone: intentional dependent-selection logic, no data. |
  | `CharacterSheetOverviewVitals` overlay epoch | Deferred: not located under this scope; not reviewed. Re-check in RELIABILITY-9.T2. |
  | VTT drawer/stage, forms layout reset effects | Deferred: out of scope (9.3 / parallel drawer session). |

## Deviations and notes

- Red-first: items 1 and 3 (survive-unrelated-change/surfaced-conflict), 6 and 7 (sign-out) and the text-editor conflict case have red logs (`local-validation/reliability-9-t1/red-all.log`, `red-run1-signout.log`). Item 4 (actor remount), the SelectionModal reset, the gold field, the Profile availability states, the BuilderAuthoringRuntime retry and the SocialListing seed are characterization tests of behavior that was already correct (the old effects reproduced it); they pass before and after, so no red exists for them. The structural change (effect removal) is the fix; the tests pin the behavior.
- The worktree needed `yarn install --immutable` and built package dists (schema, shared, rules-runtime, encounter-persistence, design-system) before tests could load (`build-packages.log`, `install.log`).
- Also built in the worktree: `source-data` (`build-source-data.log`), which `CharacterSheetSpells.test.tsx` imports through its fixtures.
- Two test-side defects in my new tests surfaced in the first green run and were fixed without touching assertions: the `SignOutPage` router mock returned a new `router` object per render (the real router is stable, and a fresh object re-ran the effect), and `user.clear` on a Mantine `NumberInput` falls back to 1, so the clock test sets the field with `fireEvent.change`.
- Validation: all 17 touched and dependent test files green, 120 tests (`green-all2.log`; first attempt `green-all.log` showed the three defects above).
- Typecheck: `yarn turbo:typecheck:web` green (`typecheck.log`, typecheck:app and typecheck:tests). The first run failed with `TS2305 convertSceneDistance` in `CampaignScenePreparation.tsx`: the worktree's built `packages/shared` dist predated the base merge. `yarn workspace @artificer-toolkit/shared build` (`build-shared2.log`) fixed it; no slice code was involved.
- Storybook cannot start in a worktree. Not run: any story for `EncounterActorCard`, the Campaign clock editor, `CharacterSheetTextEditor`/Inspector, `CharacterSelectionModal`, `CharacterStartingEquipmentChoices`, `SocialListingFormPage`, `ProfileSettingsPage`. Run them in the final-source pass.

## Review round (2026-10-13)

Fixes for the main session's review, red first (`review-red.log`: 5 failed / 7 passed with the fixes reverted):

1. **False conflict on own save.** `useServerDraft` gains `markCommitted(key)`: an edit marked committed is never a conflict and stays on screen until the server's next value replaces it, so a stored value that differs from the edit (`CharacterSheetTextEditor` trims) shows the stored value with no notice and no flash of the pre-edit value. `CharacterSheetTextEditor` marks it before awaiting the save because Convex can deliver the stored value before the mutation promise resolves (test "stored value arrives before the save resolves"). `EncounterActorCard` and the clock editor were checked: they store HP/temp/notes/time as given (no normalization), and their commits are fire-and-forget, so they have no exposure and are unchanged.
2. Single-use `EncounterActorCard` wrapper deleted; the editor is `EncounterActorCard` again, callers key it by `actor.id`; the "different actor remounts" test goes through the real call path.
3. `CharacterSheetTextEditor` clears the "server value was restored" error on edit. The double-submit test (one mutation while pending) passed before the change: it is a characterization test, not a fix.
4. `CharacterSheetInspector` no longer uses `key={JSON.stringify(target)}`. The identity key sits at the three text-editor sites instead (`itemInstanceId`, spell id + source kind + source instance, companion/vehicle instance id, each plus `editor.field`), since the draft state lives in the editor and the panel content otherwise has no draft state to reset.
5. `useServerDraft` casts removed (`editedKeysOf`/`keepEdits` helpers with a type guard).
6. `SignOutPage` keeps the `AuthResult` and renders its `message`; fallback copy dropped.
7. `ServerDraftConflicts`: empty value reads "was cleared", long text is truncated at 60 characters. **Deviation:** no "turned on/off" boolean wording. A boolean field only has two values, so a conflicting server value (different from `seen`) always equals the user's edit and is pruned before a conflict can be shown; the branch would be dead code.

Assertion-audit round (items 8-14):

8. `CampaignSessionSchedulePanel`: the mis-aimed `title` test is replaced by edit Starts + server changes `scheduledEndAt` (Starts kept, Ends updated, no notice). It fails on base by construction (the old effect reset every field); not run against base.
9. Remount-key tests through the real parents: `CampaignClockControl.test.tsx` (new, switches `campaign`), `CampaignSessionPrepareView.test.tsx` (new, switches `session`; unrelated sibling sections mocked), and Spell-source and Companion switches in `CharacterSheetInspector.test.tsx` (the Item switch already existed in `CharacterSheetItemPanel.test.tsx`). Item 4 moved the identity key to the three text-editor sites, so those are the keyed parents. Red: with the keys removed these four fail (`review2-red.log`).
10. `CharacterSheetTextEditor.test.tsx`: commit-success (one save with the typed value, no error) and commit-failure (server value restored, error shown) added.
11. `SocialListingFormPage.test.tsx`: same-id refetch with new listing data while typing keeps the typing (mock query now refetches every 20 ms). Characterization: the seed only runs on id change, so there is no red.
12. `CampaignClockEditor.component.test.tsx`: "Keep mine" keeps the edit and clears the notice.
13. `SignOutPage.test.tsx`: the after-unmount test awaits the very promise the page awaited (its continuation has then run) instead of one `Promise.resolve()`.
14. `ProfileSettingsPage`: base also showed no format message while typing (and left a stale "taken" notice after a taken result), so it is not a regression from this slice, but Save was disabled with no reason. The format message now shows inline (`usernameFormatError`, shared with the submit path); the new test fails without it (`review2-red.log`).

Validation: red `review2-red.log` (5 failed / 45 passed with the fix and keys reverted, restored afterwards); green `review2-green.log` 19 files / 133 tests; `yarn turbo:typecheck:web` green (`typecheck.log`). One lock batch. The base was already merged (no new commits).

## Proposed ledger edits (filled by the slice session)

- RELIABILITY-9.T1: mark done. Closes RELIABILITY-9.1 (in-progress edits survive refresh; conflicts surfaced via `ServerDraftConflicts`) and RELIABILITY-9.6 (sign-out failure and retry).
- Add a follow-up under RELIABILITY-9: verify the `CharacterSheetOverviewVitals` overlay-epoch effect and run the Storybook stories listed above.
