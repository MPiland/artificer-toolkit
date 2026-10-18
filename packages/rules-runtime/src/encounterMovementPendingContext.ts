import {
  isServerAggregateChoicePendingSnapshot,
  isServerKernelRuleExecutionPendingSnapshot,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
type ContestCheckContext = Extract<
  Extract<
    ServerRuleExecutionPendingSnapshotDto,
    { snapshotKind: 'KERNEL_EVIDENCE' }
  >['applicationContext'],
  { kind: 'ENCOUNTER_CONTEST_CHECK' }
>
type MovementContestOrigin = Extract<ContestCheckContext['origin'], { kind: 'OPTIONAL_COMBAT' }>
type MovementContestContext = ContestCheckContext & {
  origin: MovementContestOrigin & {
    movementContinuation: NonNullable<MovementContestOrigin['movementContinuation']>
  }
}

/** The move a contest check interrupts, or null when it interrupts none. */
export function contestCheckMovementContinuation(context: ContestCheckContext) {
  return context.origin.kind === 'OPTIONAL_COMBAT'
    ? (context.origin.movementContinuation ?? null)
    : null
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
    context.kind === 'ENCOUNTER_CONTEST_CHECK' &&
    context.origin.kind === 'OPTIONAL_COMBAT' &&
    context.origin.movementContinuation
  ) {
    const narrowedContext: MovementContestContext = {
      ...context,
      origin: { ...context.origin, movementContinuation: context.origin.movementContinuation }
    }
    return {
      context: narrowedContext,
      root: context.origin.movementContinuation.root
    }
  }
  throw new Error('Movement response has a different pending context.')
}
