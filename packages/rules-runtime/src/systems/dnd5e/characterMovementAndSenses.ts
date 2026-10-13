import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import { lengthUnitCodeSchema } from '@artificer-toolkit/schema/shared/enums'

import type { CharacterResolvedModifierGroup } from './characterModifiers.js'
import { characterPolicyNumber, characterPolicyRecord } from './characterPolicyValues.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eFoldedModifierApplicability,
  dnd5eModifierApplies
} from './modifierApplicability.js'

export function evaluateDnd5eCharacterMovementAndSenses(
  input: CharacterRulePolicyInput,
  grantFold: CharacterGrantFoldOutput,
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
    const ranges = grantFold.senses
      .filter((sense) => sense.senseDefinitionId === senseDefinitionId)
      .flatMap((sense) => {
        const range = characterPolicyRecord(sense.range)
        if (range.rangeKind !== 'DISTANCE') return []
        return [{ id: range.id, amount: characterPolicyNumber(range.amount), unit: range.unit }]
      })
    const selected = ranges.reduce<(typeof ranges)[number] | undefined>(
      (maximum, range) =>
        maximum === undefined || range.amount > maximum.amount ? range : maximum,
      undefined
    )
    const override =
      input.senseFacts?.overrides.find((entry) => entry.senseDefinitionId === senseDefinitionId) ??
      null
    if (selected === undefined && override === null) return { senseDefinitionId, range: null }
    const resolved = calculation(
      selected?.amount ?? 0,
      matchingGroups('SENSE_RANGE', 'senseDefinitionId', senseDefinitionId),
      override
    )
    const id = override?.sourceId ?? selected?.id
    if (typeof id !== 'string') throw new Error('Character sense range identity is missing.')
    return {
      senseDefinitionId,
      range: {
        id,
        amount: resolved.effective,
        unit: lengthUnitCodeSchema.parse(selected === undefined ? 'FEET' : selected.unit),
        calculation: resolved
      }
    }
  })
  return { movement: { speeds, primaryMovementSpeedId }, senses }
}
