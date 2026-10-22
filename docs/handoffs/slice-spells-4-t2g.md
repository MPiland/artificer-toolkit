# Slice SPELLS-4.T2g: reviving a dead creature, with a decaying d20 penalty

Status: **design, awaiting ruling** (Phase 1, no production edits).
Class (D156): new generic option, class B. AC SPELLS-4.1. Size estimate: 5 is low; see "Size".

## Brief

Convert `REVIVIFY`, `RAISE_DEAD`, `RESURRECTION`, `TRUE_RESURRECTION` and `REINCARNATE` from `CLOSED_RULE` kinds to a generic authored option, delete the five kinds, and prove each with an authoring-parity test (SRD effects plus a homebrew variant pass the node map and resolve alike, ADR 0038). No per-spell branch (ADR 0039).

## SRD clauses (resolved state vs. not)

| Spell (level)          | Resolved (needs an option)                                                                                                                                                   | Not resolved by the product (stays description / existing MANUAL_ADJUDICATION)                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revivify (3)           | Returns to life with **1 hit point**.                                                                                                                                        | Died within the last minute; not old age; no restored body parts.                                                                                                                                  |
| Raise Dead (5)         | **1 hit point**; **-4 to attack rolls, saving throws and ability checks**, reduced by 1 per long rest; neutralizes poisons and cures nonmagical diseases held at death.      | Dead 10 days or less; soul willing; not undead; missing vital parts fail the spell; magical diseases and curses return with it.                                                                    |
| Resurrection (7)       | **All hit points**; the same **-4 decaying penalty**; poisons and normal diseases end; restores body parts. Dead a year or more: caster can't cast spells and has disadvantage on d20 tests until a long rest. | Dead a century or less; not old age; not undead; soul free and willing. The caster's own cost is conditional on a duration of death the product does not store; stays description-only (see below). |
| True Resurrection (9)  | **All hit points**; poison, disease and curses end; new body and the space within 10 ft.                                                                                     | Dead 200 years or less; not old age; soul; a new body needs the creature's name and a space choice.                                                                                                |
| Reincarnate (5)        | A new body: race swaps, traits change. **No hit-point value is stated**; the creature "returns to life".                                                                      | d100 race table / GM choice; race and traits change (no product op exists to swap a Character's race mid-play).                                                                                     |

Reincarnate has no hit points or penalty; its only resolved effect is returning to life, and the GM-chosen race swap is a Builder structural change (Builder owns those). Proposal: Reincarnate revives at 1 hit point through the same option, with the race swap and the d100 table as the existing `GM_CHOICE` adjudication (it already is one).

## How death is stored today (verified)

- **Character**: no flag. `deathSaves { successes, failures, stable }`; dead is `failures >= 3` (`packages/schema/src/shared/characterDeathSaves.ts`, D96). `deathSavesAfterHealing` resets only a **non-dead** Character (a dead one "regains nothing"), so `HEAL` is a no-op on the dead. Revival therefore needs a distinct outcome that resets the saves to `NO_DEATH_SAVES`.
- **Creature or custom actor**: `defeated` on the encounter actor (D63). `nextEncounterActorDefeated` sets it at 0 hit points and holds it "until it regains hit points", so `HEAL` already clears it (hit points become above 0).
- Hit points and death saves already flow through the Encounter mechanics fold, its receipt (`characterMechanicsTargetStateDtoSchema` carries `deathSaves` so Undo restores them exactly) and the Sheet reducer. Revival is a new write on that same seam; no new storage.
- **No time of death, cause of death, or soul state is stored.** Eligibility ("within a minute", "10 days", "not old age", "willing soul") cannot be checked by the product; it stays with the GM via the existing `MANUAL_ADJUDICATION` outcomes the five spells already carry. I recommend not adding a time-of-death field (storage for a GM-decided fact; post-launch if wanted).
- **Poison and disease**: Raise Dead / Resurrection / True Resurrection end poisons and diseases held at death. D174 `END_EFFECTS` (m350, `CONDITION` selector shipped; `TAG` follow-up SPELLS-4.T2f3) can end the poisoned condition through the same outcome list. Disease and curse need `TAG`, which T2f3 owns; until it lands they are not done here (report, not special-case).
- **The decaying penalty**: existing grants give `PENALTY` on `ATTACK_ROLL` and `SAVING_THROW_MODIFIER` (flat) but **`ABILITY_CHECK` allows no flat `PENALTY`** (only `ROLL_INFLUENCE`, `ADD_BONUS_DIE`, `MINIMUM_ROLL`; `MODIFIER_KINDS_BY_DOMAIN`). Rest handling today is all-or-nothing: `activeEffectEndsOnRest` deletes the effect (end subscription `REST`, `SCALAR_REDUCTION` recovery, HP-maximum reduction). **Nothing decays by a step per rest.** This is the real new primitive.

## Proposed option (recommended): `REVIVE` outcome + stepped rest decay on an effect

### 1. Schema and node map

New `EFFECT_KIND.REVIVE` outcome (target-only, precondition declared as outcome data, D173 Q1: the target must be dead, else the shared overridable warning `TARGET_NOT_DEAD` at admission):

```
{ effectKind: 'REVIVE',
  hitPoints: { kind: 'FIXED', amount } | { kind: 'MAXIMUM' } }   // 1 for Revivify, MAXIMUM for the rest
```

A single generic new effect-level datum for the penalty, on the existing timed active-effect contribution (not a spell-specific shape): the d20 penalty is **authored as ordinary `PENALTY` grants** (`ATTACK_ROLL`, `SAVING_THROW_MODIFIER`, and, new, `ABILITY_CHECK`) inside the effect's result block, and the effect gains an optional generic **`stepDown: { trigger: 'LONG_REST', step: 1 }`**:

- On each matching rest, every `BONUS`/`PENALTY` grant magnitude in that effect shrinks by `step`; at 0 the effect ends through the existing ended-effect seam (`deleteCas` `ENDED`).
- Stored as a required-nullable `restStepDown` on the compiled definition plus a stored remaining counter on the held effect (`remaining: number | null`); stored plans migrate in the same change, dev data reseeded (D172 precedent).

Node map: `REVIVE` is an outcome row beside `HEAL` and `STABILIZE`; `stepDown` is a lifecycle field beside `duration` on the result block; `PENALTY` is added to `ABILITY_CHECK`'s `MODIFIER_KINDS_BY_DOMAIN` (a data change, valid for any homebrew check penalty).

### 2. Compiler

`REVIVE` registers in `effectActionOperationRegistry` next to `HEAL`/`STABILIZE` (target-only, `TARGET_NOT_DEAD` precondition as registry data). `stepDown` compiles into the definition's `restStepDown`; the `PENALTY` grants compile through the existing grant path. Fails closed on `step < 1`, an amount above the penalty, or a trigger other than a rest.

### 3. Execution seam

- `planEncounterMechanicsBatch` folds `REVIVE` after damage/heal ordering: Character `deathSaves -> NO_DEATH_SAVES`, `currentHitPoints -> amount` (clamped to maximum); Creature/custom `defeated -> false`, hit points set. One new pure function `deathSavesAfterRevive` sits beside `deathSavesAfterHealing` in `characterDeathSaves.ts` (the one home for dying and death rules, so the Sheet reducer, Undo and the fold share it).
- The penalty effect is created as a rider on the same target through the existing rider/active-effect creation path (the D172 `createLinkedRiders`-style shared creation), so a revived target carries it before the next turn.
- `sheetRest.ts` `activeEffectEndsOnRest` gains the step-down case: a rest first steps the effect down and deletes it only when it reaches 0 (one rest preview/confirm already lists ended effects; the preview lists "reduced by 1" lines too).
- Sheet side: the Character's play-state revive is a Master-DM/caster-driven write through the same mechanics batch, not a Sheet-owned action (Sheet owns play-state interaction; the caster's cast is the command).

### 4. Receipts and undo

New generic receipt row kind `REVIVE` with `{ beforeHitPoints, afterHitPoints, beforeDeathSaves, afterDeathSaves, beforeDefeated, afterDefeated }`. Undo and replay restore from the recorded before state (never recomputed), so checksummed ledgers need no rewrite. Penalty-effect creation and rest step-downs use the existing active-effect create/end/update receipt with the new `beforeRemaining`/`afterRemaining` pair (stored receipts migrate; no ledger rewrite needed because no existing receipt carries a step-down).

### 5. Conversions

| Kind                  | Authored as                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REVIVIFY              | `REVIVE { FIXED 1 }` + existing manual eligibility adjudication.                                                                                                             |
| RAISE_DEAD            | `REVIVE { FIXED 1 }` + penalty effect (-4 on attack, save, check; `stepDown LONG_REST 1`) + `END_EFFECTS { CONDITION poisoned }`; disease/curse wait for `TAG` (T2f3).      |
| RESURRECTION          | `REVIVE { MAXIMUM }` + the same penalty effect + `END_EFFECTS` as above. Caster's "dead a year or more" cost stays description-only.                                           |
| TRUE_RESURRECTION     | `REVIVE { MAXIMUM }` + `END_EFFECTS { CONDITION poisoned }`; disease and curse waits for `TAG`. New body / placement within 10 ft stays manual adjudication.                    |
| REINCARNATE           | `REVIVE { FIXED 1 }` + existing `GM_CHOICE` adjudication for the d100 table and race swap (Builder-owned structural change).                                                  |

## Alternatives

**B. Model the penalty as a leveled condition ("revived") like exhaustion.** Reuses the leveled-condition machinery (`encounterConditionLevels`), and "reduce a level per long rest" is closer to an existing option. Rejected as default: only the exhaustion condition has levels today, and levels feed its fixed effects table rather than an authored -N; making it generic means building the same step-down primitive plus a level-to-penalty table. Choose B only if the user wants the penalty visible as a named condition on the Sheet.

**C. N sibling effects with `durationKind` "N long rests".** Four -1 effects ending after 1, 2, 3, 4 long rests. No new decay primitive but needs a new generic duration ("until N long rests"), a counter per effect, and compiles one spell into four effects (fan-out, harder to read on the Sheet and in receipts). Rejected: same new state, worse authoring.

**D. Description-only for the penalty (revive + hit points only).** Smallest (size ~3). Violates D156: the penalty changes d20 tests the product resolves, so it needs authored options. Rejected.

**E. Fold `REVIVE` into `HEAL` with a "revive dead" flag.** Fewer kinds, but overloads `HEAL`'s ordering and its "a dead Character regains nothing" invariant (`deathSavesAfterHealing`), which many writers rely on. Rejected: revival is a different state transition with its own precondition and receipt.

## Stays description-only (D156: changes no resolved state)

Eligibility clauses (time dead, cause of death, undead, soul, body parts); Resurrection's caster cost after a year (conditional on a duration of death the product does not store; adding the time-of-death input is post-launch); Reincarnate's d100 table and race swap; True Resurrection's new-body placement and name.

## Acceptance criteria (proposed, for confirmation)

1. An authored `REVIVE` outcome on a dead Character or defeated Creature restores hit points to the authored amount, clears death saves or `defeated`, warns (overridable) on a living target at admission, and Undo restores the exact before state.
2. An authored stepped-decay penalty applies -N to attack rolls, saving throws and ability checks, drops by 1 on each long rest and ends at 0; an unrelated long-rest effect still ends as today.
3. The five kinds are deleted from `closedRuleKind.ts`; each SRD spell compiles from core options; each has an authoring-parity proof (SRD plus a homebrew variant through the node map and the real compiler).
4. Room journey: a dying-to-dead Character is revived by a cast in the Session Worker room; the penalty is felt on the next d20 test, and a long rest steps it down.
5. Docs: `rules-runtime.md`, ADR 0038 consequences, decisions entry.

## Tests (red first)

- `packages/schema/src/__tests__/characterDeathSaves.test.ts`: `deathSavesAfterRevive`.
- `packages/rules-runtime/src/__tests__/encounterRevive.test.ts`: fold, receipt, Undo, creature `defeated`.
- `packages/rules-runtime/src/__tests__/sheetRestStepDown.test.ts`: step-down and end at 0.
- `packages/authoring/src/nodeRuntime/reviveAuthoringParity.test.ts`: SRD and homebrew variant.
- `apps/session-worker/test/nativeRoomRevive.test.ts`: room journey.

## Golden flips (expected)

Graph checksums of exactly these five SRD authored effects change (`CLOSED_RULE` becomes `REVIVE` plus its penalty and `END_EFFECTS` outcomes): Revivify, Raise Dead, Resurrection, True Resurrection, Reincarnate. Stored definitions gain `restStepDown` (plan shape only, no graph checksum). To be confirmed with the golden harness.

## Size

The brief says 5. By my count it is closer to 8: `REVIVE` (registry, fold, receipt, replay, Undo, Sheet reducer), a new rest-time step-down primitive (schema, compiler, definition migration, `sheetRest` preview/confirm, receipts), the `ABILITY_CHECK` `PENALTY` addition, five conversions with parity proofs and a room journey. Recommend splitting: **T2g1** `REVIVE` + Revivify, Reincarnate, True Resurrection (no penalty), **T2g2** the stepped decay + Raise Dead and Resurrection. T2g2 also depends on T2f3 `TAG` for disease and curse clauses.

## Questions for the ruling

1. Option A (`REVIVE` plus generic `stepDown`) versus B (leveled condition). Recommend A.
2. Split into T2g1 and T2g2 as above?
3. Disease and curse clauses wait for T2f3 `TAG` (not done here, registered), poison via the shipped `CONDITION` selector. Agree?
4. Resurrection's caster cost after a year of death stays description-only; no time-of-death field. Agree?
5. Reincarnate: revive at 1 hit point with the race swap and table kept as `GM_CHOICE` adjudication. Agree?
