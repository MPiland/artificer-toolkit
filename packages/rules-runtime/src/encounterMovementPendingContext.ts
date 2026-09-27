import {
  isServerAggregateChoicePendingSnapshot,
  isServerKernelRuleExecutionPendingSnapshot,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { SceneTokenMovementCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'

type KernelMovementContext = Extract<
  Extract<
    ServerRuleExecutionPendingSnapshotDto,
    { snapshotKind: 'KERNEL_EVIDENCE' }
  >['applicationContext'],
  { kind: 'ENCOUNTER_SPATIAL_MOVEMENT' | 'ENCOUNTER_MOVEMENT_REACTION' }
>
type PassageContext = Extract<
  Extract<
    ServerRuleExecutionPendingSnapshotDto,
    { snapshotKind: 'AGGREGATE_CHOICE' }
  >['applicationContext'],
  { kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' }
>
type MovementContestContext = Extract<
  Extract<
    ServerRuleExecutionPendingSnapshotDto,
    { snapshotKind: 'KERNEL_EVIDENCE' }
  >['applicationContext'],
  { kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' }
> & {
  movementContinuation: NonNullable<
    Extract<
      Extract<
        ServerRuleExecutionPendingSnapshotDto,
        { snapshotKind: 'KERNEL_EVIDENCE' }
      >['applicationContext'],
      { kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' }
    >['movementContinuation']
  >
}

export type EncounterMovementPendingContext =
  | KernelMovementContext
  | PassageContext
  | MovementContestContext

/** Extract the sealed spatial root from the only pending contexts a Scene may resume. */
export function readEncounterMovementPendingContext(
  snapshot: ServerRuleExecutionPendingSnapshotDto
) {
  const context = snapshot.applicationContext
  if (
    isServerKernelRuleExecutionPendingSnapshot(snapshot) &&
    (context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
      context.kind === 'ENCOUNTER_MOVEMENT_REACTION')
  )
    return { context, root: context.root }
  if (
    isServerAggregateChoicePendingSnapshot(snapshot) &&
    context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
  )
    return { context, root: context.movement.root }
  if (
    isServerKernelRuleExecutionPendingSnapshot(snapshot) &&
    context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' &&
    context.movementContinuation
  ) {
    const narrowedContext: MovementContestContext = {
      ...context,
      movementContinuation: context.movementContinuation
    }
    return {
      context: narrowedContext,
      root: context.movementContinuation.root
    }
  }
  throw new Error('Movement response has a different pending context.')
}

/**
 * The Scene move a decision's answer continues: the sealed root's original path from its current
 * Scene version, under the answer's command ID. Convex stages it and the room plans it (D64).
 */
export function movementResponseSceneCommand(
  root: ReturnType<typeof readEncounterMovementPendingContext>['root'],
  command: Pick<ResolveRuleOccurrenceInputDto, 'commandId' | 'expectedVersion' | 'correlationId'>
): SceneTokenMovementCommandInputDto {
  return {
    type: 'MOVE_SCENE_TOKEN',
    commandId: command.commandId,
    sceneId: root.sceneId,
    tokenId: root.tokenId,
    expectedSceneVersion: root.currentSceneVersion,
    expectedEncounterVersion: command.expectedVersion,
    correlationId: command.correlationId,
    movementKind: root.movementKind,
    path: root.originalPath
  }
}
