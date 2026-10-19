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

/**
 * The entries of a list of chosen creatures, each with the occurrence its own commit runs under. A
 * creature named again (a second dart of Magic Missile) is a further entry with an occurrence of its
 * own; its first entry keeps the id it has when named once.
 */
export function encounterChosenActorEntries(areaOccurrenceId: string, actorIds: readonly string[]) {
  const named = new Map<string, number>()
  return actorIds.map((actorId) => {
    const ordinal = named.get(actorId) ?? 0
    named.set(actorId, ordinal + 1)
    return {
      actorId,
      occurrenceId:
        ordinal === 0
          ? encounterAreaTargetOccurrenceId(areaOccurrenceId, actorId)
          : uuidv5(`${areaOccurrenceId}:${actorId}:area-save:${ordinal}`, encounterAreaNamespace)
    }
  })
}

/**
 * The occurrence id the save of a creature a forced mover struck runs under (D159). The pair names
 * it, so a creature the area also caught, or that two movers struck, keeps the ids of its other entries.
 */
export function encounterCollisionSaveOccurrenceId(
  areaOccurrenceId: string,
  moverActorId: string,
  struckActorId: string
) {
  return uuidv5(
    `${areaOccurrenceId}:${moverActorId}:${struckActorId}:collision-save`,
    encounterAreaNamespace
  )
}

/** The command id a settled creature's receipt is stored under; it has no command of its own. */
export function encounterAreaTargetCommandId(targetOccurrenceId: string) {
  return uuidv5(`${targetOccurrenceId}:command`, encounterAreaNamespace)
}

type AreaContext = EncounterAreaActionPendingContextDto
type AreaTarget = AreaContext['targets'][number]

/** Seals the creatures a chosen-creature action named, whatever order they were named in. */
export function encounterChosenActorsChecksum(actorIds: readonly string[]) {
  return checksumRuleDocument({
    chosen: [...actorIds].sort((left, right) => left.localeCompare(right))
  })
}

/**
 * Seals the Scene facts that decided who the area caught: the Scene version, the picked origin and
 * shape, and each creature still caught with its token footprint. A later change to any of them, or
 * the GM removing a creature, yields a different checksum.
 */
export function encounterAreaCaughtChecksum(input: {
  scene: AreaContext['scene']
  area: AreaContext['area']
  /** Every sealed save; a creature a forced mover struck (D159) was not caught and is left out. */
  caught: readonly Pick<AreaContext['targets'][number], 'actorId' | 'token' | 'collision'>[]
}) {
  return checksumRuleDocument({
    scene: input.scene,
    area: input.area,
    caught: input.caught
      .filter(({ collision }) => collision === undefined)
      .map(({ actorId, token }) => ({ actorId, token }))
      .sort((left, right) => left.actorId.localeCompare(right.actorId))
  })
}

/**
 * The GM takes one creature out of a pending area, with every ray aimed at it. Only a creature whose
 * rolls are all unanswered can go; the checksum is sealed again over those still caught. A creature
 * only a forced mover struck (D159) was not caught, and its save stays.
 */
export function removeEncounterAreaTarget<
  Target extends Pick<AreaContext['targets'][number], 'actorId' | 'token' | 'collision'> & {
    testedJson?: string
  }
>(
  context: Pick<AreaContext, 'scene' | 'area' | 'removedActorIds'> & {
    targets: Target[]
  },
  actorId: string
):
  | { kind: 'NOT_CAUGHT' | 'ANSWERED' }
  | {
      kind: 'REMOVED'
      targets: Target[]
      removedActorIds: string[]
      caughtChecksum: string
    } {
  const isRemoved = (target: Target) => target.actorId === actorId && target.collision === undefined
  const removed = context.targets.filter(isRemoved)
  if (removed.length === 0) return { kind: 'NOT_CAUGHT' }
  if (removed.some((target) => target.testedJson !== undefined)) return { kind: 'ANSWERED' }
  const targets = context.targets.filter((target) => !isRemoved(target))
  return {
    kind: 'REMOVED',
    targets,
    removedActorIds: [...context.removedActorIds, ...removed.map(() => actorId)],
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
 * The area snapshot with the creature taken out, or why it cannot be. The caught set is sealed
 * again, so an answer or removal composed against the earlier set is stale.
 */
export function removeEncounterAreaTargetFromSnapshot(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  actorId: string
):
  | { kind: 'NOT_CAUGHT' | 'ANSWERED' }
  | { kind: 'REMOVED'; snapshot: ServerAggregateChoicePendingSnapshotDto } {
  const applicationContext = requireAreaContext(snapshot)
  const removal = removeEncounterAreaTarget(applicationContext, actorId)
  if (removal.kind !== 'REMOVED') return removal
  return {
    kind: 'REMOVED',
    snapshot: serverAggregateChoicePendingSnapshotDtoSchema.parse({
      ...snapshot,
      applicationContext: {
        ...applicationContext,
        targets: removal.targets,
        removedActorIds: removal.removedActorIds,
        caughtChecksum: removal.caughtChecksum
      }
    })
  }
}

/**
 * An area settles once every creature it keeps has answered its save and every Legendary Resistance
 * offer is decided. An area that keeps no creature is settled.
 */
export function encounterAreaSettled(snapshot: ServerAggregateChoicePendingSnapshotDto) {
  return requireAreaContext(snapshot).targets.every(targetSettled)
}

const targetSettled = (target: AreaTarget) =>
  target.testedJson !== undefined &&
  (target.legendaryResistance === undefined || target.legendaryResistance.decision !== undefined)

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
          ? {
              ...target,
              testedJson,
              ...(legendaryResistance ? { legendaryResistance } : {})
            }
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
  // A creature a mover struck is caught twice; its choices are decided in the order they were offered.
  const offered = applicationContext.targets.find(
    (target) =>
      target.actorId === actorId &&
      target.legendaryResistance &&
      !target.legendaryResistance.decision
  )
  if (!offered)
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

type ForcedMovementPick = NonNullable<NonNullable<AreaContext['forcedMovement']>['pick']>

const sealedRays = <Ray>(rays: readonly Ray[] | undefined) => (rays?.length ? { rays } : {})

/**
 * The settled area holding the push pick it owes next (D157), after the landings picked so far. The
 * request is named for the creature, which is picked once.
 */
export function holdEncounterAreaForcedMovement(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  pick: Pick<ForcedMovementPick, 'targetActorId' | 'positions'>,
  rays?: NonNullable<NonNullable<AreaContext['forcedMovement']>['rays']>
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  if (!encounterAreaSettled(snapshot) || applicationContext.forcedMovement?.pick)
    throw new Error('Only a settled area with no pick open holds a push pick.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      forcedMovement: {
        landed: applicationContext.forcedMovement?.landed ?? [],
        // The first hold seals the rays; a later hold keeps them.
        ...sealedRays(applicationContext.forcedMovement?.rays ?? rays),
        pick: {
          requestId: `forced-movement:${pick.targetActorId}`,
          targetActorId: pick.targetActorId,
          positions: pick.positions
        }
      }
    }
  })
}

/**
 * Whether every creature the area caught has answered its save and decided its Legendary Resistance
 * offer. The saves of creatures a forced mover struck (D159) are opened after this, so they are left out.
 */
export function encounterAreaCaughtSettled(snapshot: ServerAggregateChoicePendingSnapshotDto) {
  return requireAreaContext(snapshot)
    .targets.filter(({ collision }) => !collision)
    .every(targetSettled)
}

/**
 * The settled area holding the saves of the creatures its forced movers struck (D159), after the
 * movers landed. The landings so far and the rays stay as sealed; the first hold seals the rays.
 */
export function holdEncounterAreaCollisionSaves(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  struck: readonly AreaTarget[],
  rays?: NonNullable<NonNullable<AreaContext['forcedMovement']>['rays']>
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  if (
    !encounterAreaSettled(snapshot) ||
    applicationContext.forcedMovement?.pick ||
    applicationContext.targets.some(({ collision }) => collision) ||
    struck.some(({ collision }) => !collision)
  )
    throw new Error(
      'Only a settled area with no pick or collision save open holds collision saves.'
    )
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      targets: [...applicationContext.targets, ...struck],
      forcedMovement: {
        landed: applicationContext.forcedMovement?.landed ?? [],
        ...sealedRays(applicationContext.forcedMovement?.rays ?? rays)
      }
    }
  })
}

/** The area with its open push pick answered: the creature lands on `position`, one it offered. */
export function landEncounterAreaForcedMovement(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  requestId: string,
  position: { x: number; y: number }
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  const { pick, landed = [], rays } = applicationContext.forcedMovement ?? {}
  if (
    pick?.requestId !== requestId ||
    !pick.positions.some(({ x, y }) => x === position.x && y === position.y)
  )
    throw new Error('This forced-movement destination is not on offer.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      forcedMovement: {
        landed: [...landed, { targetActorId: pick.targetActorId, position }],
        ...sealedRays(rays)
      }
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
      caughtChecksum: encounterAreaCaughtChecksum({
        ...context,
        caught: context.targets
      }),
      removedActorIds: []
    }
  })
}
