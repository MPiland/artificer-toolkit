import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import { measurementUnitCodeSchema } from '@artificer-toolkit/schema/shared/enums'

import type { CharacterResolvedModifierGroup } from './characterModifiers.js'
import { characterPolicyNumber, characterPolicyRecord } from './characterPolicyValues.js'

export function evaluateDnd5eCharacterMovementAndSenses(
  input: CharacterRulePolicyInput,
  grantFold: CharacterGrantFoldOutput,
  modifierGroups: CharacterResolvedModifierGroup[]
): Pick<CharacterRulePolicyOutput, 'movement' | 'senses'> {
  const matchingGroups = (valueDomainCode: string, key: string, id: string) =>
    modifierGroups.filter((group) => {
      const index = group.contributions[0]?.acceptedModifierIndex
      const grant =
        index === undefined ? {} : characterPolicyRecord(grantFold.modifiers[index]?.grant)
      return (
        group.valueDomainCode === valueDomainCode &&
        (group.modifierKind === 'BONUS' || group.modifierKind === 'PENALTY') &&
        characterPolicyRecord(grant.domain)[key] === id
      )
    })
  const calculation = (
    base: number,
    groups: CharacterResolvedModifierGroup[],
    override: { sourceId: string; value: number } | null
  ): CharacterRulePolicyOutput['derivedStats']['armorClass'] => ({
    base,
    effective: override?.value ?? base + groups.reduce((sum, group) => sum + group.effective, 0),
    contributions: groups.flatMap((group) =>
      group.contributions.map((contribution) => ({
        sourceId: contribution.sourceId,
        source: contribution.source,
        value: contribution.value,
        state: override === null ? contribution.state : 'SUPPRESSED',
        reasonCode: override === null ? contribution.reasonCode : 'SUPPRESSED_BY_OVERRIDE'
      }))
    ),
    override:
      override === null
        ? null
        : {
            sourceId: override.sourceId,
            source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: override.sourceId },
            value: override.value
          }
  })
  const speeds = (input.movementFacts?.speeds ?? []).map((speed) => {
    const resolved = calculation(
      speed.baseAmount,
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
        unit: measurementUnitCodeSchema.parse(selected === undefined ? 'FEET' : selected.unit),
        calculation: resolved
      }
    }
  })
  return { movement: { speeds, primaryMovementSpeedId }, senses }
}
