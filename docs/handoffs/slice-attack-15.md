# Slice workbook: ATTACK-15

Owned by the ATTACK-15 slice session. Design notes, rulings and proofs go here.

## T1 design (approved 2026-10-25)

- **Offer state.** Run actor state carries `consequenceRollOffers` (at most 8). The Convex validators follow from the zod schema. Only the GM projection shows offers. Undo or void of the damaging root drops the open offers whose `sourceCommandId` is that root.
- **Triggers.** The INJURIES `triggers` are authored, System-neutral facts:
  - `DAMAGED { critical }`;
  - `HIT_POINTS_ZERO`;
  - `DEATH_SAVE_FAILED { byAtLeast }`.

  One rules-runtime matcher reads the damage rows of the damage-save chain (D167) and the turn death save. Neither the kernel nor persistence names Injuries.

- **Command.** `RESOLVE_CONSEQUENCE_ROLL_OFFER { actorId, sourceCommandId, definitionId, decision, visibility }` is GM-only. An offer is keyed by its source command and table definition, as Ruling C allows only one per pair, so it needs no separate id.
  - On ACCEPT, the server rolls the table die and posts a roll card whose source kind is `TABLE`. The receipt keeps `{ actorId, offer, resolution: { decision, dieFaces, roll, rowId | null } }`. A roll that falls in a gap between rows gives `rowId: null`.
  - On DECLINE, the offer is removed and the receipt keeps `{ decision: 'DECLINE' }`.
- **Ruling A.** Offers are made only for actors sourced from Characters. Injuries on Creatures are a GM ruling (D187a).
- **Ruling B.** T1 keeps `bands`. T2 reshapes the table to `{ dieFaces, rows }` and deletes `CREATE_INJURY_RECORD`, `REQUIRE_CHECK`, `JUDGMENT_REQUIRED` and the recovery operations, after proving that nothing else uses them.
- **Ruling C.** Each actor gets one offer per source command, listing every trigger that command met.
- **Ruling D.** The GM accept and decline controls follow the Morale precedent, which has a web control (`CampaignTabletopMorale.tsx`).
- **Out of scope.** Death saves rolled on the Sheet outside a Run make no offer, because offers live on Run actors. The settings gate is T3.

## T1 as built

- **Seams.** Offers are written where damage settles:
  - the action children, area commit and cleaving response, which are the `bindEncounterDamageSaveChain` sites;
  - the turn commit, which also reads the completed death save plan.

  Each passes the actors it wrote on, because `replaceRunActor` checks the stored checksum.

- **Undo and void.** Undo withdraws the root's offers in `commitRevert`. Void needs no change, because it voids only pending occurrences, which applied no damage.
- **Shared GM command path.** `gmEncounterCommands.ts` owns GM admission (authority, replay, version, pending decision) and commit. Morale and the consequence roll both use it.
- **Offer label.** Each offer stores its table's label, so the GM control and the receipt still name the table after the snapshot changes.
- **Integration (ruling 2026-10-25).** T1 adds INJURIES to the integrated optional rules, so REPLACE_OPTIONAL_COMBAT_RULES and Campaign settings accept it through the real command path, as Morale does. Between T1 and T2 the setting is offered, but an accepted roll is only recorded on its receipt; nothing persists on the Character. This is acceptable because nothing has launched. T3 keeps only the settings-gate proof for AC 15.3.
- **Keys.** The command and receipt are keyed by `(actorId, sourceCommandId)` plus the table's `definitionId`, so a System with two tables can offer both for one command. A second resolve of the same offer is refused with `TARGET_UNAVAILABLE`, and reusing its command ID replays the first result.
- **Proofs.** `packages/rules-runtime/src/__tests__/encounterConsequenceRolls.test.ts` covers trigger rules and edge cases. `apps/apis/convex/encounters/consequenceRollCommands.test.ts` is the room journey: drop to 0, GM-only, accept with server roll and card, replay, refused second resolve, decline, undo withdrawal and the turn death save. The stored receipts are room-held history (D85), so `apps/session-worker/test/nativeRoomConsequenceRolls.test.ts` reads them from the room's store. `CampaignTabletopConsequenceRolls.test.tsx` covers the GM control.
- **Not covered by T1 (ATTACK-15.T1g).** These automated damage paths make no offer:
  1. zone damage on voluntary zone entry (`apps/session-worker/src/roomMovementSettlementCallbacks.ts`, `applyMechanics`, then `persistLiveMovementSpatial` in `liveMovementSpatialPersistence.ts`);
  2. zone damage during forced movement (the same settlement, through `applyRoomForcedMovements`);
  3. melee retaliation triggered during movement (`nativeEncounterMovement.ts`, through the same settlement);
  4. check, contest and basic-action outcome batches (`roomEncounterContest.ts` and `roomEncounterBasicActions.ts`, `applyMechanics`);
  5. damage mirrors (`roomDamageMirror.ts`).
- **T1g seam.** All five write through `applyRoomEncounterMechanicsBatch` (`roomEncounterMechanics.ts`), then `persistEncounterMechanicsBatchPlan` (`mechanicsBatchPersistence.ts`), as the action, cleaving and turn paths do.
  - The seam has what an offer needs: the Run state for the tables, `batch.sourceCommandId` for the key, and the target's damage applications. Turn death-save batches carry `batch.deathSave`.
  - Offers merge per command (Ruling C), so several batches of one command make one offer. Undo withdrawal keys on the root command ID.
  - Moving the offer write into this seam replaces the four current `persistConsequenceRollOffers` call sites. Check first whether area commit goes through it; if not, area commit keeps its own call.
- **Ruling (2026-10-25).** Only automation offers. A manual HP change, such as a Sheet `ADJUST_HIT_POINTS` during a Run, makes no offer.
