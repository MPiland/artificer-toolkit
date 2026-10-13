import type { PinnedSenseDefinition } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SenseRangeDto } from '@artificer-toolkit/schema/grants/sense'
import { lengthMeasurementInFeet } from '@artificer-toolkit/shared/core'
import type { SceneActorVision, SceneSenseLength } from '@artificer-toolkit/shared/vtt'

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

/**
 * One entry per Sense the actor holds, whether a Character's granted Senses or a Creature's
 * authored ones. An unlimited range stays unlimited, as in combat perception; a distance that is
 * not a positive length has no entry.
 */
export function deriveActorSceneVision(
  actorId: string,
  pinnedSenses: readonly (Pick<PinnedSenseDefinition, 'document'> & {
    label: string
    range: SenseRangeDto
  })[]
): SceneActorVision {
  return {
    actorId,
    senses: pinnedSenses.flatMap(({ document, label, range }) => {
      const reach: SceneSenseLength =
        range.rangeKind === 'UNLIMITED'
          ? { rangeKind: 'UNLIMITED' }
          : { rangeKind: 'DISTANCE', amount: lengthMeasurementInFeet(range), unit: 'FEET' }
      if (reach.rangeKind === 'DISTANCE' && reach.amount <= 0) return []
      const { channel, illuminationAccess } = primaryCapability(document.capabilities)
      return [
        {
          channel,
          illuminationAccess,
          label,
          range: reach,
          senseId: document.id
        }
      ]
    })
  }
}
