# Slice workbook: ATTACK-9.T1 (a Barbarian rages in an Encounter)

**Status:** OPEN (started 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

ATTACK-9 is split into one task per class feature (T1 Rage, T2 Sneak Attack, T3 Second Wind and Action Surge, T4 Divine Smite, T5 two-weapon fighting). They run in this one session in that order because they all touch the dnd5e effect compiler. This workbook covers T1 only. The main session writes the next workbook when T1 merges.

Today Rage is inert:

- The SRD data is in `packages/source-data/src/srd/classes/barbarian.ts`. The `rageCharge` pool is at about line 151 (LONG_REST, scales with level). The feature is at about lines 449-464, via `selfClassRuleEffect`: ACTION, `BONUS_ACTION`, `resourceUse` cost 1.
- Its outcome is `CLOSED_RULE` `CLASS_BARBARIAN_RAGE`, written by `closedRuleEffect` in `packages/source-data/src/srd/closed-rule-effect.ts`.
- `supported()` in `packages/rules-runtime/src/systems/dnd5e/effectActionCompiler.ts` (about line 2153) rejects that outcome. `compileCharacterActionEntryPoints` (`encounterActionEntryPointCompiler.ts` about line 222) then marks the entry MANUAL, and `actionChoiceReads.ts` offers COMPILED entries only.
- No Rage Damage table is authored.

Make Rage real SRD 5.1 data that the existing mechanisms execute. Do not add a Barbarian-specific executor.

- **Activation and cost:** a bonus action that spends one `rageCharge` through the existing compiled resource binding and native spend (`compiledResourceBinding`, `prepareNativeCharacterActionState`). Second Wind uses the same path.
- **Effect:** a timed self grant, following the Help/Dodge `APPLY_GRANT` / `modifierGrantPlan` pattern (D106). It lasts 1 minute and carries:
  - the Rage damage bonus on melee weapon attacks that use Strength: +2 at levels 1-8, +3 at 9-15, +4 at 16+. Author it as a class-level-scaled value with the existing scaling shapes;
  - resistance to bludgeoning, piercing and slashing;
  - advantage on Strength checks and Strength saving throws.
- **While raging:** the Barbarian cannot cast spells. Rage ends any Concentration the Barbarian has, and they cannot start new Concentration. Use the existing Concentration and casting refusal seams, and refuse with a domain rejection.
- **End conditions:**
  - the duration runs out;
  - the player ends it (bonus action, or free if the existing ending-a-grant seam has no action cost);
  - the Barbarian is incapacitated.
  - SRD 5.1 also ends Rage early if the Barbarian neither attacked a hostile creature nor took damage since their last turn. Implement this if the Encounter already records attacks and damage per turn in a form the turn-start seam can read. If it does not, stop and report rather than adding a new tracker. The main session decides.
- **Undo:** GM undo restores the charge and removes the grant, through the existing receipts.
- **The `CLOSED_RULE`:** remove `CLASS_BARBARIAN_RAGE` from the closed-rule list if nothing else uses it.

Escalate only if:

- a needed mechanism does not exist and would need a new effect kind, outcome kind or persisted shape; or
- the decisions file contradicts the SRD text above.

Read first:

- D58, D93, D106 and D107 in `docs/handoffs/phase-08-2-decisions.md`.
- `docs/handoffs/rul-9-rules-audit.md` slice 7.
- `barbarian.ts`, `closed-rule-effect.ts`, `mechanics.ts` (the grant helpers).
- In `effectActionCompiler.ts`: `supported()`, `modifierGrantPlan`, `compiledResourceBinding`.
- `encounterActionEntryPointCompiler.ts`, `characterNativeActionResources.ts`, `characterDefenses.ts`.
- The Help/Dodge grant tests.

## Closes

- AC ATTACK-9.1 (task ATTACK-9.T1).

## File scope

- `packages/source-data/src/srd/classes/barbarian.ts` and the closed-rule list. Regenerate the SRD manifest.
- `packages/rules-runtime` (compiler, grant, defenses, roll-mode and casting/Concentration seams).
- `packages/encounter-persistence` if the choice read needs it.
- `apps/session-worker` only where the native action path needs it.
- Tests next to each.

No web change is expected: the action is offered through the existing Encounter choices. If the Sheet or the choices UI needs a label, keep it inside the existing component.

## Red-first checklist

1. Compiler: the Rage entry compiles to COMPILED with a bonus-action activation and a `rageCharge` binding. It fails on base, which gives MANUAL.
2. Grant rules: while raging,
   - a level-9 Barbarian's Strength melee weapon hit adds +3;
   - a Dexterity or ranged weapon attack adds nothing;
   - bludgeoning damage is halved;
   - a Strength saving throw rolls with advantage.
3. Lock: a raging Barbarian is refused a spell. Raging while concentrating ends the Concentration.
4. End: the grant expires after 10 rounds, ends on the player's end-Rage action, and ends when the Barbarian becomes incapacitated. Add the early-end rule if implemented (see the Brief).
5. Undo: GM undo of the Rage action restores the charge and removes the grant.
6. Journey: a Worker or Convex Encounter journey through real code. The Barbarian rages, hits with a greataxe and takes slashing damage; the damage dealt and taken reflect Rage, and the charge count drops by one.
7. Authored-parity journey: an author builds a homebrew "Rage" through the real FormRenderer, node-runtime resolver and publication path. The published effect structurally equals the SRD Rage effect (ignoring ids and copy), and the Encounter behaves the same (damage, resistance, lock, end, holder-end).
8. Holder-end (3a): the holder ends their own Rage on their own turn, spending the bonus action; refused off-turn; refused when the bonus action is already spent; another player refused.

## Proposed D113 (additive generic shapes for Rage; main session adopts at merge)

Follows D95 and D106. None of these shapes is named for Rage.

1. **Attack ability.** Resolving an attack records the ability it used (finesse records the chosen one, STR or DEX) on the ability-modifier contribution, and the action mechanic puts it on the attacking item. A new facet predicate `ATTACK_ABILITY` gates modifier applicability on it. No attack ability fails closed.
2. **Level steps.** Modifier payload value kinds are linear only (no level table), so a stepped bonus is authored as several FIXED bonuses each gated by `CLASS_LEVEL` facets.
3. **Grant end events.** New `endOnEvents` value `ON_INCAPACITATED`, ended at the D95 detection point (`encounterConcentrationEndReason`), the same point that ends Concentration. No second detector.
   - The commit carries the grants it ended as `endedGrants`. Persistence re-derives the reason from the committed state and refuses a forged end. The ended grants join the root's `consumedGrants`, so GM undo restores them.
   - Known gap: a movement-pass hit (opportunity attack or hazard) that incapacitates a raging mover does not end the grant; the action and turn commits do.
3a. **Holder-end option (requirement B).** A grant's lifecycle carries an optional `holderEnd: { activation }` using the existing activation codes (SRD Rage: `BONUS_ACTION`). It replaces the earlier `ON_HOLDER_CHOICE` event.
   - Only a grant that carries it may be ended by its holder's controller; every other effect stays Campaign-owner-only (D99), and the GM can still end any effect. D99 is otherwise unchanged, including no GM undo of an ended grant.
   - In an Encounter a non-free cost is available only on the holder's turn and spends that slot. A new stored run command kind `END_HELD_GRANT` (a Run command, like Escape) carries it: `admitCurrentActorCommand` makes it holder-turn-only, the planner evaluates and consumes the economy, persistence re-reads the grant's own `holderEnd`, deletes the grant and records the command.
   - The holder's Encounter action choices list it (`heldGrantEnds`), and the tabletop drawer renders an "Active effects" list. Outside an Encounter the Sheet `END_ACTIVE_EFFECT` command accepts the holder-end grant; inside one, a costed holder-end is refused there and must go through `END_HELD_GRANT`.
   - **Premise change:** the `sheetCommandReducer.test.ts` assertions that every `END_ACTIVE_EFFECT` caller must be the Campaign owner were rewritten, because the owner gate now has the holder-end exception. Tests added for both sides of it (`sheetEndActiveEffect.test.ts`).
4. **Spellcasting lock.** A generic grant effect `SPELLCASTING_LOCK` (`ENABLE`), named for the effect: the holder cannot cast spells (the cast decision returns `SPELLCASTING_LOCKED`; domain rejection at the casting entry) and cannot hold Concentration. Applying it ends current Concentration through the D95 detector, which gains the end reason `SPELLCASTING_LOCKED` (after DEFEATED and INCAPACITATED); starting Concentration while it is held is an `EncounterValidationError`.
5. **Deferred.** The SRD early-end rule (no attack and no damage since the last turn) is deferred to ATTACK-9.T6.
6. **Authored parity.** Class features are authored from core options; the SRD corpus uses no shape the authoring form cannot produce. Every shape above has node-map labels, descriptions, visibility and a default factory (`ATTACK_ABILITY` facet field, `SPELLCASTING_LOCK` modifier domain, `endOnEvents`, `holderEnd` with the `pathLifecycleHolderEnd` factory).

## Status log

- 2026-10-14: workbook written.
- 2026-10-14: integration owner approved shapes 1-5 (recorded above). Player-ended Rage escalated against D99; approved as the holder-end option with an activation cost (3a), plus authored parity (6).
- 2026-10-14: all code written and committed as WIP (`3c5335b6c`); nothing compiled or run yet, waiting on the validation lock for builds and the typecheck.

## Proposed ledger edits (filled by the slice session)
