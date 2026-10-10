import { v5 as uuidv5 } from 'uuid'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  type EncounterAreaActionPendingContextDto,
  type ServerAggregateChoicePendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const encounterAreaNamespace = '6f1c7a3e-5b0d-4d0a-9d52-3c7e8b1a2f64'

/**
 * The occurrence id one caught creature's sealed save runs under. Kernel request ids are built from the
 * occurrence id, so every creature of one area needs its own to keep its request ids apart.
 */
export function encounterAreaTargetOccurrenceId(areaOccurrenceId: string, actorId: string) {
  return uuidv5(`${areaOccurrenceId}:${actorId}:area-save`, encounterAreaNamespace)
}

type AreaContext = EncounterAreaActionPendingContextDto

/**
 * Seals the Scene facts that decided who the area caught: the Scene version, the picked origin and
 * shape, and each creature still caught with its token footprint. A later change to any of them, or
 * the GM removing a creature, yields a different checksum.
 */
export function encounterAreaCaughtChecksum(input: {
  scene: AreaContext['scene']
  area: AreaContext['area']
  caught: readonly Pick<AreaContext['targets'][number], 'actorId' | 'token'>[]
}) {
  return checksumRuleDocument({
    scene: input.scene,
    area: input.area,
    caught: input.caught
      .map(({ actorId, token }) => ({ actorId, token }))
      .sort((left, right) => left.actorId.localeCompare(right.actorId))
  })
}

/** The pending occurrence of a point-area action: one sealed save per caught creature. */
export function buildEncounterAreaPendingSnapshot(
  input: Omit<AreaContext, 'kind' | 'schemaVersion' | 'caughtChecksum' | 'removedActorIds'> & {
    occurrenceId: string
    optionalCombatSnapshotChecksum: string | null | undefined
  }
): ServerAggregateChoicePendingSnapshotDto {
  const { occurrenceId, optionalCombatSnapshotChecksum, ...context } = input
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    snapshotKind: 'AGGREGATE_CHOICE',
    schemaVersion: 1,
    occurrenceId,
    optionalCombatSnapshotChecksum,
    applicationContext: {
      ...context,
      kind: 'ENCOUNTER_AREA_ACTION',
      schemaVersion: 1,
      caughtChecksum: encounterAreaCaughtChecksum({ ...context, caught: context.targets }),
      removedActorIds: []
    }
  })
}
