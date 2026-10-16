# Workbook: ATTACK-9.T2 Sneak Attack (AC ATTACK-9.2)

**Status:** blocked on architect approval of the shapes below (2026-10-15). No code written.
**Base:** `912f2780d` (phase branch `codex/phase-08-2-convex-cutover` merged into `claude/attack-9-t7`).

## Brief

AC ATTACK-9.2: Sneak Attack adds its level-scaled dice once per turn to a hit with a finesse or ranged weapon when the attack has advantage, or an enemy of the target is within 5 feet of it and the attacker has no disadvantage; critical hits double the dice. Authored only from core authoring options (no `CLOSED_RULE`, no feature-specific kind or executor); an author-built equivalent made through the real authoring form publishes to the same structure and resolves identically.

Today the SRD Rogue authors two inert `CLASS_ROGUE_SNEAK_ATTACK` closed rules (`packages/source-data/src/srd/classes/rogue.ts` ~496-533). D58 requires extra-dice riders to become `ON_HIT` damage doubled by the existing critical code.

## Findings (read-only survey, 2026-10-15)

Only three parts of the rule exist today: the finesse/ranged weapon gate (for modifier grants only), the Rogue `CLASS_LEVEL` gate (Rage precedent), and critical doubling of any `ON_HIT` damage entry inside an action's own compiled effect (`effectActionCompiler.ts` ~3650-3700, 31-dice cap; 10d6 doubled is 20).

| Gap | Evidence | Needs |
| --- | --- | --- |
| a. A Feature's PASSIVE `ON_HIT` dice cannot join a weapon attack | `characterActionRuleFacts.ts:314` skips PASSIVE effects; extra damage is numeric modifiers on the first outcome only (`characterActionMechanics.ts:316-319`); `ADD_BONUS_DIE` is schema-rejected (`schema/src/grants/modifier.ts:760-818`) | New shape |
| b. Dice count cannot scale by class level | `validateDiceOutcomeRow` rejects `CLASS_LEVEL` (`effectActionCompiler.ts:2108-2124`); no code binds `characterLevel`/`parentClassLevel`/class-level facts | New shape |
| c. No "the weapon's damage type" | `damageTypeId` is a required uuid (`authored/damage.ts:117-124`) | New shape |
| d. Roll mode not visible to outcome selection | `d20RollMode` is returned beside, not inside, the bound facts (`effectActionCompiler.ts:6804-6866`); no predicate | New shape |
| e. No "enemy of the target within N feet" | no distance/adjacency predicate; `positionalFacts` has no production supplier (`encounterActionMechanicsPreparation.ts:415-476`) | New shape and wiring |
| f. No once-per-turn limit or per-turn record | no TURN charge reset; the nearest keyed-by-turn row is `encounterTurnMovements` (D38) | New persisted record |

ATTACK-9.T6 (Rage early end) reads a per-turn attack/damage record that (f) is meant to build.

## Proposed shapes (recommendation, for architect approval)

1. **Attach (a):** merge the `ON_HIT` `DAMAGE` outcomes of a Character's PASSIVE Feature effects whose trigger matches the attack (`MELEE_WEAPON_ATTACK` / `RANGED_WEAPON_ATTACK`) into the weapon action's compiled outcome, so resistance, multi-part damage and critical doubling apply with no new code path. Reject making `ADD_BONUS_DIE` executable instead: it would need a damage type, scaling and conditions added to a numeric-modifier payload, duplicating the effect vocabulary.
2. **Class-level dice (b):** accept `CLASS_LEVEL` in `validateDiceOutcomeRow` and bind the Character's class levels as facts (and fix the `scalingLevel` ordering at `effectActionCompiler.ts:3598`).
3. **Weapon damage type (c):** a damage-type choice `TRIGGERING_WEAPON` beside the literal uuid.
4. **Roll-mode condition (d):** a predicate on the attack's net roll mode (`ADVANTAGE`; `NOT_DISADVANTAGE`) evaluated where the outcome is selected.
5. **Positional condition (e):** a predicate "a hostile of the target, able to act, is within N feet of the target", fed by scene positions the room supplies at plan time and persistence re-verifies, as for movement.
6. **Once per turn (f):** an effect option `usage: ONCE_PER_TURN` backed by one per-turn record keyed `(encounterId, round, turnActorId, actorId)` that also holds T6's "attacked a hostile" and "took damage" flags, resetting with every turn change (any creature's turn).

## Proposed split (the ledger sizes T2 at 3; this is larger)

- **T2a:** shapes 1-3 (attach, class-level dice, weapon type) with an unconditional Rogue rider proved end to end, doubled on a critical.
- **T2b:** shape 4 (roll-mode predicate).
- **T2c:** shape 5 (positional predicate and wiring).
- **T2d:** shape 6 (per-turn record and once-per-turn); T6 then consumes the same record.
- AC ATTACK-9.2 closes after T2a-T2d with an Encounter journey and the authored-parity proof (real form, node-runtime resolver, form adapter, as for Rage).

## Status log

- 2026-10-15: survey done; no code. Waiting on the architect's ruling on shapes 1-6 and the split.
