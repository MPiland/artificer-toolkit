import { speedDtoSchema } from '@artificer-toolkit/schema/shared/speed'

import { lengthInFeet } from './character/characterSceneVision.js'

/** The System speed code the rules treat as walking, as in `characterMovementAndSenses`. */
export const WALK_SPEED_CODE = 'WALK'

/**
 * The walking speed in feet among typed speeds (a Character's evaluated speeds or a creature stat
 * block's), found through the System speed vocabulary; 0 when there is none.
 */
export function resolveWalkingSpeedFeet(
  speeds: readonly unknown[],
  speedDefinitions: readonly { id: string; code: string | null }[]
): number {
  const walkSpeedIds = new Set(
    speedDefinitions
      .filter((definition) => definition.code === WALK_SPEED_CODE)
      .map((definition) => definition.id)
  )
  for (const entry of speeds) {
    const speed = speedDtoSchema.safeParse(entry)
    if (speed.success && walkSpeedIds.has(speed.data.speedId))
      return Math.max(lengthInFeet(speed.data) ?? 0, 0)
  }
  return 0
}
