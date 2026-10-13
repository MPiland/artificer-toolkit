import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import type { CharacterResolvedModifierGroup } from './characterModifiers.js'
import { characterPolicyRecord } from './characterPolicyValues.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eFoldedModifierApplicability,
  dnd5eModifierApplies
} from './modifierApplicability.js'

export function evaluateDnd5eCharacterMovementAndSenses(
  input: Pick<CharacterRulePolicyInput, 'movementFacts' | 'senseFacts'>,
  grantFold: Pick<CharacterGrantFoldOutput, 'senses' | 'modifiers'>,
  modifierGroups: CharacterResolvedModifierGroup[]
): Pick<CharacterRulePolicyOutput, 'movement' | 'senses'> {
  const groupDomain = (group: CharacterResolvedModifierGroup) => {
    const index = group.contributions[0]?.acceptedModifierIndex
    return characterPolicyRecord(
      characterPolicyRecord(index === undefined ? undefined : grantFold.modifiers[index]?.grant)
        .domain
    )
  }
  const matchingGroups = (valueDomainCode: string, key: string, id: string) =>
    modifierGroups.filter(
      (group) =>
        group.valueDomainCode === valueDomainCode &&
        (group.modifierKind === 'BONUS' || group.modifierKind === 'PENALTY') &&
        groupDomain(group)[key] === id
    )
  const characterWide = (groups: readonly CharacterResolvedModifierGroup[]) =>
    groups.flatMap((group) =>
      group.contributions.filter((contribution) =>
        dnd5eModifierApplies(
          dnd5eFoldedModifierApplicability(grantFold, contribution),
          DND5E_CHARACTER_WIDE_TARGET
        )
      )
    )
  /** "Your speed is X" replaces the base speed; the best applicable one wins. */
  const speedReplacements = new Map<string, number>()
  for (const group of modifierGroups) {
    if (group.valueDomainCode !== 'SPEED' || group.modifierKind !== 'SET_VALUE') continue
    const speedId = groupDomain(group).speedId
    if (typeof speedId !== 'string') continue
    for (const contribution of characterWide([group]))
      speedReplacements.set(
        speedId,
        Math.max(speedReplacements.get(speedId) ?? Number.NEGATIVE_INFINITY, contribution.value)
      )
  }
  const calculation = (
    base: number,
    groups: CharacterResolvedModifierGroup[],
    override: { sourceId: string; value: number } | null
  ): CharacterRulePolicyOutput['derivedStats']['armorClass'] => {
    const contributions = characterWide(groups)
    return {
      base,
      effective:
        override?.value ??
        base +
          contributions
            .filter((contribution) => contribution.state === 'APPLIED')
            .reduce((sum, contribution) => sum + contribution.value, 0),
      contributions: contributions.map((contribution) => ({
        sourceId: contribution.sourceId,
        source: contribution.source,
        value: contribution.value,
        state: override === null ? contribution.state : 'SUPPRESSED',
        reasonCode: override === null ? contribution.reasonCode : 'SUPPRESSED_BY_OVERRIDE'
      })),
      override:
        override === null
          ? null
          : {
              sourceId: override.sourceId,
              source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: override.sourceId },
              value: override.value
            }
    }
  }
  const factSpeeds = input.movementFacts?.speeds ?? []
  const speeds = [
    ...factSpeeds,
    ...[...speedReplacements.keys()]
      .filter((speedId) => !factSpeeds.some((speed) => speed.speedId === speedId))
      .map((speedId) => ({ speedId, baseAmount: 0, unit: 'FEET' as const, override: null }))
  ].map((speed) => {
    const resolved = calculation(
      speedReplacements.get(speed.speedId) ?? speed.baseAmount,
      matchingGroups('SPEED', 'speedId', speed.speedId),
      speed.override
    )
    return {
      speedId: speed.speedId,
      amount: resolved.effective,
      unit: speed.unit,
      calculation: resolved
    }
  })
  const preference = input.movementFacts?.preference
  const primaryMovementSpeedId =
    preference?.mode === 'EXPLICIT' && speeds.some((speed) => speed.speedId === preference.speedId)
      ? preference.speedId
      : (input.movementFacts?.speeds.find((speed) => speed.code === 'WALK')?.speedId ??
        speeds[0]?.speedId ??
        null)
  const senseIds = [
    ...new Set([
      ...grantFold.senses.map((sense) => sense.senseDefinitionId),
      ...(input.senseFacts?.overrides ?? []).map((override) => override.senseDefinitionId)
    ])
  ]
  const senses = senseIds.map((senseDefinitionId): CharacterRulePolicyOutput['senses'][number] => {
    const grantedRanges = grantFold.senses
      .filter((sense) => sense.senseDefinitionId === senseDefinitionId)
      .map((sense) => sense.range)
    const override =
      input.senseFacts?.overrides.find((entry) => entry.senseDefinitionId === senseDefinitionId) ??
      null
    const unlimited = grantedRanges.find((range) => range.rangeKind === 'UNLIMITED')
    const distances = grantedRanges.filter((range) => range.rangeKind === 'DISTANCE')
    const widest = distances.reduce<(typeof distances)[number] | undefined>(
      (maximum, range) =>
        maximum === undefined || range.amount > maximum.amount ? range : maximum,
      undefined
    )
    const modifiers = matchingGroups('SENSE_RANGE', 'senseDefinitionId', senseDefinitionId)
    if (override !== null) {
      // A Sheet override sets the distance outright; with no granted distance it is its own base.
      const resolved = calculation(widest?.amount ?? override.value, modifiers, override)
      return {
        senseDefinitionId,
        range: {
          id: override.sourceId,
          rangeKind: 'DISTANCE',
          amount: resolved.effective,
          unit: override.unit,
          calculation: resolved
        }
      }
    }
    if (unlimited !== undefined) return { senseDefinitionId, range: unlimited }
    if (widest === undefined) throw new Error('A Character sense needs a granted range.')
    const resolved = calculation(widest.amount, modifiers, null)
    return {
      senseDefinitionId,
      range: {
        id: widest.id,
        rangeKind: 'DISTANCE',
        amount: resolved.effective,
        unit: widest.unit,
        calculation: resolved
      }
    }
  })
  return { movement: { speeds, primaryMovementSpeedId }, senses }
}
