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
   - A movement-pass hit (opportunity attack or hazard) that knocks a raging mover unconscious ends the grant after the pass settles (T7 item 8a): `persistMovementSettlements` calls `endHolderStateGrants` for each Run actor once its settlement steps have all committed, from the committed holder state, and posts the same notice. The movement planner does not plan it (`findEnd` in `nativeEncounterMovementConcentration.ts` returns early without a maintained-effect slot), so the end lands after the pass, not between its contacts, and a later contact in the same pass still sees the grant. A MANUAL Run ends nothing.
   - Review M1: the area and cleaving commits keep the ended grants in `consumedGrants` too (`receiptConsumedGrants`, `addEndedGrantsToRoot`), so undo of any of the three action roots restores them.
     3b. **Grant end conditions (review M2).** A new `endOnConditionIds` lifecycle field names Conditions that end the grant (a `condition_types` multi-select). SRD Rage ends only on Unconscious ("knocked unconscious"), so it uses `endOnConditionIds: [Unconscious]` and `endOnEvents: []`; Stunned or Paralyzed keep it. `ON_INCAPACITATED` stays for grants that end on any incapacitation. Persistent Rage (level 15) remains expressible: a grant that names no ending state. Heavy armor is authored in T7 (item 8b) with the existing `EQUIPMENT_EQUIPPED` predicate (category `ARMOR`, property `HEAVY`, `EXCLUDE`); T1's claim that no predicate names armor weight was wrong, since the predicate matches the item's `properties`.
     3a. **Holder-end option (requirement B).** A grant's lifecycle carries an optional `holderEnd: { activation }` using the existing activation codes (SRD Rage: `BONUS_ACTION`). It replaces the earlier `ON_HOLDER_CHOICE` event.
   - Only a grant that carries it may be ended by its holder's controller; every other effect stays Campaign-owner-only (D99), and the GM can still end any effect. D99 is otherwise unchanged, including no GM undo of an ended grant.
   - In an Encounter a non-free cost is available only on the holder's turn and spends that slot. A new stored run command kind `END_HELD_GRANT` (a Run command, like Escape) carries it: `admitCurrentActorCommand` makes it holder-turn-only, the planner evaluates and consumes the economy, persistence re-reads the grant's own `holderEnd`, deletes the grant and records the command.
   - The holder's Encounter action choices list it (`heldGrantEnds`), and the tabletop drawer renders an "Active effects" list. Outside an Encounter the Sheet `END_ACTIVE_EFFECT` command accepts the holder-end grant; inside one, a costed holder-end is refused there and must go through `END_HELD_GRANT`.
   - **Premise change:** `assertSheetCommandCallerAllowed` and its `sheetCommandReducer.test.ts` assertions (including that other commands pass) were removed, because the owner gate now lives in `endCharacterActiveEffect` with the holder-end exception. `sheetEndActiveEffect.test.ts` covers both sides, and its Rage test now also asserts the player's `SET_INSPIRATION` still passes. A Run that is not ACTIVE (or an ACTIVE Run that does not hold the Character) goes through Convex, where the player ends any holder-end grant freely (`inEncounter: false`). In a MANUAL Run the Sheet end is free as well (`economyEnforced: false`; T7 item 4): `END_HELD_GRANT` is an Assisted-only Run command, so a MANUAL Run never reaches it. An off-turn costed end stays refused in an Assisted Run, so the cost cannot be bypassed. Only the Campaign owner is never restricted.
4. **Spellcasting lock.** A generic grant effect `SPELLCASTING_LOCK` (`ENABLE`), named for the effect: the holder cannot cast spells (the cast decision returns `SPELLCASTING_LOCKED`; domain rejection at the casting entry) and cannot hold Concentration. Applying it ends current Concentration through the D95 detector, which gains the end reason `SPELLCASTING_LOCKED` (after DEFEATED and INCAPACITATED); starting Concentration while it is held is an `EncounterValidationError`.
5. **Deferred.** The SRD early-end rule (no attack and no damage since the last turn) is deferred to ATTACK-9.T6.
6. **Authored parity.** Class features are authored from core options; the SRD corpus uses no shape the authoring form cannot produce. Every shape above has node-map labels, descriptions, visibility and a default factory (`ATTACK_ABILITY` facet field, `SPELLCASTING_LOCK` modifier domain, `endOnEvents`, `holderEnd` with the `pathLifecycleHolderEnd` factory).

## Status log

- 2026-10-14: workbook written.
- 2026-10-14: integration owner approved shapes 1-5 (recorded above). Player-ended Rage escalated against D99; approved as the holder-end option with an activation cost (3a), plus authored parity (6).
- 2026-10-14: all code written and committed as WIP (`3c5335b6c`); nothing compiled or run yet, waiting on the validation lock for builds and the typecheck.
- 2026-10-15: build and Turbo + Convex typecheck green; SRD manifest regenerated. Full unit batches green for rules-runtime (1054), encounter-persistence, source-data, schema, web (forms/rendering, VTT) and session-worker (606). Red-first fixes: the `activeEffect` fixture dropped `holderEnd`; the Concentration refusal under a spellcasting lock is now a domain rejection (`SpellcastingLockedError` -> `SOURCE_REQUIREMENTS_NOT_MET`), no longer an unexplained UNAVAILABLE.
- 2026-10-15: `rageJourney.test.ts` green: compile, damage/resistance journey, holder-end (own turn spends the bonus action, off-turn refused, spent bonus action refused with `ACTION_ECONOMY_UNAVAILABLE`) and GM undo. It runs for the SRD Barbarian and for the same document owned as homebrew (`homebrewCopy`: fresh ids, different copy).
- 2026-10-15: web parity proof (`AuthoredDomainFieldParity.test.tsx`): the real SRD Rage feature is loaded into the class form; every populated path resolves to a node, node-runtime normalization clears nothing, the field controls mount with the same values, and the form's `normalizeForSubmit` output parses through `classAuthoringInputDtoSchema` and equals the SRD Rage effects ignoring ids, labels and descriptions. `authoringNodeDefaultInventory` stays green.
- 2026-10-15: review pass: M1 shared receipt (area/cleaving undo), M2 `endOnConditionIds` (Rage ends on Unconscious only), M3 Sheet/room holder-end tests, M4 docs, L1-L8. Details in the report to the main session.
- 2026-10-15: a third campaign member is refused `END_HELD_GRANT` with `NOT_ACTOR_CONTROLLER` (journey, SRD and homebrew). The member must join before the room opens: a mid-session join closes the room's sockets.
- 2026-10-15: Convex codegen pushed to the local backend (validators changed: `heldGrantEnds`, `END_HELD_GRANT`). Base merged (`codex/phase-08-2-convex-cutover`); conflicts were the lifecycle-event option copy (upstream moved `tooltip` text into `description`; followed), this workbook and the regenerated SRD manifest.
- 2026-10-15: CI run 38781276358 attempt 1, Convex suite 3/4: `developmentLifecycleProof.test.ts` failed at `developmentEncounterTransactions.ts:286` (the owner's replayed `start` returned the player projection: FRIENDLY actor with `health: null` where the GM projection has `currentHitPoints: 11`). Finding: not this slice. (1) The owner's replay is presented per the room's own membership role (`roomEncounterCommands.ts` replay, `presentEncounterResultForMember`: GM projection only for `OWNER`); it is reached after the test's concurrent ownership transfer, transfer back and reassignment. (2) No hunk of this branch touches the replay, presentation, membership, room-input or campaign-ownership code, and the test uses no Rage or `END_HELD_GRANT`. (3) The identical assertion difference failed on `ci/spells-17-t2` (run 38782976507, head `116953cd5` = phase branch plus SPELLS-17.T2), which holds none of this slice's commits. (4) Four local repeats on this branch all passed. Register as an intermittent base defect in the ownership-transfer replay of that test; the next full CI run on this head is the checkpoint, the attempt-1 rerun is not.
- 2026-10-15: checkpoint CI run 38786722167 on head `4ed2d2ec0` (phase branch merged): every job green except Convex suite 3/4, which failed only with the same `developmentLifecycleProof` signature (`developmentEncounterTransactions.ts:286`). Registered by the main session as PRIVACY-1.T1 (`d9b08782f`); it does not block this merge. No rerun is counted.
- 2026-10-15: ATTACK-9.T7 (nine review fixes) implemented red-first; builds, package (214), Convex (62), worker (651) and Turbo typecheck green locally. Item 4 refusal and item 7 limit proven red by temporary reversion; item 8a red as a new function. CI run recorded in the push report.

## Proposed ledger edits (filled by the slice session)

- **AC ATTACK-9.1 (Rage part), task ATTACK-9.T1:** mark T1 done. Proof: `packages/rules-runtime/src/__tests__/rage.test.ts` (compile, grant rules, lock, end, holder-end), `apps/session-worker/test/nativeRoomConcentrationGrant.test.ts` (Concentration refused under the lock), `apps/apis/convex/encounters/rageJourney.test.ts` (Encounter journey for the SRD Barbarian and for the same document owned as homebrew; holder-end own turn, off-turn, spent bonus action, third member; GM undo), `apps/web/src/forms/tests/AuthoredDomainFieldParity.test.tsx` (authoring parity). Logs in `local-validation/attack-9-t1/`.
- **D113 (final text):** items 1-6, 3a and 3b above, plus: `endOnConditionIds` is a generic grant end option; ended grants join `consumedGrants` on action, area and cleaving roots; a costed `END_HELD_GRANT` Run command blocks undo of the prior action (D99); and `SPELLCASTING_LOCK` refusal is `SOURCE_REQUIREMENTS_NOT_MET` (a `SpellcastingLockedError`, no new reason); the stored Run command kind `END_HELD_GRANT` is new; an ended grant has no GM undo (D99).
- **Authored parity, as proved:** the web half renders and round-trips the real SRD Rage feature through the real FormRenderer, node-runtime resolver and form adapter; the Encounter half runs the same Barbarian as an SRD import and as a homebrew-owned copy (fresh ids and copy). Together they show the form can produce the SRD effect and that behavior does not depend on ids, copy or source. It is not a clicked-through UI publication of a homebrew Rage into an Encounter; do that in the Storybook/E2E pass if wanted (Storybook cannot run in a worktree).
- **Known gaps (candidates for ATTACK-9.T6 or later):** the early-end rule (T6); a costed holder-end is ended only through `END_HELD_GRANT` inside an Assisted Encounter, not the Sheet `END_ACTIVE_EFFECT`; GM undo of a Rage that ended Concentration (T7 item 7).

## ATTACK-9.T7 (AC ATTACK-9.1): fixes from the merge review

**Status:** done (CI run recorded in the status log). T1 merged at `13f634280` (2026-10-15). The main-session production review found no blockers. These items keep AC 9.1 open; fix each at its cause, red first:

1. **Defeated holder (correctness).** `apps/session-worker/src/nativeEncounterConcentration.ts` (~306-317) plans grant ends from `target.state.conditions` even when the reason is DEFEATED. `readHolderEndState` in `packages/encounter-persistence/src/concentrationEnd.ts` returns `conditionIds: []` for DEFEATED. A defeated holder carrying a condition that ends a grant is therefore planned as an end and refused at `concentrationChildrenPersistence.ts` (~1428-1454, "Live Session grant end is unexpected"), which fails the whole commit. Make the planner and persistence read the same holder end state from one shared function.
2. **Completeness check.** Persistence checks only the ends the planner sent (~1429). It must also refuse a commit that omits a grant the committed holder state ends.
3. **Attack ability is guessed.** `usedAttackAbility` in `characterActionMechanics.ts` (~2268-2288) picks the largest ability-modifier contribution. D113.1 says the resolver records the ability it used. With a higher extra ability bonus (for example a CHA rider) it picks the wrong ability and suppresses Rage damage. Record the ability; do not infer it.
4. **MANUAL and non-ACTIVE Runs.** `roomCharacterSheetCommands.ts` (~237) hard-codes `inEncounter: true`, and `admitCurrentActorCommand` refuses `END_HELD_GRANT` in MANUAL (ASSISTED_ONLY) and in non-ACTIVE Runs. A player in a room-held MANUAL or PREPARED Run cannot end their own Rage, which contradicts the workbook's "in a MANUAL Run `END_HELD_GRANT` spends nothing" and `rageJourney.test.ts`. Decide by the D113.3a rule (costed holder-end only on the holder's turn in an ACTIVE Assisted Run; otherwise the Sheet end is free), make the code and the journey agree, and correct the workbook text.
5. **Turn-commit ends.** `turnCommitPersistence.ts` (~315) deletes `endedGrants` with no receipt. Prove whether a turn advance can be undone. If it can, route the grants through `receiptConsumedGrants`; if not, note why in D113.
6. **Silent ends after an edit.** `concentrationEditEnd.ts` (~1498-1506) deletes grants that a GM or Sheet edit ended, with no chat notice. Post the same end notice the action path posts, so players see why Rage ended.
7. **Undo when Rage ends Concentration.** A Rage that ends Concentration (`SPELLCASTING_LOCKED`) creates a CONCENTRATION_END child, which `actionRevert.ts` treats as unsupported, so GM undo of that Rage is unavailable. Either support it (restore the Concentration as the D95 undo does) or record the limit in D113 and show the reason in the undo refusal. The AC requires "GM undo restores the charge", so prefer support.
8. **Known gaps from T1, now in scope:**
   - a movement-pass hit that incapacitates (knocks unconscious) a raging mover ends the grant (`findEnd` in `nativeEncounterMovementConcentration.ts`; movement receipts carry `endedGrants`);
   - heavy armor: add a generic Character equipment predicate for armor weight or category, and author Rage's heavy-armor restriction with it. Escalate if no generic shape fits.
9. **Nits:**
   - the aria-label reads "End End Rage", because the server label already starts with "End": use the label as is;
   - `deleteConsumedGrants` is a misleading name for ending grants: rename it for both uses (done: `deleteGrants`);
   - `endOnConditionIds` uses `postgresUuidSchema` in the authored path but `uuidSchema` in `activeRuleEffects`: use one;
   - the stories `onEndHeldGrant: sendEscapeCommand`: give it its own mock;
   - the `nativeHolderActivation.ts` `label` parameter and the duplicated `'amount' in activation` guard;
   - the unreachable MANUAL branch in `activationAllowanceMatches`;
   - `SpellcastingLockedError` mapping on the persistence maintenance callers (`roomEncounterActions.ts:134`, `liveMovementReactionPersistence.ts:111`): the same `SOURCE_REQUIREMENTS_NOT_MET` everywhere.

**AC wording:** AC 9.1 says Rage ends "when the Barbarian is incapacitated". SRD Rage ends when knocked unconscious, and D113.3b followed the SRD. The main session amended the AC to the SRD wording.

### T7 outcome

1. **Defeated holder.** The planner and persistence both pass their holder state to one function, `grantsEndedByHolderState`, which ignores conditions for a defeated holder (persistence's `readHolderEndState` also reads none), so the rule lives in one place and no condition-bound grant is planned for it. The planner still builds its own state input. Consequence, recorded: a condition-bound grant (Rage) does not end when its holder is defeated, only expires; ending state-bound grants on defeat is a product call (follow-up).
2. **Completeness.** `persistEncounterConcentrationChildren` takes `damagedActorIds` and refuses a commit that omits a grant a damaged holder's committed state ends ("grant end is missing").
3. **Attack ability.** `usedAttackAbility` still infers the ability (the largest ability modifier) but now only from the attacking item's own `SOURCE`-scoped contributions, so a Character-wide bonus from another source (a CHA rider) no longer changes it. It is not a recorded ability: a weapon carrying its own larger SOURCE-scoped modifier of another ability would still pick that one. Recording the ability on the resolved mechanic is a follow-up.
4. **MANUAL and non-ACTIVE Runs.** `endCharacterActiveEffect` takes `economyEnforced`: the room passes `automationMode !== 'MANUAL'`, Convex passes `false`. A MANUAL Run's holder ends Rage free at the Sheet (`END_HELD_GRANT` is Assisted-only, so a MANUAL Run never reaches it); a non-ACTIVE Run goes through Convex as before. **Deviation from the brief's reading:** an off-turn costed end in an Assisted Run stays refused, because ending it free at the Sheet would bypass the cost.
5. **Turn-commit ends.** A turn advance (`START`, `ADVANCE_TURN`) is not an undo root: `revertLastEncounterAction` reverts only a `RESOLVE_ACTION` or `ESCAPE_RELATIONSHIP` root, so there is nothing to restore the grants into and no receipt is needed. Proof: `actionCommands.test.ts` ("refuses after the turn advanced, so a turn commit that ended grants needs no undo receipt"); it characterizes the existing behaviour and involves no grant. D113 note: a turn commit's ended grants have no undo receipt because a turn advance is never an undo root.
6. **Silent ends.** `postGrantEndMessages` posts one notice per ended grant (`<grant label> ends for <actor>.`, entry id `grantEndNoticeId(occurrence, grant)`), from the edit path and, new in T7, the action/area/cleaving/turn path: the action path had posted no grant-end notice before T7. A private GM holder and a source hidden from players post nothing.
7. **Undo when Rage ends Concentration.** Recorded limit, reason shown: a Rage that ended Concentration adds a `CONCENTRATION_END` child whose receipt keeps ids only, not the ended maintained effect and its dependents, so a faithful restore needs a persisted-contract change across five emitters. `revertLastEncounterAction` now refuses with "Undo can't restore this action: the holder lost Concentration to a spellcasting lock". The AC's "GM undo restores the charge" holds for a Rage that ends no Concentration. **Follow-up slice proposed:** persist the ended maintained effect on the end receipt and restore it on undo.
8. **Known gaps.** (a) A movement-pass hit that knocks a raging mover unconscious ends the grant after the pass settles (`endHolderStateGrants`, called by `persistMovementSettlements`); the end lands after the pass, not between its contacts. (b) Heavy armor: Rage's damage bonus, resistances and advantage carry an `EXCLUDE` `EQUIPMENT_EQUIPPED` condition (category `ARMOR`, property `HEAVY`); `rage.test.ts` proves a heavy-armored Barbarian gets none of them. T1's claim that no predicate names armor weight was wrong. (c) Heavy-armor exclusion (`EQUIPMENT_EQUIPPED` with category and properties, no equipment selected) was not authorable: the Facet node map offered no category or property options unless equipment was selected, so the web parity proof (CI run 38818550459) cleared 16 values. The map now seeds the full options for the "all equipment" scope.
9. **Nits.** `deleteConsumedGrants` is `deleteGrants`; `endOnConditionIds` uses `postgresUuidSchema` in both paths; the aria-label uses the server label as is; the stories have their own `onEndHeldGrant` mock; `nativeHolderActivation.ts` lost its `label` parameter and the duplicated guard; the `MANUAL` branch of `activationAllowanceMatches` was dead and is removed together with its Manual assertions in `escapeEffectVerification.test.ts` (they tested only that branch; disclosed). The `SpellcastingLockedError` mapping is already centralized in `prepareNativeLiveActionMaintenance`, so no change.

**Independent review (opus, read-only) and its disposition.** Fixed: doc wording for items 1, 3 and 5, and the `CHOSEN` undo-limit grammar. Recorded as follow-ups: (a) no Encounter journey proves a movement-pass opportunity attack that knocks a raging mover unconscious (8a is unit-proven; the `roomSceneGeometryCommand.ts` wiring is covered by the CI worker suite only), nor an Unconscious end of Rage in `rageJourney`; (b) 8a ends grants after each partial settlement of a paused pass, and a second opportunity attack within one settlement still sees the Rage resistance; (c) a Rage that ends Concentration cannot be restored by undo (item 7: full Concentration-restore slice); (d) the item 1 and 3 consequences above; (e) `endHolderGrants` reads each Run actor's effects per mechanics-changing settlement.

Sync the base first. Push to `ci/attack-9-t7`. Report as for T1.
