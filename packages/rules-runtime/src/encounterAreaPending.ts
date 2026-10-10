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

/** The command id a settled creature's receipt is stored under; it has no command of its own. */
export function encounterAreaTargetCommandId(targetOccurrenceId: string) {
  return uuidv5(`${targetOccurrenceId}:command`, encounterAreaNamespace)
}

type AreaContext = EncounterAreaActionPendingContextDto
type AreaTarget = AreaContext['targets'][number]

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

/**
 * The GM takes one creature out of a pending area. Only a creature whose save is still unanswered can
 * go; the checksum is sealed again over those still caught.
 */
export function removeEncounterAreaTarget<
  Target extends Pick<AreaContext['targets'][number], 'actorId' | 'token'> & {
    testedJson?: string
  }
>(
  context: Pick<AreaContext, 'scene' | 'area' | 'removedActorIds'> & { targets: Target[] },
  actorId: string
):
  | { kind: 'NOT_CAUGHT' | 'ANSWERED' }
  | {
      kind: 'REMOVED'
      targets: Target[]
      removedActorIds: string[]
      caughtChecksum: string
    } {
  const removed = context.targets.find((target) => target.actorId === actorId)
  if (!removed) return { kind: 'NOT_CAUGHT' }
  if (removed.testedJson !== undefined) return { kind: 'ANSWERED' }
  const targets = context.targets.filter((target) => target !== removed)
  return {
    kind: 'REMOVED',
    targets,
    removedActorIds: [...context.removedActorIds, actorId],
    caughtChecksum: encounterAreaCaughtChecksum({
      scene: context.scene,
      area: context.area,
      caught: targets
    })
  }
}

function requireAreaContext(snapshot: ServerAggregateChoicePendingSnapshotDto) {
  const { applicationContext } = snapshot
  if (applicationContext.kind !== 'ENCOUNTER_AREA_ACTION')
    throw new Error('The snapshot is not a pending area action.')
  return applicationContext
}

/**
 * Records that the roller of the save with `requestId` answered it, keeping the answer to settle
 * the area with, and the Legendary Resistance offered if the save failed. The other saves, the
 * caught set and its checksum stay exactly as sealed.
 */
export function markEncounterAreaSaveTested(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  requestId: string,
  testedJson: string,
  legendaryResistance: AreaTarget['legendaryResistance'] | null = null
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  const answered = applicationContext.targets.find(
    (target) => target.snapshot.request.requestId === requestId
  )
  if (!answered || answered.testedJson !== undefined)
    throw new Error('This area save is not awaiting an answer.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      targets: applicationContext.targets.map((target) =>
        target === answered
          ? { ...target, testedJson, ...(legendaryResistance ? { legendaryResistance } : {}) }
          : target
      )
    }
  })
}

/**
 * Records one creature's Legendary Resistance decision on its offer; every other target, the caught
 * set and its checksum stay exactly as sealed. A creature decides once.
 */
export function markEncounterAreaLegendaryResistanceDecided(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  actorId: string,
  decided: NonNullable<AreaTarget['legendaryResistance']>
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  const offered = applicationContext.targets.find((target) => target.actorId === actorId)
  if (!offered?.legendaryResistance || offered.legendaryResistance.decision)
    throw new Error('This creature has no Legendary Resistance choice awaiting a decision.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      targets: applicationContext.targets.map((target) =>
        target === offered ? { ...target, legendaryResistance: decided } : target
      )
    }
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
