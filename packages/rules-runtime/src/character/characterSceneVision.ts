import type { PinnedSenseDefinition } from '@artificer-toolkit/schema/projections/characterMechanics'
import { lengthMeasurementInFeet } from '@artificer-toolkit/shared/core'
import type { SceneCharacterVision } from '@artificer-toolkit/shared/vtt'

const ACCESS_GRADE_RANK = { DETECTED: 0, LOCATED: 1, PRECISE: 2 } as const
const ILLUMINATION_ACCESS_RANK = {
  BRIGHT_ONLY: 0,
  DIM: 1,
  ORDINARY_DARKNESS: 2,
  MAGICAL_DARKNESS: 3,
  IGNORE: 4
} as const

type Capability = PinnedSenseDefinition['document']['capabilities'][number]

/**
 * A sense with several capabilities presents its strongest one: the highest access grade, then the
 * widest illumination access, then the first listed. The token only displays; combat perception
 * reads every capability from the pinned definition itself.
 */
function primaryCapability(capabilities: readonly Capability[]): Capability {
  return capabilities.reduce((best, capability) =>
    ACCESS_GRADE_RANK[capability.accessGrade] > ACCESS_GRADE_RANK[best.accessGrade] ||
    (capability.accessGrade === best.accessGrade &&
      ILLUMINATION_ACCESS_RANK[capability.illuminationAccess] >
        ILLUMINATION_ACCESS_RANK[best.illuminationAccess])
      ? capability
      : best
  )
}

/** One entry per ranged Sense the Character holds; a range that is not a positive length has none. */
export function deriveCharacterSceneVision(
  characterId: string,
  pinnedSenses: readonly (Pick<PinnedSenseDefinition, 'document' | 'range'> & { label: string })[]
): SceneCharacterVision {
  return {
    characterId,
    senses: pinnedSenses.flatMap(({ document, label, range }) => {
      if (!range) return []
      const feet = lengthMeasurementInFeet(range)
      if (feet <= 0) return []
      const { channel, illuminationAccess } = primaryCapability(document.capabilities)
      return [
        {
          channel,
          illuminationAccess,
          label,
          range: { amount: feet, unit: 'FEET' },
          senseId: document.id
        }
      ]
    })
  }
}
