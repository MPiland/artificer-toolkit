# Slice QUALITY-1: one implementation per diverging copy (T1, T2)

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Resume here

- T1 closes AC QUALITY-1.1 and merged in m83.
- T2 (D143, Armor Class without defaults) is built on `ci/quality-1-t2`. The CI SHA and run ids go to the orchestrator.

## T1: diverging copies

Each copy was checked against the audit finding. Each has a regression test against real code that fails before the fix (CI's red-proof job records it). Each now calls one shared implementation, and the copies are deleted.

### 1. Removed-item references

- Copies: Character source loss (`removeEquipment` in `packages/rules-runtime/src/character/characterSourceLoss.ts`) and the Convex item transfer (`removeRosterReferences` in `apps/apis/convex/campaigns/characterItemTransfer.ts`).
- They diverged: source loss dropped an emptied creature or vehicle roster; the transfer left `[]`.
- Shared: `removeCharacterItemReferences(state, removedItemIds)`, which is pure. It strips equipped, attuned, and creature and vehicle roster references, and drops an emptied roster. The transfer copy is deleted.
- Proof: `apps/apis/convex/campaigns/characterItemTransfer.test.ts` now expects the emptied rosters to be `undefined`. This is a deliberate canonicalization to the source-loss shape, not a weaker assertion: the old `toEqual([])` asserted the divergent shape.

### 2. Sheet effect end: maintained conditions and the HP clamp

- Copies:
  - Convex `sheetCommands.ts` ended conditions inline for END_ACTIVE_EFFECT and END_CONCENTRATION, then clamped to the projected maximum after a second write.
  - The Worker's END_ACTIVE_EFFECT (`roomCharacterSheetCommands.ts`) only clamped inline and never ended the conditions the effect held. That is the divergence.
  - The Worker's END_CONCENTRATION already settled through the Encounter maintenance planner.
- Shared: `settleCharacterEndedEffects` in `packages/rules-runtime/src/encounterActionMaintenance.ts`.
  - It holds the Character branch of `planEncounterMaintenanceOwner`, which now calls it.
  - Conditions that only the removed effects held end.
  - Current HP falls to `effectiveHitPointMaximum(stored maximum, remaining)`, the same formula the Sheet projection uses.
  - Both Sheet executors call it. Convex no longer takes the END commands through its post-write clamp.
- Proof: `apps/session-worker/test/nativeRoomSheetEffectEnd.test.ts`. The GM ends an Invisible-owning grant from a held Character's Sheet; INVISIBLE ends with it. The existing Convex tests (`sheetEndActiveEffect.test.ts` for the Aid clamp, plus the SPELLS-5.14 condition-end tests) cover the Convex path.
- One representation change: an emptied condition list is now stored as `[]`, as the Encounter settlement stores it. Convex used to store `undefined`.

### 3. Chat SEND replay

- Copies: three nonce-replay reads.
  - Convex `postCampaignChatEntry`.
  - Convex `readRollReplay` in `rolls.ts`.
  - `tableRollPersistence`, through a `readEntryPayload` port that both Convex and the Worker implemented.
  - The Worker's room chat also refused a nonce from before the epoch ("This message was already sent.") instead of replaying it.
- Shared: `readConversationEntryReplay` in `packages/encounter-persistence/src/conversationPersistence.ts`.
  - It checks the conversation and the access cutoff.
  - It requires the payload and checks that the kind matches.
  - Convex has a thin adapter for it in `conversationDocuments.ts`.
  - The `readEntryPayload` ports and `readRollReplay` are deleted.
  - The room now replays the stored entry (`replayed: true`) and charges no rate for it, as an in-epoch retry is free.
- Proof: `apps/session-worker/test/nativeCharacterSheet.test.ts` "replays the entry of a chat nonce the journal holds no receipt for". It deletes the journal receipt, resends, and expects the same delta with chat evidence unchanged.

### 4. Hit-point pool allowed creature types

- Copies: the Worker's area rules filtered excluded creature types before calling `selectHitPointPoolTargets`; the shared selector itself ignored them.
- Shared: `selectHitPointPoolTargets(pool, candidates, targeting)` now applies `targetingExcludesCreatureType` itself. The Worker's own filter is deleted.
- Proof: `packages/rules-runtime/src/__tests__/encounterHitPointPool.test.ts` has the "excluded type" and "allowed types" cases.

### 5. Ability and skill alias resolution, with its ambiguity check

- Copies: `characterSheetVocabulary.ts` kept its own ability alias table and skill alias map, without the ambiguity check that the rule facts run.
- Shared:
  - `resolveAbilityAlias`.
  - `buildSkillSubjectAliasMap(system)`, which now takes the System rather than the registry so the Sheet vocabulary can call it.
  - The local copies are deleted.
- Proof: `packages/rules-runtime/src/__tests__/sheetSkillAbility.test.ts` "refuses a System whose skill id is another skill's code, as the rule facts do".

### 6. Active shield selection (Characters and creatures)

- Copies:
  - A Character counted the held shield that adds the most, with the main hand winning a tie (D107).
  - A creature counted only the first shield it found.
- Shared: `selectDnd5eHeldShield` in `packages/rules-runtime/src/systems/dnd5e/armorClass.ts`, called by `resolveDnd5eActiveShield` and `resolveDnd5eCreatureArmorClass`.
- Proof: `packages/rules-runtime/src/__tests__/creatureArmorClass.test.ts` "counts the held shield that adds the most, as a Character does". Leather, a Shield in the main hand and a Shield +1 in the off hand give AC 16.
- Missing Armor Class was left open here and ruled D143 (T2 below).

## T2: Armor Class without defaults (D143)

- Authoring:
  - `equipmentAuthoredDtoSchema` and `equipmentAuthoringInputDtoSchema` refuse ARMOR or SHIELD without `armorClass` (`armorAuthorsArmorClass`). A variant inherits its parent's.
  - `BaseEquipmentAuthored` requires `armorClass` for those two categories.
  - The equipment node map marks Armor Class required for them.
- Runtime: `resolveDnd5eEquipmentArmorClass` in `packages/rules-runtime/src/systems/dnd5e/armorClass.ts` is the one check. Creatures return its refusal; Character vitals throw it through `requireDnd5eArmorClass` (renamed from `requireCreatureArmorClass`). The Character-only `?? 2` and `?? 10` are deleted.
- Contract: the Character Armor Class facts' `source` is now `equipmentInstanceMechanicSourceSchema`, the one source kind their builder emits, so the refusal names the Equipment.
- Source data: all 12 SRD armors and 3 SRD shields carry an Armor Class.
- Development data (orchestrator ruling: migrate only if records need it): a read-only scan of the local Docker backend on 2026-10-17 found nothing to migrate, so no migration was added.
  - The scan read `authoredVersions` (with `authoredVersionPayloadChunks`), `authoredDrafts` and `authoredDraftPayloads` through `convex data`.
  - It found 1057 versions, 371 of them Equipment, all from the SRD content source. 15 are ARMOR or SHIELD, and none lacks `armorClass`.
  - There are 0 drafts.
- Proofs:
  - `packages/rules-runtime/src/__tests__/creatureArmorClass.test.ts` "a Character and a Creature holding the same equipment (D143)": equal AC for SRD Leather Armor and Shield; the same refusal for each without its Armor Class (red: the Character got 10 or 12).
  - `packages/schema/src/__tests__/equipment-armor-class-contracts.test.ts` and `packages/shared/src/__tests__/node-sections.test.ts` "requires an Armor Class only for armor and shields".
- Changed expectation (ruled behavior, not a weakened assertion): `encounterWieldConflict.test.ts` asserted the deleted shield fallback (stowing an AC-less shield cost 2). It now expects the D143 refusal.
- Imports: a custom armor or shield imported without an Armor Class becomes a draft the author must complete before it saves.

## Follow-ups (not in AC QUALITY-1.1)

- Convex `endCarriedConcentration` (`apps/apis/convex/characters/sheetConcentration.ts`) is a Convex-local copy of the shared chosen Concentration end (`endChosenConcentration`, which the Worker uses). It is a QUALITY-2 candidate.
- A GM private-roll nonce from before the epoch is still refused in the room ("This roll was already made."). Its replay needs the room's retained-roll record, not a conversation entry.
