import {
  pinnedSenseDefinitionSchema,
  type PinnedSenseDefinition
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SenseRangeDto } from '@artificer-toolkit/schema/grants/sense'
import { senseReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { lengthMeasurementInFeet } from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { SceneActorVision, SceneSenseLength } from '@artificer-toolkit/shared/vtt'

const ACTOR_SENSE_LIMIT = 100

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
 * Pins the Senses actors hold, a Character's granted ones or a Creature's authored ones, to the
 * System's published Sense definitions. Every consumer of actor Senses (Scene vision, attack and
 * turn-effect perception, movement-reaction perception) pins through it so they refuse the same
 * inputs: more than the limit, a duplicate, a Sense outside the System's vocabulary, or a
 * definition that is missing, of another family or System, or stale. Each definition is loaded and
 * validated once per pinner, so Creatures sharing a Sense do not reload it.
 */
export function createActorSensePinner(input: {
  gameSystemId: string
  loadSystem: () => Promise<{ senses: readonly { id: string }[] }>
  loadDefinition: (id: string) => Promise<ReusableDefinitionCurrentDto | null>
}) {
  let admitted: Promise<ReadonlySet<string>> | undefined
  const definitions = new Map<string, ReturnType<typeof validateDefinition>>()
  const validateDefinition = async (id: string) => {
    const current = await input.loadDefinition(id)
    if (
      !current ||
      current.definitionFamilyKey !== 'sense' ||
      current.gameSystemId !== input.gameSystemId
    )
      throw new Error('Actor Sense definition is unavailable.')
    const document = senseReusableDefinitionDocumentDtoSchema.parse(current.document)
    if (
      current.id !== id ||
      document.id !== id ||
      document.gameSystemId !== input.gameSystemId ||
      checksumRuleDocument(document) !== current.checksum
    )
      throw new Error('Actor Sense definition does not match its current version.')
    return {
      definitionVersion: current.version,
      definitionContractVersion: current.contractVersion,
      definitionChecksum: current.checksum,
      document,
      label: current.label
    }
  }
  return async (
    senses: readonly { senseDefinitionId: string; range: SenseRangeDto }[]
  ): Promise<{ pin: PinnedSenseDefinition; label: string }[]> => {
    if (senses.length > ACTOR_SENSE_LIMIT) throw new Error('Actor Sense limit exceeded.')
    if (!senses.length) return []
    admitted ??= input
      .loadSystem()
      .then(({ senses: vocabulary }) => new Set(vocabulary.map(({ id }) => id)))
    const vocabulary = await admitted
    const seen = new Set<string>()
    const pinned = []
    for (const { senseDefinitionId, range } of senses) {
      if (!vocabulary.has(senseDefinitionId) || seen.has(senseDefinitionId))
        throw new Error('Actor Sense is not a unique System vocabulary member.')
      seen.add(senseDefinitionId)
      let definition = definitions.get(senseDefinitionId)
      if (!definition) {
        definition = validateDefinition(senseDefinitionId)
        definitions.set(senseDefinitionId, definition)
      }
      const { label, ...source } = await definition
      // A Creature's authored range has no modifiers, so its calculation is the bare amount.
      const resolvedRange =
        range.rangeKind === 'DISTANCE' && !('calculation' in range)
          ? {
              ...range,
              calculation: {
                base: range.amount,
                effective: range.amount,
                contributions: [],
                override: null
              }
            }
          : range
      pinned.push({
        pin: pinnedSenseDefinitionSchema.parse({
          senseDefinitionId,
          ...source,
          range: resolvedRange
        }),
        label
      })
    }
    return pinned
  }
}

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
