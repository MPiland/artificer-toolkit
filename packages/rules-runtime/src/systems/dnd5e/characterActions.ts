import {
  characterActionModelInputSchema,
  characterActionModelOutputSchema,
  type CharacterActionModelInput,
  type CharacterActionModelOutput
} from '@artificer-toolkit/schema/api/characterActionRules'

import { resolveDnd5eActionMechanic } from './characterActionMechanics.js'

/** Pure D&D 5e (2014) Character-action policy over an already-resolved Character snapshot. */
export function evaluateDnd5e2014CharacterActions(
  input: CharacterActionModelInput
): CharacterActionModelOutput {
  const parsedInput = characterActionModelInputSchema.parse(input)
  const actionDecisions = parsedInput.candidates.map((candidate) => {
    const resourceUse = candidate.resourceUse
    const sourceActive = parsedInput.activeSourceIds.includes(candidate.sourceId)
    const equipmentActive =
      candidate.equipment !== null &&
      parsedInput.activeEquipmentInstanceIds.includes(candidate.equipment.itemInstanceId)
    const sourceAvailable =
      candidate.activationSourceKind === 'ACTIVE_SOURCE'
        ? sourceActive
        : candidate.activationSourceKind === 'ACTIVE_EQUIPMENT'
          ? equipmentActive
          : sourceActive && equipmentActive
    const resource =
      resourceUse === null || resourceUse.poolId === null
        ? null
        : (parsedInput.resources.find((pool) => pool.poolId === resourceUse.poolId) ?? null)
    const resourceAvailable =
      resourceUse === null ||
      (resource !== null &&
        resource.state === 'RESOLVED' &&
        (resource.remaining ?? 0) >= resourceUse.cost)
    const reasonCode = !sourceAvailable
      ? candidate.equipment !== null &&
        candidate.equipment.requiresEquipped &&
        !candidate.equipment.equipped
        ? 'SOURCE_NOT_EQUIPPED'
        : candidate.equipment !== null &&
            (candidate.equipment.requiresAttunement || candidate.equipment.requiresAttuned) &&
            !candidate.equipment.attuned
          ? 'SOURCE_NOT_ATTUNED'
          : 'SOURCE_REQUIREMENTS_NOT_MET'
      : resourceUse !== null &&
          (resourceUse.poolId === null || resource === null || resource.state !== 'RESOLVED')
        ? 'RESOURCE_MISSING'
        : !resourceAvailable
          ? 'INSUFFICIENT_RESOURCE'
          : null
    const ammunitionStacks = candidate.equipment?.ammunitionStacks ?? []
    const attackContext = {
      spellcasting: parsedInput.spellcasting,
      spellCastLevel: null,
      spellDamageBonus: 0,
      spellId: null
    }
    const boundResource =
      sourceAvailable && resourceUse !== null && resource !== null && resource.state === 'RESOLVED'
    return {
      sequence: candidate.sequence,
      actionId: candidate.actionId,
      effectId: candidate.effectId,
      sourceId: candidate.sourceId,
      source: candidate.source,
      mechanicsOwner: candidate.mechanicsOwner,
      status: reasonCode === null ? 'AVAILABLE' : 'UNAVAILABLE',
      reasonCode,
      resourcePoolId: boundResource ? resource.poolId : null,
      resourceCost: boundResource && resourceUse !== null ? resourceUse.cost : null,
      mechanic: resolveDnd5eActionMechanic(parsedInput, candidate, attackContext),
      // The attack as each ammunition stack that fits would make it: its bonuses reach this attack alone.
      ...(ammunitionStacks.length === 0
        ? {}
        : {
            ammunitionMechanics: ammunitionStacks.map((stack) => ({
              itemInstanceId: stack.itemInstanceId,
              mechanic: resolveDnd5eActionMechanic(parsedInput, candidate, {
                ...attackContext,
                ammunition: stack
              })
            }))
          })
    }
  })
  const spellCastMechanics = parsedInput.spellCandidates.map((candidate) => {
    const spell = parsedInput.spellEffects.find((entry) => entry.spellId === candidate.spellId)
    const sourceMechanics = parsedInput.spellMechanics.find(
      (entry) =>
        entry.source.spellId === candidate.source.spellId &&
        entry.source.sourceKind === candidate.source.sourceKind &&
        entry.source.sourceInstanceId === candidate.source.sourceInstanceId
    )
    const spellcasting =
      sourceMechanics === undefined
        ? null
        : {
            attackBonus: sourceMechanics.attackBonus,
            saveDc: sourceMechanics.saveDc
          }
    const castContext = {
      spellcasting,
      spellCastLevel: candidate.castLevel,
      spellDamageBonus: sourceMechanics?.damageBonus ?? 0,
      spellId: candidate.spellId
    }
    return {
      sequence: candidate.sequence,
      candidateId: candidate.candidateId,
      spellId: candidate.spellId,
      source: candidate.source,
      castLevel: candidate.castLevel,
      mechanics: (spell?.effects ?? []).map((effect) =>
        resolveDnd5eActionMechanic(parsedInput, effect, castContext)
      ),
      ...(spell?.repeatedEffects && {
        repeatMechanics: spell.repeatedEffects.map((effect) =>
          resolveDnd5eActionMechanic(parsedInput, effect, castContext)
        )
      })
    }
  })
  const spellReferenceMechanics = parsedInput.spellEffects.map((spell, sequence) => ({
    sequence,
    spellId: spell.spellId,
    readsCastLevel: spell.readsCastLevel,
    mechanics: spell.effects.map((effect) =>
      resolveDnd5eActionMechanic(parsedInput, effect, {
        spellcasting: parsedInput.spellcasting,
        spellCastLevel: null,
        spellDamageBonus: 0,
        spellId: spell.spellId
      })
    )
  }))
  const spellCastDecisions = parsedInput.spellCandidates.map((candidate) => {
    const eligibleSlots = parsedInput.spellSlots.filter(
      (slot) =>
        slot.max > 0 &&
        (candidate.baseEntry
          ? slot.level >= candidate.castLevel
          : slot.level === candidate.castLevel)
    )
    const availableSlots = eligibleSlots.filter((slot) => slot.remaining > 0)
    const selectedSlot = (availableSlots.length > 0 ? availableSlots : eligibleSlots).reduce<
      (typeof eligibleSlots)[number] | null
    >(
      (selected, slot) => (selected === null || slot.level < selected.level ? slot : selected),
      null
    )
    const resource =
      candidate.resourceOwnerKey === null
        ? null
        : (parsedInput.resources.find(
            (pool) => pool.poolId === candidate.resourceOwnerKey && pool.state === 'RESOLVED'
          ) ?? null)
    const resourceRemaining = resource?.remaining ?? null
    const poolSlot =
      candidate.slotPoolCode === null
        ? null
        : (parsedInput.spellSlots.find(
            (slot) =>
              slot.slotKey === candidate.slotPoolCode &&
              slot.max > 0 &&
              slot.level >= candidate.castLevel
          ) ?? null)
    const decision = parsedInput.spellcastingLocked
      ? { status: 'UNAVAILABLE', reasonCode: 'SPELLCASTING_LOCKED' }
      : candidate.spellLevel === 0
        ? { status: 'AVAILABLE', reasonCode: 'CANTRIP' }
        : candidate.castMode === 'AT_WILL'
          ? { status: 'AVAILABLE', reasonCode: 'AT_WILL' }
          : candidate.castMode === 'RITUAL'
            ? { status: 'AVAILABLE', reasonCode: 'RITUAL' }
            : candidate.castMode === 'FIXED_LEVEL' && candidate.resourceOwnerKey === null
              ? {
                  status: 'AVAILABLE',
                  reasonCode: 'FIXED_LEVEL_WITHOUT_RESOURCE'
                }
              : candidate.castMode === 'LIMITED_USE' && candidate.resourceOwnerKey === null
                ? {
                    status: 'UNAVAILABLE',
                    reasonCode: 'RESOURCE_OWNER_MISSING'
                  }
                : candidate.castMode === 'LIMITED_USE' || candidate.castMode === 'FIXED_LEVEL'
                  ? resourceRemaining === null || resourceRemaining <= 0
                    ? {
                        status: 'UNAVAILABLE',
                        reasonCode: 'RESOURCE_EXHAUSTED'
                      }
                    : candidate.slotPoolCode === null
                      ? { status: 'AVAILABLE', reasonCode: 'RESOURCE_REMAINING' }
                      : poolSlot === null
                        ? { status: 'UNAVAILABLE', reasonCode: 'NO_ELIGIBLE_SPELL_SLOT' }
                        : poolSlot.remaining > 0
                          ? { status: 'AVAILABLE', reasonCode: 'SPELL_SLOT_REMAINING' }
                          : { status: 'UNAVAILABLE', reasonCode: 'SPELL_SLOT_EXHAUSTED' }
                  : selectedSlot === null
                    ? {
                        status: 'UNAVAILABLE',
                        reasonCode: 'NO_ELIGIBLE_SPELL_SLOT'
                      }
                    : selectedSlot.remaining > 0
                      ? {
                          status: 'AVAILABLE',
                          reasonCode: 'SPELL_SLOT_REMAINING'
                        }
                      : {
                          status: 'UNAVAILABLE',
                          reasonCode: 'SPELL_SLOT_EXHAUSTED'
                        }
    return {
      candidateId: candidate.candidateId,
      ...decision,
      slotKey:
        poolSlot !== null
          ? poolSlot.slotKey
          : candidate.spellLevel > 0 && candidate.castMode === 'SPELL_SLOT' && selectedSlot !== null
            ? selectedSlot.slotKey
            : null
    }
  })
  return characterActionModelOutputSchema.parse({
    actionDecisions,
    spellCastMechanics,
    spellReferenceMechanics,
    spellCastDecisions
  })
}
