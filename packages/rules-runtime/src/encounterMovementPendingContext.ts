import {
  isServerAggregateChoicePendingSnapshot,
  isServerKernelRuleExecutionPendingSnapshot,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
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
