# Slice ATTACK-10.T4: sight-governed saving throws

**Status:** IN CI (`ci/attack-10-t4`); nothing merged.

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Closes AC ATTACK-10.5: saving throws follow the D100 believed/true rule.

- **The hidden fact (ruling, 2026-10-16):** the saver's sight of the effect's source, resolved with the D100 inputs. The source is the caster or actor for a targeted save and the area's origin for an area save. The SRD 5.1 contributor is Barbarian Danger Sense: advantage on Dexterity saves "against effects that you can see", lost while Blinded, Deafened or Incapacitated. Author that sight requirement as a generic, sight-gated save-contributor predicate (the saver sees the source) from core authoring options, nothing Danger-Sense-specific, with an author-built parity proof.
- **Believed vs true:** identical to attacks. The believed sight uses only the saver's own facts and the source as it is, on the neutral environment (the saver's Blinded and Senses, the source's own Invisible). The true sight uses the full Scene. The prompt shows the believed mode; the save settles in the true mode with the shared dice-settling rules (`encounterSightGovernedD20.ts`, held die).
- **Reasons:** the player caption is generic and never names a Sense or a hidden actor. The GM sees the specific reason.
- **Unchanged:** viewer projection (an actor hidden from players) stays a D100 never-input, and the "Unseen source" redaction stays viewer redaction.
- **Docs:** add a "Saves (current, ATTACK-10.T4)" bullet to D100 in `phase-08-2-decisions.md` and update `live-sessions.md`.
- **Validation:** red-first. Iterate in CI (`ci/attack-10-t4`); the light lane is memory-starved.

## Log

- 2026-10-16: authored `requiresHolderSeesSource` on the `SAVING_THROW_MODIFIER` domain (value domain, grant schema, node map) and Danger Sense on it; removed `CLASS_BARBARIAN_DANGER_SENSE`. Fold defers holder-state conditions as `deferredRequirements`; flagged grants stay out of Character-wide evidence and scoped rows.
- Encounter reader lists flagged grants per target (`sourceSightSaves`); preparation merges the true contributors into the save row and builds the `SAVE` sight (`roller: 'TARGET'`); area targets carry `attackSight`; a point area uses `readNativeLivePointPerception`.
- Validation is iterated in CI; no local compile or test run was possible (Worker tests resolve package `dist`).

## Red-first checklist

- [x] Fold, reader and merge unit tests (`encounterBasicActions.test.ts`, `dnd5eCombatMath.test.ts`)
- [x] Believed vs true sight for a save and the captions (`encounterAttackBelief.test.ts`)
- [x] Danger Sense authored data (`import.test.ts`)
- [x] Room journey: believed prompt, true settle, captions, redaction (`nativeRoomSourceSightSave.test.ts`)

## Proof table

| Criterion clause | Proof |
| --- | --- |
| The roller's prompt shows only what their Character knows | `nativeRoomSourceSightSave.test.ts` (walled origin: player prompt ADVANTAGE, GM prompt NORMAL); `encounterAttackBelief.test.ts` (believed sight) |
| The save settles in the true mode | `nativeRoomSourceSightSave.test.ts` (two dice entered, NORMAL kept first die, `modeAdjustment`) |
| A player-visible reason never names a hidden fact | `encounterAttackBelief.test.ts` (generic caption); `nativeRoomSourceSightSave.test.ts` (GM reason absent from player prompt and TABLE cards) |
| The GM sees the full reason | `nativeRoomSourceSightSave.test.ts` (`gmReason` "can't see") |
| Authored from core options, parity | `dnd5eCombatMath.test.ts` (homebrew Fighter feature folds like Danger Sense) |

## Deviations and deferrals

Deafened, nested rider saves, Condition- or Rule-scoped flagged grants, and the point-area GM reason's Sense labels are deferred (future-enhancements, Deferred edge cases).

## Proposed ledger edit

Mark ATTACK-10.5 and ATTACK-10.T4 DONE once both workflows are green on the merge.
