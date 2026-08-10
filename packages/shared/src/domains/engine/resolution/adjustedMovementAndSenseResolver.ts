import type { CharacterCalculation } from '../../character/sheetCalculation.js'
import type { EngineDerivedStats, EngineSense } from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import { resolveNumericCalculation, toCalculationOverride } from './calculationResolver.js'
import { modifierContributions, type ResolvedModifierState } from './modifierResolver.js'

export function resolveAdjustedMovement(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem,
  modifierState: ResolvedModifierState
): {
  speeds: EngineDerivedStats['movementSpeeds']
  primarySpeedId?: string
  calculations: Record<string, CharacterCalculation<number>>
} {
  const selectedRaceId = snapshot.subraceId ?? snapshot.raceId
  const baseSpeeds = selectedRaceId ? (registry.races[selectedRaceId]?.speeds ?? []) : []
  const adjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'MOVEMENT'
  )
  const orderedIds = [
    ...baseSpeeds.map((speed) => speed.speedId),
    ...(registry.system?.speeds ?? [])
      .map((speed) => speed.id)
      .filter((speedId) => adjustments.some((adjustment) => adjustment.speedId === speedId)),
    ...adjustments.map((adjustment) => adjustment.speedId)
  ].filter((speedId, index, all) => all.indexOf(speedId) === index)
  const baseById = new Map(baseSpeeds.map((speed) => [speed.speedId, speed]))
  const defaultUnit = baseSpeeds[0]?.unit ?? 'FEET'
  const calculations: Record<string, CharacterCalculation<number>> = {}
  const speeds = orderedIds.map((speedId) => {
    const baseSpeed = baseById.get(speedId)
    const override = adjustments.find((adjustment) => adjustment.speedId === speedId)
    const calculation = resolveNumericCalculation(
      baseSpeed?.amount ?? 0,
      modifierContributions(
        modifierState,
        (parsed) =>
          parsed.valueDomainCode === 'SPEED' &&
          parsed.params.speedId === speedId &&
          parsed.modifierKind !== 'SET_VALUE'
      ),
      override ? toCalculationOverride(override) : undefined
    )
    calculations[speedId] = calculation
    return {
      speedId,
      amount: calculation.effective,
      unit: baseSpeed?.unit ?? defaultUnit
    }
  })
  const speedCodes = new Map((registry.system?.speeds ?? []).map((speed) => [speed.id, speed.code]))
  const primarySpeedId = rules.selectPrimaryMovementSpeedId(
    speeds.map((speed) => ({ speedId: speed.speedId, code: speedCodes.get(speed.speedId) })),
    snapshot.movementDisplayPreference ?? { mode: 'AUTO' }
  )

  return { speeds, ...(primarySpeedId ? { primarySpeedId } : {}), calculations }
}

export function resolveAdjustedSenses(
  snapshot: CharacterBuildSnapshot,
  senses: readonly EngineSense[],
  modifierState: ResolvedModifierState
): { senses: EngineSense[]; calculations: Record<string, CharacterCalculation<number>> } {
  const adjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'SENSE'
  )
  const orderedIds = [
    ...senses.map((sense) => sense.senseCode),
    ...adjustments.map((adjustment) => adjustment.senseId)
  ].filter((senseId, index, all) => all.indexOf(senseId) === index)
  const calculations: Record<string, CharacterCalculation<number>> = {}
  const resolved = orderedIds.map((senseId) => {
    const matching = senses.filter((sense) => sense.senseCode === senseId)
    const distanceRanges = matching.flatMap((sense) =>
      sense.range?.rangeKind === 'DISTANCE' ? [sense.range] : []
    )
    const baseRange = distanceRanges.reduce(
      (best, candidate) => (candidate.amount > (best?.amount ?? -1) ? candidate : best),
      distanceRanges[0]
    )
    const override = adjustments.find((adjustment) => adjustment.senseId === senseId)
    if (!baseRange && !override) return matching[0] ?? { senseCode: senseId }

    const calculation = resolveNumericCalculation(
      baseRange?.amount ?? 0,
      modifierContributions(
        modifierState,
        (parsed) =>
          parsed.valueDomainCode === 'SENSE_RANGE' &&
          (parsed.params.senseCode === senseId || parsed.params.senseId === senseId) &&
          parsed.modifierKind !== 'SET_VALUE'
      ),
      override ? toCalculationOverride(override) : undefined
    )
    calculations[senseId] = calculation
    return {
      senseCode: senseId,
      range: {
        id: baseRange?.id ?? override?.id ?? `sense:${senseId}`,
        rangeKind: 'DISTANCE' as const,
        amount: calculation.effective,
        unit: baseRange?.unit ?? 'FEET'
      }
    }
  })

  return { senses: resolved, calculations }
}
