import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'

import { StaleCharacterActionError } from '../encounterErrors.js'
import type { EncounterOnHitCandidate } from '../encounterOnHitChoice.js'
import type { NativeCharacterSpellConsumption } from './characterNativeActionResources.js'
import { readSpellCastSlot } from './characterSpellCastActions.js'

type SpellSlots = CharacterRulePolicyOutput['spellSlots']

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
      ? [{ level: pact.level, slotKey: 'PACT' }]
      : [])
  ].sort((left, right) => left.level - right.level)
}

/** Every way the attacker could pay for each of the action's optional on-hit riders now: one per rider and slot level. */
export function onHitCandidates(input: {
  riders: readonly { riderId: string }[]
  spellSlots: SpellSlots
}): EncounterOnHitCandidate[] {
  const choices = onHitSlotChoices(input.spellSlots)
  return input.riders.flatMap(({ riderId }) =>
    choices.map(({ level }) => ({ riderId, slotLevel: level }))
  )
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
