# Workbook: ATTACK-9.T2 Sneak Attack (AC ATTACK-9.2)

**Status:** D119 ruled shapes 1-3 (T2a) on 2026-10-15; T2a in progress on `claude/attack-9-t7`, pushed to `ci/attack-9-t2a`. T2b-T2d wait their turn.
**Base:** `912f2780d` (phase branch `codex/phase-08-2-convex-cutover` merged into `claude/attack-9-t7`).

## Brief

AC ATTACK-9.2: Sneak Attack adds its level-scaled dice once per turn to a hit with a finesse or ranged weapon when the attack has advantage, or an enemy of the target is within 5 feet of it and the attacker has no disadvantage; critical hits double the dice. Authored only from core authoring options (no `CLOSED_RULE`, no feature-specific kind or executor); an author-built equivalent made through the real authoring form publishes to the same structure and resolves identically.

Before T2d the SRD Rogue authored two inert closed rules for Sneak Attack; T2d replaces them with a real `ON_HIT` rider (`packages/source-data/src/srd/classes/rogue.ts`, doubled by the existing critical code as D58 requires).

## Findings (read-only survey, 2026-10-15)

Only three parts of the rule exist today: the finesse/ranged weapon gate (for modifier grants only), the Rogue `CLASS_LEVEL` gate (Rage precedent), and critical doubling of any `ON_HIT` damage entry inside an action's own compiled effect (`effectActionCompiler.ts` ~3650-3700, 31-dice cap; 10d6 doubled is 20).

| Gap                                                              | Evidence                                                                                                                                                                                                                                   | Needs                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| a. A Feature's PASSIVE `ON_HIT` dice cannot join a weapon attack | `characterActionRuleFacts.ts:314` skips PASSIVE effects; extra damage is numeric modifiers on the first outcome only (`characterActionMechanics.ts:316-319`); `ADD_BONUS_DIE` is schema-rejected (`schema/src/grants/modifier.ts:760-818`) | New shape            |
| b. Dice count cannot scale by class level                        | `validateDiceOutcomeRow` rejects `CLASS_LEVEL` (`effectActionCompiler.ts:2108-2124`); no code binds `characterLevel`/`parentClassLevel`/class-level facts                                                                                  | New shape            |
| c. No "the weapon's damage type"                                 | `damageTypeId` is a required uuid (`authored/damage.ts:117-124`)                                                                                                                                                                           | New shape            |
| d. Roll mode not visible to outcome selection                    | `d20RollMode` is returned beside, not inside, the bound facts (`effectActionCompiler.ts:6804-6866`); no predicate                                                                                                                          | New shape            |
| e. No "enemy of the target within N feet"                        | no distance/adjacency predicate; `positionalFacts` has no production supplier (`encounterActionMechanicsPreparation.ts:415-476`)                                                                                                           | New shape and wiring |
| f. No once-per-turn limit or per-turn record                     | no TURN charge reset; the nearest keyed-by-turn row is `encounterTurnMovements` (D38)                                                                                                                                                      | New persisted record |

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
- 2026-10-15: D119 rules shapes 1-3 and splits T2 into T2a-T2d. T2a built.
- 2026-10-15: T2a merged. T2b (roll-mode predicate) built, pushed to `ci/attack-9-t2b`.

## T2a (shapes 1-3, D119)

Built:

- (a) `characterOnHitRiders.ts` collects the trigger-matched `PASSIVE` Feature `ON_HIT` `DAMAGE` outcomes and merges them into the weapon action's compiled effect when `buildCharacterActionRuleFacts` builds the action. Downstream sees one multi-part `ON_HIT` damage effect, so resistance and critical doubling apply with no new code. Riders come from class, subclass, race and feat Features and their options; a rider matches by equal `triggerCode`, so one effect per trigger until T2b adds the generic any-of.
- (b) `bindFacts` emits the `dnd5e.class-levels` fact from `actionMechanic.classLevels`; `validateDiceOutcomeRow` accepts `CLASS_LEVEL`; `exactDiceConfiguration` is the shared row selector (highest row with `level <= class level`). T12 reuses or extracts it.
- (c) `usesTriggeringWeaponDamageType: true` replaces `damageTypeId` on a DAMAGE outcome (`DamageTypeAuthored` union; schema, compiler and node map). The merge resolves it to the weapon's first `ON_HIT` damage type; an unresolved one fails closed at every consumer.
- The SRD Rogue's Sneak Attack was `CLOSED_RULE` (inert) until T2d; it is real now.

Proof (real code, `characterOnHitRiders.test.ts`): a Rogue's unconditional Sneak Attack rider hits, selects its dice row by class level (1, 3, 4, 5), doubles its dice on a critical, resists like the weapon's damage, and leaves a rider-free Longsword and the shipped Sneak Attack unchanged. `characterOnHitRiderMerge.test.ts` covers trigger mismatch, passive skip, no `ON_HIT` weapon damage, and the multi-damage pick. Schema, compiler and node-map tests cover the new option.

Placement rule (reviewer finding): the flag is valid only on a `PASSIVE` Effect's fixed `ON_HIT` path (`checkWeaponDamageTypeChoices` in the Effect DTO schemas), so an unmerged flag cannot reach `normalizeCharacterActionMechanicFacts`, whose throw is now only an invariant. A rider acquired twice merges once (dedupe by outcome id), and the class rows are chosen from the Rogue levels alone (Fighter 5 / Rogue 1 rolls 1d6).

### T2a checklist and proof logs

Logs under `local-validation/attack-9-t2a/` (not committed).

- [x] (a) merge: `characterOnHitRiders.test.ts` (journey), `characterOnHitRiderMerge.test.ts` (unit); green `b8-tests.log` (14 files, 190 tests).
- [x] (b) class-level dice: journey rows at Rogue 1/3/4/5, Fighter 5 / Rogue 1 rolls 1d6; `b8-tests.log`.
- [x] (c) weapon type: schema (`effect-schema-parsing`), compile (`effect-compiler`), node map (`authoring-node-map-visibility`); `b8-tests.log`.
- [x] Critical doubling and resistance, SRD Sneak Attack still inert: journey test.
- [x] Placement rule red then green: `red-placement.log` (1 failed) then `b8-tests.log`. The exclusive-union schema bug was red in `light-schema-shared.log` (overwritten by the green rerun).
- [x] Typecheck: rules-runtime, apis, web (`b8-tc-*.log`, all 0). Builds shared/schema/rules-runtime (`b8-build-*.log`). apis tests (`b8-apis-tests.log`), web parity (`b8-web.log`), local `convex codegen` (`b8-codegen.log`).
- Earlier red-to-green: `b3-rr-tests.log` (stale `dist` made two Hold Person tests fail; green after the rebuild in `b4-tests.log`).

### T2a reviewer triage (independent opus read-only review)

- Fixed: `actionCharacterResources.test.ts` and the conformance snapshot lacked `classLevels` / the `dnd5e.class-levels` contract; the flag was authorable outside a rider placement (now a schema rule, runtime throw kept as an invariant); duplicate rider acquisition (dedupe by outcome id); multiclass row selection (test); result-block id fixture.
- Deferred (Deferred edge cases in `docs/roadmap/future-enhancements.md`): riders reach equipment attacks only; riders from equipment-granted Features; "first authored" weapon-type pick; a passive CHOICE path's `ON_HIT` damage is collected.
- Stands: the visibility test widens `VisibilityNode` but evaluates the real `PATH_NODE_MAP`; `exactDiceConfiguration` fails closed when the Character lacks the rider's class, while the sheet's `selectValue` falls back to the first row (a Feature without its class is not a supported grant).

## T2b (shape d, roll-mode predicate, D119)

Built (generic; the facet model already has OR groups, so no new any-of):

- `ATTACK_ROLL_MODE` facet predicate (`ADVANTAGE`; `NOT_DISADVANTAGE`) in shared (`facetPredicate`, facet node map), schema (`enums`, `facet`).
- `restrictions?: FacetAuthored` on an Effect path (authored type, compiler copy onto entries, DTO, `PATH_NODE_MAP` and `MANIFEST_BEHAVIOR_PATH_NODE_MAP`).
- `systems/dnd5e/attackRestrictions`: `reduceEffectRestrictions` settles weapon checks when the action facts are built (`dnd5eItemRequirementsMet`, as for Rage); `attackRestrictionsMet` checks the remaining roll-mode checks.
- `bindFacts` emits `dnd5e.attack-roll-mode` (the net mode after advantage and disadvantage cancel); `specializeDnd5eEffectActionOutcomeBody` filters restricted groups. The sealed template checksum hashes the authored (unfiltered) groups.

Proof (real code): `characterOnHitRiders.test.ts` (journeys: advantage-only, disadvantage excluded, `NOT_DISADVANTAGE` over normal/advantage/disadvantage, any-of groups, all-checks-in-one-group); `attackRestrictions.test.ts` (compile copy, reduction, roll-mode table); schema, node-map inventory tests.

### T2b checklist and proof logs

Logs under `local-validation/attack-9-t2b/` (not committed).

- [x] Red then green: `red-filter-off.log` (filter disabled: 5 journey tests fail) then `green-rules-runtime.log` (39 tests) and `t1-schema-shared.log` (54 tests).
- [x] Builds shared, schema, source-data, authoring (`build-*.log`, empty = success).
- [x] Conformance snapshot gains the `dnd5e.attack-roll-mode` contract.
- [x] CI typecheck, Convex shards, web and worker tests on `ci/attack-9-t2b` (Tests run 38844169883, green).

### T2b reviewer triage (independent opus read-only review)

- Fixed: an empty restrictions facet silently dropped the entry (now unrestricted, as in the grant fold); the reducer failed open on `EXCLUDE` of checks it cannot answer and on non-Equipment contexts (now any non-item check or context fails its group); restrictions were authorable on save paths (schema: `ON_HIT`/`ON_CRIT` only, tested at Effect level); the identity memo in `reduceEffectRestrictions` removed; tests added for AND within a group, empty facet and the fail-closed cases.
- Deferred (Deferred edge cases): restrictions ignored outside the general attack branch and on non-equipment actions; derived vs rolled mode (architect question); Sheet shows a gated rider unconditionally; `ATTACK_ROLL_MODE` offered on every Equipment facet; follow-up-save weapon plus rider ordering.

## T2c (shape e, position predicate, D119)

Built (generic, no feature-specific kind):

- `ENEMY_NEAR_TARGET {feet}` circumstance predicate in shared (`facetPredicate`, facet node map `predicateFeet`) and schema (`enums`, `facet`; `feet > 0`).
- `systems/dnd5e/attackRestrictions`: `attackRestrictionsMet(restrictions, { rollMode, enemyProximity })`; `effectReadsEnemyProximity`. An unmeasured Scene (no fact) fails the check whatever its constraint (an unanswerable check fails its group, as in T2b).
- `encounterEnemyProximity.nearestAbleEnemyProximity`: another creature hostile to the target (`encounterActorRelationship`, NEUTRAL is never hostile), not defeated and not `encounterActorCannotAct`, nearest first by `measureSceneTokenFootprintDistance` converted to feet; the attacker and the target never count. `canAct` runs lazily, nearest first.
- `prepareEncounterActionMechanics` takes an optional `loadEnemyProximity`, called only for an attack whose compiled Effect reads the predicate; the answer rides `binding.sourceDerivedFacts.attackEnemyProximity`, which `bindFacts` emits as the `dnd5e.attack-enemy-proximity` TEXT fact. The Session Worker's `nativeAttackEnemyProximity` (passed by `prepareAttack` only) re-reads the locked Scene and loads each consulted actor through `loadTarget`.

"Persistence re-verifies and refuses a mismatch" (ADR 0035 reading): persistence never re-runs rules in the room-authoritative model. The mismatch is refused by the fences the supplier joins: `Action Scene context is stale.` on a changed Scene version, the read fence over every consulted actor's revision, the Encounter version, and the currentness checksum over the binding for a paused action.

Architect questions: derived vs rolled roll mode (still open from T2b); opportunity attacks and reactions load no proximity (conservative fail; Deferred edge cases).

### T2c checklist and proof logs

Logs under `local-validation/attack-9-t2c/` (not committed).

- [x] Red then green; scoped tests: `attackRestrictions`, `characterOnHitRiders`, `encounterEnemyProximity`, schema parse, node-map inventory, room journey `nativeRoomEnemyProximity` (Fighter Club hit: rider owed beside an able enemy, not 20 ft off, not for an incapacitated enemy, not without a Scene). Green: `t1-rr.log`/`t3.log`, `t1-ss.log`, `t2-room.log`; red: `t4-red.log` (room journey fails with the `prepareAttack` supplier removed).
- [x] Typecheck shared, schema, rules-runtime, session-worker (`*-tc.log`, `summary2.txt`).
- [ ] CI Tests and Live backend green on `ci/attack-9-t2c`.

## T2d (shape f, once per turn, D119) and the real SRD Sneak Attack

Built (generic, no feature-specific kind or executor; the closed-rule kind is deleted):

- `usage: ONCE_PER_TURN` (`PATH_USAGE`) on an effect path (schema, shared compiler, node map, authoring form). A limited entry is owed only while its usage key is unspent.
- One per-turn record, no new table: D38's `encounterTurnMovements` row (Encounter, round, turn actor, actor) gains `usedOncePerTurn`. `readTurnUses` / `spendTurnUses` / `restoreTurnUses` in `turnMovement.ts`. T6 reads the same row.
- Fact `dnd5e.attack-turn-uses`; `loadTurnUses` reads the row only for an attack whose Effect reads it. Usage key: compiled effect id, or the Feature id for a passive Feature rider merged onto the attack. `spentTurnUses` derives the spent keys from the final evidence `sourceEntryBindings`, deduplicated (a compiled Effect has one entry per scaling row).
- Commit paths: an ordinary action spends in the commit transaction and keeps `turnUses {round, turnActorId, keys}` on the command record, which `REVERT_LAST_ACTION` restores; a movement opportunity attack spends for the reactor from its settlement; disarm, area and basic action pass `turnUses: null`. The planner computes `plan.turnUses` only for a COMPLETE evidence.
- Opportunity attacks supply the enemy proximity (mover at the contact point of its planned path, `measureNativeEnemyProximity`) and the once-per-turn record. Single unavailable token and NEUTRAL target stay deferred.
- SRD Rogue: `sneakAttackEffect('MELEE' | 'RANGED')`; gate = advantage OR (`ENEMY_NEAR_TARGET` 5 ft AND `ATTACK_ROLL_MODE` NOT_DISADVANTAGE), plus finesse for melee; `ON_HIT`, `ONCE_PER_TURN`, dice by class level (shared row selector).
- Boundary kept: Character on-hit riders merge only onto equipment-sourced attacks, so a Feature-sourced attack gets no rider. Movement opportunity attacks have no GM undo (Deferred edge cases).

### T2d checklist and proof logs

Logs under `local-validation/attack-9-t2d/` (not committed).

- [x] Unit: `turnUses` (persistence store), `attackRestrictions`, `characterOnHitRiders`, `characterOnHitRiderMerge`, `srdSneakAttack` (real SRD Rogue: melee needs finesse, ranged any, advantage vs adjacent enemy vs disadvantage), schema parse, node-map inventory.
- [x] Room journeys: `nativeRoomOncePerTurn` (rider on the first hit only, a later hit's undo keeps the use spent, undoing the spending hit gives it back), `nativeMovementOncePerTurnRider` (opportunity attack with an ally beside the mover gets the dice and spends the use; ally far off gets none), `nativeRoomEnemyProximity`.
- [x] Authored parity: `AuthoredDomainFieldParity.test.tsx` SRD Sneak Attack describe (real form, node-runtime resolver, form adapter, submit equals the SRD effects).
- [ ] CI Tests and Live backend green on `ci/attack-9-t2d`.

## Architect packet: derived vs rolled roll mode (open since T2b; does not block T2d)

`dnd5e.attack-roll-mode` (the fact a path's `ATTACK_ROLL_MODE` check reads) is the rules-derived mode from roll contributors, computed in `bindFacts`. `resolveEncounterD20Answer` (`encounterEvidenceAnswer.ts:53`) uses that derived mode only for an auto-roll; entered dice and app rolls keep the mode the roller chose (`answer.rollMode`).

- **Option A (today): gate on the derived mode.** One mode drives both the d20 and the rider; nothing new to thread; the OUTCOME template stays sealed at TEST. Differs from the table only when the roller overrides the derived mode: advantage the app has no contributor for (an adjudicated Help or flanking) does not unlock Sneak Attack, and a roller who drops derived advantage keeps the dice.
- **Option B: gate on the settled mode.** The TEST evidence already holds `rolledMode`; OUTCOME specialization would read it. RAW-exact (the rider follows the roll actually made), but it threads the TEST evidence into the OUTCOME bound facts and the sealed template then depends on a TEST result.
- **SRD cases that differ:** none under auto-roll. Under entered or app rolls: Sneak Attack with GM-adjudicated advantage (the common table case), and a deliberately flat roll while a contributor grants advantage.
- **Recommendation: B**, before Sneak Attack is relied on at tables that roll by hand. Sneak Attack's eligibility is not blocked meanwhile: derived advantage (conditions, hidden, prone) and the adjacent-enemy case work under A.

### Proposed ledger edits

ATTACK-9.T2a done (shapes a-c); ATTACK-9.T2b (shape d) built; ATTACK-9.T2c (shape e) built; ATTACK-9.T2d (shape f, real SRD Sneak Attack) built; ATTACK-9.2 stays open for T2e.

