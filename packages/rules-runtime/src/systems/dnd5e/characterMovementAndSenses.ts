import {
  feetInLengthUnit,
  lengthMeasurementInFeet,
  type LengthUnitCode
} from '@artificer-toolkit/shared/core'
import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { lengthInUnit, speedAfterFractions, widestLengthByKey } from '../../modifierLength.js'
import type { CharacterResolvedModifierGroup } from './characterModifiers.js'
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
    return (index === undefined ? undefined : grantFold.modifiers[index]?.domain) ?? {}
  }
  const matchingGroups = (
    valueDomainCode: string,
    key: 'speedId' | 'senseDefinitionId',
    id: string
  ) =>
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
  /** "Your speed is X" replaces the base speed; the best applicable one wins, in its authored unit. */
  const speedReplacements = widestLengthByKey(
    modifierGroups
      .filter((group) => group.valueDomainCode === 'SPEED' && group.modifierKind === 'SET_VALUE')
      .flatMap((group) => {
        const speedId = groupDomain(group).speedId
        return speedId === undefined
          ? []
          : characterWide([group]).map((contribution) => ({
              key: speedId,
              payload: grantFold.modifiers[contribution.acceptedModifierIndex]?.payload
            }))
      })
  )
  /**
   * Speed and sense range contributions are feet; they add to the base in the base's own unit. A
   * total never falls below 0, as a Creature's speed does not.
   */
  const calculation = (
    base: number,
    unit: LengthUnitCode,
    groups: CharacterResolvedModifierGroup[],
    override: { sourceId: string; value: number } | null
  ): CharacterRulePolicyOutput['derivedStats']['armorClass'] => {
    const contributions = characterWide(groups).map((contribution) => ({
      ...contribution,
      value: feetInLengthUnit(contribution.value, unit)
    }))
    return {
      base,
      effective: Math.max(
        0,
        override?.value ??
          base +
            contributions
              .filter((contribution) => contribution.state === 'APPLIED')
              .reduce((sum, contribution) => sum + contribution.value, 0)
      ),
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
  /** "Your speed is multiplied by n/d" grants, each for one speed or, with none named, for every speed. */
  const speedFractions = modifierGroups
    .filter((group) => group.valueDomainCode === 'SPEED' && group.modifierKind === 'MULTIPLY')
    .flatMap((group) => {
      const speedId = groupDomain(group).speedId
      return characterWide([group]).map((contribution) => ({
        speedId: speedId ?? null,
        contribution,
        payload: grantFold.modifiers[contribution.acceptedModifierIndex]?.payload
      }))
    })
  const factSpeeds = input.movementFacts?.speeds ?? []
  const speeds = [
    ...factSpeeds.map(({ speedId, base, override }) => {
      // A speed is in its base's unit, or in its override's own unit when the Character has no base.
      const length = base ?? override?.value
      if (length === undefined) throw new Error('A Character speed needs a base or an override.')
      return { speedId, base: length, override }
    }),
    ...[...speedReplacements]
      .filter(([speedId]) => !factSpeeds.some((speed) => speed.speedId === speedId))
      .map(([speedId, base]) => ({ speedId, base, override: null }))
  ].map(({ speedId, base, override }) => {
    const replacement = speedReplacements.get(speedId)
    const resolved = calculation(
      replacement === undefined ? base.amount : lengthInUnit(replacement, base.unit),
      base.unit,
      matchingGroups('SPEED', 'speedId', speedId),
      override === null
        ? null
        : { sourceId: override.sourceId, value: lengthInUnit(override.value, base.unit) }
    )
    // A manual override is the speed itself, so no fraction applies to it.
    const fractions =
      override === null
        ? speedFractions.filter(
            (fraction) => fraction.speedId === null || fraction.speedId === speedId
          )
        : []
    let running = resolved.effective
    const fractionContributions = fractions.map(({ contribution }, index) => {
      const next = speedAfterFractions(
        resolved.effective,
        fractions.slice(0, index + 1).map(({ payload }) => payload)
      )
      const value = next - running
      running = next
      return {
        sourceId: contribution.sourceId,
        source: contribution.source,
        value,
        state: contribution.state,
        reasonCode: contribution.reasonCode
      }
    })
    return {
      speedId,
      amount: running,
      unit: base.unit,
      calculation: {
        ...resolved,
        effective: running,
        contributions: [...resolved.contributions, ...fractionContributions]
      }
    }
  })
  const preference = input.movementFacts?.preference
  const primaryMovementSpeedId =
    preference?.mode === 'EXPLICIT' && speeds.some((speed) => speed.speedId === preference.speedId)
      ? preference.speedId
      : ((
          speeds.find((speed) => speed.speedId === input.movementFacts?.defaultSpeedId) ?? speeds[0]
        )?.speedId ?? null)
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
        maximum === undefined || lengthMeasurementInFeet(range) > lengthMeasurementInFeet(maximum)
          ? range
          : maximum,
      undefined
    )
    const modifiers = matchingGroups('SENSE_RANGE', 'senseDefinitionId', senseDefinitionId)
    if (override !== null) {
      // A Sheet override sets the distance outright, in the widest grant's unit (its own with no grant).
      const unit = widest?.unit ?? override.value.unit
      const amount = feetInLengthUnit(lengthMeasurementInFeet(override.value), unit)
      const resolved = calculation(widest?.amount ?? amount, unit, modifiers, {
        sourceId: override.sourceId,
        value: amount
      })
      return {
        senseDefinitionId,
        range: {
          id: override.sourceId,
          rangeKind: 'DISTANCE',
          amount: resolved.effective,
          unit,
          calculation: resolved
        }
      }
    }
    if (unlimited !== undefined) return { senseDefinitionId, range: unlimited }
    if (widest === undefined) throw new Error('A Character sense needs a granted range.')
    const resolved = calculation(widest.amount, widest.unit, modifiers, null)
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
