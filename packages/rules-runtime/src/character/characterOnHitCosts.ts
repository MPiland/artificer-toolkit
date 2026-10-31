import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { OptionalOnHitAuthored } from '@artificer-toolkit/shared/authored'
import type { CharacterResourceUsage } from '@artificer-toolkit/shared/character'

import { StaleCharacterActionError } from '../encounterErrors.js'
import type { EncounterOnHitCandidate } from '../encounterOnHitChoice.js'
import {
  spendCharacterResource,
  type NativeCharacterActionResourceConsumption,
  type NativeCharacterSpellConsumption
} from './characterNativeActionResources.js'
import { affordablePoolFor } from './characterResourcePool.js'
import { readSpellCastSlot } from './characterSpellCastActions.js'

type SpellSlots = CharacterRulePolicyOutput['spellSlots']
type Resources = CharacterRulePolicyOutput['resources']

/**
 * Each slot level a Character can still pay an optional on-hit rider with, and the slot that pays it:
 * the level's own slot, or the first slot pool at that level when no standard slot is left there.
 */
export function onHitSlotChoices(
  spellSlots: SpellSlots
): readonly { level: number; slotKey: string }[] {
  const choices = [
    ...spellSlots.maxByLevel
      .filter((slot) => slot.remaining > 0)
      .map((slot) => ({ level: slot.spellLevel, slotKey: `STANDARD:${slot.spellLevel}` })),
    ...spellSlots.slotPools
      .filter((pool) => pool.remaining > 0)
      .map((pool) => ({ level: pool.level, slotKey: pool.poolCode }))
  ]
  return choices
    .filter((choice, index) => choices.findIndex(({ level }) => level === choice.level) === index)
    .sort((left, right) => left.level - right.level)
}

/** Every way the attacker could pay for each of the action's optional on-hit riders now. */
export function onHitCandidates(input: {
  riders: readonly { riderId: string; cost: OptionalOnHitAuthored }[]
  spellSlots: SpellSlots
  resources: Resources
}): EncounterOnHitCandidate[] {
  const choices = onHitSlotChoices(input.spellSlots)
  return input.riders.flatMap(({ riderId, cost }): EncounterOnHitCandidate[] => {
    if (cost.kind === 'SPELL_SLOT')
      return choices.map(({ level }) => ({ kind: 'SPELL_SLOT', riderId, slotLevel: level }))
    const pool = affordablePoolFor(input.resources, cost)
    return pool ? [{ kind: 'RESOURCE_POOL', riderId, poolId: pool.poolId, cost: cost.cost }] : []
  })
}

/** The slot an optional on-hit rider spends at `slotLevel`, as the Character's slots stand now. */
export function onHitSpellConsumption(input: {
  spellSlots: SpellSlots
  slotLevel: number
  characterId: string
  expectedStreamVersion: number
}): NativeCharacterSpellConsumption {
  const choice = onHitSlotChoices(input.spellSlots).find(({ level }) => level === input.slotLevel)
  const slot = choice && readSpellCastSlot(input.spellSlots, choice.slotKey)
  if (!choice || !slot) throw new StaleCharacterActionError()
  return {
    characterId: input.characterId,
    spellId: null,
    candidateId: null,
    slotKey: choice.slotKey,
    beforeUsed: slot.used,
    afterUsed: slot.used + 1,
    expectedStreamVersion: input.expectedStreamVersion
  }
}

/** The charges an optional on-hit rider spends from the pool it was offered against, as the pool stands now. */
export function onHitResourceConsumption(input: {
  resources: Resources
  resourceUsage: readonly CharacterResourceUsage[]
  poolId: string
  cost: number
  characterId: string
  expectedStreamVersion: number
  automationMode: AutomationModeDto
}): NativeCharacterActionResourceConsumption | null {
  const resource = input.resources.find(({ poolId }) => poolId === input.poolId)
  if (!resource) throw new StaleCharacterActionError()
  return spendCharacterResource({
    resource,
    binding: { poolId: input.poolId, chargeId: resource.chargeId, cost: input.cost },
    resourceUsage: input.resourceUsage,
    characterId: input.characterId,
    expectedStreamVersion: input.expectedStreamVersion,
    automationMode: input.automationMode,
    overridable: false,
    ruleWarnings: []
  })
}
