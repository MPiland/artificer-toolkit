import { speedDtoSchema } from '@artificer-toolkit/schema/shared/speed'

import { lengthMeasurementInFeet } from '@artificer-toolkit/shared/core'

/** The System speed code the rules treat as walking, as in `characterMovementAndSenses`. */
export const WALK_SPEED_CODE = 'WALK'

/**
 * The feet of every typed speed among a Character's evaluated speeds or a creature stat block's
 * that the System speed vocabulary knows, in their given order; the first entry of a speed type wins.
 */
export function resolveSpeedsFeet(
  speeds: readonly unknown[],
  speedDefinitions: readonly { id: string }[]
): { speedId: string; feet: number }[] {
  const known = new Set(speedDefinitions.map((definition) => definition.id))
  const resolved = new Map<string, number>()
  for (const entry of speeds) {
    const speed = speedDtoSchema.safeParse(entry)
    if (speed.success && known.has(speed.data.speedId) && !resolved.has(speed.data.speedId))
      resolved.set(speed.data.speedId, Math.max(lengthMeasurementInFeet(speed.data), 0))
  }
  return [...resolved].map(([speedId, feet]) => ({ speedId, feet }))
}
