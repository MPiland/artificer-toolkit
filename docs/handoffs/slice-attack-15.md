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
- **T1g: one seam (as built).** Offers are written in `persistEncounterMechanicsBatchPlan` (`mechanicsBatchPersistence.ts`), which every automated outcome goes through via `applyRoomEncounterMechanicsBatch`. The four T1 call sites are gone. The seam reads the batch's own receipt rows, its `deathSave` and its `sourceCommandId`, so these paths offer too:
  - voluntary zone entry;
  - zone damage during forced movement;
  - melee retaliation during movement;
  - check, contest and basic-action outcomes;
  - damage mirrors.

  Offers merge per command (Ruling C). The actor written with the batch carries its offers, so later checksum-checked writes see them.
  - **Forced movement keys on its Scene move.** Contacts along a push settle under the internal Scene move command, as their damage-type records and mirrors do. Undo of the action can't restore zone damage to a Character (`REVERT_UNAVAILABLE`), so no offer outlives an undo. A push whose action also offers makes two offers for one blow. That is rare and is deferred (future enhancements, Deferred edge cases).
  - **Proofs.** `apps/session-worker/test/nativeRoomConsequenceRollZones.test.ts`:
    - walking into a zone that drops the Character to 0 offers the roll;
    - zone damage that leaves the Character standing offers nothing;
    - a push through a zone that drops the Character to 0 offers the roll, and the refused undo leaves the offer standing.

- **Ruling (2026-10-25).** Only automation offers. A manual HP change, such as a Sheet `ADJUST_HIT_POINTS` during a Run, makes no offer.

## T2 as built

- **Table shape (Ruling B).** INJURIES is `{ triggers, table: { dieFaces, rows } }`. Each row is `{ id, minimum, maximum, label, effect, healing }`, and `consequenceRollTableDtoSchema` refuses overlapping, out-of-order or out-of-die rows and repeated ids. `CREATE_INJURY_RECORD`, `REQUIRE_CHECK`, `JUDGMENT_REQUIRED`, the outcome kinds and the recovery descriptor are deleted. Nothing outside Injuries read them. `effect` and `healing` are GM-ruling text only (D187a).
- **Recording.** On ACCEPT, `recordConsequenceRollCommand` checks that the Character is ACTIVE and holds fewer than `MAX_CHARACTER_CONSEQUENCES` (20) before rolling. When the roll lands on a row, it writes `{ id: commandId, definitionId, rowId, tableLabel, label, effect, healing, recordedAt }` to `character.state.consequences` through `writeCharacterRecord`. A gap roll records nothing. `consequences` is a Character play field (`characterPlayState.ts`), so the room holds it and checkpoints it.
- **Sheet.** The overview lists "Lingering consequences" with each row's effect and the table's named healing. `capabilities.removeConsequences` uses the same rule as `endActiveEffects`: the Campaign owner on an active Campaign.
- **Removal.** `REMOVE_CONSEQUENCE { consequenceId }` is a live play Sheet command. `assertGmOnlySheetCommandAllowed` refuses it from anyone but the Campaign GM, on Convex and in the room, including on the player's own Character. Removing an absent id is refused.
- **Proofs.**
  - `apps/apis/convex/encounters/consequenceRollCommands.test.ts` ("Recorded consequences on the Character") is the journey: accept records the row; both Sheets show it with its healing; the player's remove is refused; the GM removes it; a decline records nothing.
  - `packages/rules-runtime/src/__tests__/sheetCommandReducer.test.ts` covers removal, the absent id and the GM-only assertion.
  - `packages/rules-runtime/src/__tests__/campaignCharacterSheet.test.ts` covers the capability.
  - `packages/schema/src/__tests__/consequence-roll-table.test.ts` covers table refinements and the 20-consequence cap.

## T3 as built

- **Settings gate (AC 15.3).** T1 already added INJURIES to `INTEGRATED_OPTIONAL_COMBAT_RULE_MODULES`, so T3 changes no product code. Campaign settings list a rule, and the save accepts it, only when its authored module pin matches the integrated policy key and contract version (`isIntegratedOptionalCombatRule`).
- **Proofs.**
  - `apps/apis/convex/campaigns/playSettings.test.ts` ("offers and saves Injuries only while its System policy resolves it") is the Convex journey: the published SRD Injuries is offered and saved, while an Injuries copy pinned to an unsupported contract version is not offered and its save is refused without changing settings.
  - `packages/rules-runtime/src/__tests__/campaignPlaySettingsOptions.test.ts` covers the options presenter: the SRD module is offered; a later contract version and an unknown module key are not.
