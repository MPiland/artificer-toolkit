# Slice SPELLS-30: cast-time choice spells resolve automatically (T1: per-option execution plan)

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Resume here

- T1 (closes AC SPELLS-30.1): D148 approved 2026-10-17 with three conditions (below). Merged in m95.
- T2 (closes AC SPELLS-30.1): Blade Barrier, data-only (D187a, size 2). Branch `claude/spells-30-t2-2c3b2f`, pushed to `ci/spells-30-t2`. The cover clause is a GM ruling (orchestrator ruling B, below).

## T2: Blade Barrier (D154 walls, D148 pick)

### Findings

- `blade-barrier.ts` was already authored from core options: the Straight Wall (100 ft) or Ringed Wall (30 ft radius, hollow, 5 ft wall) pick, `ENTER_OR_PASS_THROUGH` plus `START_TURN_IN_SPACE` (ENTER, CROSS and START_OF_TURN), one application per turn, `movementCostMultiplier 2`, and a Dexterity save for 6d10 slashing, half on a success. No engine change was needed.
- **Cover gap:** `blockingRules: ['THREE_QUARTERS_COVER']` compiles and is projected on the placed zone, but nothing applies it. `resolveEncounterCover` reads only the Scene's barriers, doors and tokens, plus the GM tier override. D154 assigned zone cover to SPELLS-14, which closed without it.
- **Ruling B (orchestrator, 2026-10-27):** cover ships as a GM ruling through the SPELLS-14.2 tier override. The orchestrator logs zone cover as a cover source in future-enhancements, and no follow-up task is registered. The spell description now ends with a GM-ruling paragraph that tells the GM to give three-quarters cover with the token's cover override. An authored MANUAL_ADJUDICATION outcome placed beside the zone is not possible: `placedSpaceEntries` (`placedSpaceEntries.ts:38`) refuses any ON_USE companion other than one APPLY_GRANT. The projection is unchanged, and no proof claims that the cover is enforced. `semantic-ledger.json` `authoredSha256` is verified by no code, so it was not regenerated (as in SPELLS-7 and SPELLS-20).

### Proofs

- `packages/rules-runtime/src/__tests__/characterSpellCastActions.test.ts`: Blade Barrier compiles both options (WALL 100 ft, RING 30 ft, 5 ft thick), its triggers, double movement, the cover rule, Concentration and 6d10 per save path.
- `apps/session-worker/test/nativeRoomWallZoneSpells.test.ts`, "the SRD Blade Barrier drawn as a straight wall or a ring": the wall geometry, full or half damage on a walk through, the turn-start save, twice the movement, the ring geometry and a walk out of the ring.
- `packages/authoring/src/nodeRuntime/sourceZoneAuthoringParity.test.ts`: the SRD Blade Barrier round-trips the equipment node map unchanged (ADR 0038).

## T1: per-option execution plan (D148)

Consumers:

- Protection from Energy: resistance to the chosen damage type on the touched willing creature, for its Concentration.
- Blindness/Deafness: the chosen condition on a failed Constitution save, a repeat save at the end of each of the target's turns, and one extra target per slot level above 2nd.

### Findings

- Protection from Energy already authors an ON_USE CHOICE whose five options each `APPLY_GRANT` a `DAMAGE_RESISTANCE` modifier. It went manual only because nothing compiled a non-zone CHOICE.
- Blindness/Deafness was mis-authored: two ON_SAVE_FAIL CHOICE paths with one option each, no repeat save, no upcast, and single-target targeting. It is now one CHOICE of two SEQUENCE options (a 1 minute condition plus a `TARGET_TURN_END` Constitution FOLLOW_UP_SAVE), with CHOSEN_CREATURES and `maxTargetsScaling` BREAKPOINTS on `SPELL_CAST_LEVEL`.
- The compiled effect lost an option's result kind, because every CHOICE entry has `groupKind: 'CHOICE'`. DIRECT CHOICE entries now carry `optionGroupKind` (SINGLE or SEQUENTIAL).
- Reused machinery:
  - option narrowing (`zoneChoiceOptions`, now the shared `castChoiceOptions` in `encounterCastChoice.ts`)
  - `maxTargetsScaling`
  - FOLLOW_UP_SAVE `TARGET_TURN_END`
  - `modifierGrantPlan`
  - `choiceOptionsSchema`
  - the drawer Select
- No CLOSED_RULE names either spell, so none was deleted.

### Shape (D148)

1. `compilation.choice: nullable({ options: [{ optionId, label, activeEffectPlan, executionPlan }] })` on the v4 CHARACTER_ACTION entry, exclusive with `zonePlacement`. The top-level plans hold the first option.
   - Every option must share the test and maintenance graphs (`checksumCanonicalJson([test, maintenance])`); otherwise the action compiles MANUAL.
2. An optional `choiceOptionId` on the ACTOR and ACTORS command targets.
3. `choiceOptions` on the ACTOR and ACTORS choice DTO targets.
4. `optionGroupKind` on the compiled entries of a CHOICE option.

### Approval conditions and how each is met

1. **One swap point.** `prepareEncounterActionSource` is the only place the picked option replaces the top-level plans (`castEntry`, before `loadSource`).
   - It throws `CastChoiceUnavailableError`, which becomes the `TARGET_UNAVAILABLE` rejection, when a choice action gets no pick or an unknown one. It also throws when a non-choice, non-zone action is given a pick.
   - This happens before any roll, slot spend or pending occurrence.
   - Readers of the top-level plans:
     - `encounterActionMechanicsPreparation.ts:213`: the plan of the prepared source, after the swap.
     - `encounterActionMaintenance.ts:50` and `encounterActionEffects.ts:31`: read `prepared.source.entry`, after the swap.
     - `encounterInitiativeDeclarationCompiler.ts:66`: the published checksum of an initiative declaration option. This is identity only, with no execution. Both sides read option 0 at the same code, and the declared action then resolves through RESOLVE_ACTION, so through the swap.
     - `characterMechanics.ts:769/801/866`: the schema refine and projection checks. These cover structure only; the refine also walks each option's graphs.
     - `actionTargetModifierReads.ts:73`: the target-modifier read before any pick passes `readsSharedTest` and reads the top-level option's test, which every option shares.
     - `actionChoiceReads.ts:246`: the top-level `creatureFormContribution` for the choice DTO. This is display only, and a choice and a creature form never coexist on one SRD action.
   - Callers that pass no pick:
     - reactions (cast pauses)
     - Disarm
     - movement
     - cleaving (weapon attacks)

     None of them can carry a CHOICE spell. A CHOICE reaction would be refused as `TARGET_UNAVAILABLE`, which fails closed.
2. **Checksum migration.** Adding `optionGroupKind` changes the compiled effect, and so the compiler-source checksum, of every action with a DIRECT CHOICE, including the zone-choice spells.
   - Compiled entries are compiled at read time and not persisted.
   - Pending contexts that hold an old checksum fail closed as stale, with no tolerance added.
   - The SRD manifest is not committed; CI generates it from the package build. The main session reseeds locally after merge.
3. **Drawer.** `CampaignTabletopActionDrawer.tsx` renders the existing `choiceOptions` Select for the ACTOR and ACTORS targets and sends `choiceOptionId` on both. No new component was added.

### Checklist (red first)

- `packages/rules-runtime/src/__tests__/characterSpellCastActions.test.ts`, describe "a cast that picks what it does to its targets":
  - Protection from Energy compiles five resistance options under Concentration.
  - The top-level plans equal option 1's, and the ACTOR target offers the options.
  - Blindness/Deafness compiles two repeating-save condition options.
  - The target cap is 1 at 2nd level and 2 at 3rd.
- `apps/session-worker/test/nativeRoomCastChoice.test.ts`:
  - The Protection from Energy Fire pick holds fire resistance and Concentration.
  - Blindness/Deafness at 3rd level deafens two Wolves, and a passed turn-end save ends it on one.
  - A cast with no pick or an unknown pick is refused (`TARGET_UNAVAILABLE`) before any roll, with no receipt, effect or slot spent, on both ACTOR and ACTORS.
- Red proof: the Tests run's "Red proof against the phase branch" job (run id in the status log).

### Status log

- 2026-10-17: checkpoint `ci/spells-30-t1` pushed. The Tests and Live backend runs were dispatched; a second Live backend run was dispatched by mistake (`gh workflow run` on top of the push trigger, run 39084267380) and left to finish.
- 2026-10-17: Tests 39084264201 failed at the package build (TS2339 in `encounterCastChoice.ts`). Fixed by narrowing to DIRECT entries; uncommitted.
- 2026-10-17: the light room batch had 2 fixture failures: the PfE cast lacked the `TARGET_RANGE_UNCHECKED` acknowledgment, and the Character actor lacked the frozen snapshot that a turn change checks. Both are fixed in the test; the batch has not been rerun yet.
- 2026-10-17: the review fixes are committed (`ecf03bf1d`), and the phase branch was merged into the slice.
  - Local checks: the light room batch passed 36 of 36 (cast choice plus both zone-pick room files). The rules-runtime compile batch passed. Both typecheck lanes passed.
  - The `f3b3799f1` push failed Live backend 39092274971 on generated-file drift only. The auto-fix committed `0f9c2d011`.
- 2026-10-17: **green on `0f9c2d011`**: Tests 39092705384 and Live backend 39092706566.
  - The red-proof job 117573010673 labels both files RED: `nativeRoomCastChoice.test.ts` 7 of 7, and `characterSpellCastActions.test.ts` 4 of 56.
  - The B3 compile test ("stays manual when its pick has no chosen creature") passes on the phase branch too, which is expected, since the base never compiled a pick. Its proof is that it stays green alongside the four RED compile tests.

### Independent review (opus) and triage

- **Fix now:**
  - **B1:** the target-modifier read (`actionTargetModifierReads.ts`) prepared the action with no pick, so it refused every choice action while a player aims. It now passes `readsSharedTest`: the read shows only the test every option shares, so it reads the top-level option. A room regression test covers it.
  - **B2/B3:** a non-zone pick on a POINT, CASTER_CENTERED, SELF or DIRECTED target was compiled, but then never offered or always refused. The compiler now compiles a pick only on ACTOR/ACTORS targets (other kinds go MANUAL). The DTO offers zone options on areas and cast options on creatures only, and a compile test covers it.
  - **B4:** `castChoiceOptions` now narrows once, with no unreachable fallbacks. An empty label also returns null.
  - **B6:** moved the misplaced JSDoc in `encounterRuleCommands.ts`.
  - **B7:** `nativeEncounterRules.ts` now reads the pick through `castChoiceOptionId`.
  - Replaced the non-null assertion in the room test.
- **Defer** (future-enhancements, Deferred edge cases): **B5**, more than 20 options fails the Character's parse; **B9**, a movement reaction carrying a pick.
- **Stands:**
  - **B8:** the top level holds option 0, and the drawer preselects the first option, as with D140.
  - **B10:** the zone-pick behaviour, rerun in the room batch (`nativeRoomSourceAura`, `nativeRoomTurnZoneEffects`).
- Reviewer gaps left unproved, at low risk: replay of a paused cast with a pick, the player socket, the Convex fallback, and PfE halving damage.

### Proposed ledger edits

- SPELLS-30.T1 done, and AC SPELLS-30.1 done once the Tests and Live runs are green.

### Post-launch candidates

- Hold Person authors no upcast target scaling (one extra Humanoid per slot level above 2nd).
- `protectionFromEnergyChoice` in the compile test narrows the options by hand. It could read `castChoiceOptions` instead.
