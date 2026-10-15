import { speedDtoSchema } from '@artificer-toolkit/schema/shared/speed'

import { lengthMeasurementInFeet } from '@artificer-toolkit/shared/core'

/** The System speed code the rules treat as walking, as in `characterMovementAndSenses`. */
export const WALK_SPEED_CODE = 'WALK'

/**
 * The feet of every typed speed among a Character's evaluated speeds or a creature stat block's, in
 * their given order; the first entry of a speed type wins. Publication refuses a malformed speed or
 * one outside the System speed vocabulary, so meeting one here is an invariant failure.
 */
export function resolveSpeedsFeet(
  speeds: readonly unknown[],
  speedDefinitions: readonly { id: string }[]
): { speedId: string; feet: number }[] {
  const known = new Set(speedDefinitions.map((definition) => definition.id))
  const resolved = new Map<string, number>()
  for (const entry of speeds) {
    const speed = speedDtoSchema.parse(entry)
    if (!known.has(speed.speedId))
      throw new Error(`Speed ${speed.speedId} is not in the System speed vocabulary.`)
    if (!resolved.has(speed.speedId)) resolved.set(speed.speedId, lengthMeasurementInFeet(speed))
  }
  return [...resolved].map(([speedId, feet]) => ({ speedId, feet }))
}
