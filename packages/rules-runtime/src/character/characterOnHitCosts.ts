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
import { readSpellCastSlot } from './characterSpellCastActions.js'

type SpellSlots = CharacterRulePolicyOutput['spellSlots']
type Resources = CharacterRulePolicyOutput['resources']

/**
 * Each slot level a Character can still pay an optional on-hit rider with, and the slot that pays it:
 * the level's own slot, or the Pact Magic slot when that is the only slot left at its level.
 */
export function onHitSlotChoices(
  spellSlots: SpellSlots
): readonly { level: number; slotKey: string }[] {
  const standard = spellSlots.maxByLevel
    .filter((slot) => slot.remaining > 0)
    .map((slot) => ({ level: slot.spellLevel, slotKey: `STANDARD:${slot.spellLevel}` }))
  const pact = spellSlots.pactMagic
  return [
    ...standard,
    ...(pact && pact.remaining > 0 && !standard.some(({ level }) => level === pact.level)
      ? [{ level: pact.level, slotKey: pact.poolCode }]
      : [])
  ].sort((left, right) => left.level - right.level)
}

/**
 * The pool that pays `charge` of a resource pool cost, when exactly one resolved pool carries that
 * charge and still holds `cost` of it; any other state offers no way of paying.
 */
function onHitPoolFor(
  resources: Resources,
  { chargeId, cost }: { chargeId: string; cost: number }
): Resources[number] | null {
  const pools = resources.filter(
    (resource) => resource.chargeId === chargeId && resource.state === 'RESOLVED'
  )
  const [pool] = pools
  return pools.length === 1 && pool && pool.remaining !== null && pool.remaining >= cost
    ? pool
    : null
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
    const pool = onHitPoolFor(input.resources, cost)
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
