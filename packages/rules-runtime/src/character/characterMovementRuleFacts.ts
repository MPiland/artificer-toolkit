import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

type MovementFacts = NonNullable<CharacterRulePolicyInput['movementFacts']>

export function buildCharacterMovementRuleFacts(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): Pick<CharacterRulePolicyInput, 'movementFacts'> {
  const baseSpeeds =
    (snapshot.subraceId ?? snapshot.raceId)
      ? (registry.races[snapshot.subraceId ?? snapshot.raceId!]?.speeds ?? [])
      : []
  const adjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'MOVEMENT'
  )
  const baseById = new Map(baseSpeeds.map((speed) => [speed.speedId, speed]))
  const orderedIds = [
    ...baseSpeeds.map((speed) => speed.speedId),
    ...(registry.system?.speeds ?? [])
      .filter((speed) => adjustments.some((adjustment) => adjustment.speedId === speed.id))
      .map((speed) => speed.id),
    ...adjustments.map((adjustment) => adjustment.speedId)
  ].filter((speedId, index, all) => all.indexOf(speedId) === index)
  const speeds: MovementFacts['speeds'] = orderedIds.map((speedId) => {
    const speed = baseById.get(speedId)
    const override = adjustments.find((adjustment) => adjustment.speedId === speedId)
    return {
      speedId,
      base: speed ? { amount: speed.amount, unit: speed.unit } : null,
      override: override ? { sourceId: override.id, value: override.value } : null
    }
  })
  const preference = snapshot.movementDisplayPreference ?? { mode: 'AUTO' as const }
  return {
    movementFacts: {
      speeds,
      defaultSpeedId: registry.system?.defaults?.movementTypeId ?? null,
      preference: {
        mode: preference.mode,
        speedId: preference.mode === 'EXPLICIT' ? preference.speedId : null
      }
    }
  }
}
