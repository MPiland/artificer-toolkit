import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { EncounterActionPauseDto } from '@artificer-toolkit/schema/shared/encounterPause'
import type { EncounterSettledIncomingGateDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  PendingNativeActionGraphs,
  ResumedNativeActionGraphs
} from './encounterActionExecution.js'

/**
 * The child action of each reaction chosen against a pending action (D219), with the roll mode it
 * imposed on the action's roll once the action resumed from it.
 */
export type PendingReactionChildren = NonNullable<
  Extract<
    ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
    { kind: 'ENCOUNTER_ACTION' }
  >['reactionChildren']
>

/**
 * Whether one of the given creatures reacted under a reaction child the pending action still awaits
 * (D219): one whose outcome the resume that follows its commit has not written yet. Such a creature
 * stands as that child's tree left it: the Run moved only by those actions, each of which held its
 * own creatures to its own currentness until it committed.
 */
export const reactedUnderAwaitedChild = (
  recorded: readonly { commandId: string; resumeOutcome?: unknown }[] | undefined,
  committed: readonly {
    commandId: string
    reactorActorId: string
    descendantReactorActorIds: readonly string[]
  }[],
  actorIds: readonly string[]
) =>
  committed.some(
    (child) =>
      recorded?.some(
        ({ commandId, resumeOutcome }) =>
          commandId === child.commandId && resumeOutcome === undefined
      ) &&
      [child.reactorActorId, ...child.descendantReactorActorIds].some((actorId) =>
        actorIds.includes(actorId)
      )
  )

/**
 * The reaction children a pending action records, with the level it casts its spell at and the slot
 * that cast spends beside them: a child reads the cast it answers from its held action's context
 * (D219).
 */
const recordedReactionChildren = (
  input: PendingCast & { reactionChildren?: PendingReactionChildren }
) =>
  input.reactionChildren?.length
    ? {
        reactionChildren: [...input.reactionChildren],
        ...(typeof input.castLevel === 'number' && { castLevel: input.castLevel }),
        ...(typeof input.castSlotKey === 'string' && { castSlotKey: input.castSlotKey })
      }
    : {}

/** The cast of an action that records reaction children. */
type PendingCast = {
  /** The level the action casts its spell at; null when it casts none. */
  castLevel?: number | null
  /** The spell slot that cast spends when the action commits; null when it spends none. */
  castSlotKey?: string | null
}

/** The kernel request a sealed snapshot waits on, without the application's wrapping. */
export function pendingSnapshotContinuation(
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
): ServerRuleExecutionContinuationDto {
  const {
    snapshotKind: _snapshotKind,
    applicationContext: _applicationContext,
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    phaseReceipts: _phaseReceipts,
    deferredCleaving: _deferredCleaving,
    ...continuation
  } = snapshot
  return continuation
}

/** The paused request a sealed snapshot holds, restored so its roller's answer can resume it. */
export function restoreEncounterActionPending(
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
): ResumedNativeActionGraphs {
  const { applicationContext: context, phaseReceipts } = snapshot
  if (context.kind !== 'ENCOUNTER_ACTION')
    throw new Error('The pending action snapshot is invalid.')
  // A held cast, ward or retarget pauses before the graphs run, so the graphs resume none of them. A
  // hit's reaction offer (D219) is not resumed either: its host answers it, and the graphs rebuild
  // the TEST from the roll the offer keeps.
  const { pause } = context
  const graphPause =
    pause?.kind === 'ROLL_WINDOW' ||
    pause?.kind === 'LEGENDARY_RESISTANCE' ||
    pause?.kind === 'ON_HIT' ||
    pause?.kind === 'FORCED_MOVEMENT'
      ? pause
      : null
  return {
    kind: 'PENDING',
    continuation: pendingSnapshotContinuation(snapshot),
    d20Policy: context.d20Policy,
    twoPhase: context.twoPhase,
    ...(context.d20Belief ? { d20Belief: context.d20Belief } : {}),
    ...(context.heldD20 ? { heldD20: context.heldD20 } : {}),
    ...(graphPause ? { pause: graphPause } : {}),
    ...(phaseReceipts ? { phaseReceipts } : {})
  }
}

/**
 * The sealed pending snapshot of one paused action request: the kernel continuation with the
 * application context that lets its roller's answer resume it.
 */
export function buildEncounterActionPendingSnapshot(
  input: PendingCast & {
    execution: PendingNativeActionGraphs
    optionalCombatSnapshotChecksum: string | null | undefined
    commandJson: string
    commandFingerprint: string
    initiatorUserId: string
    sourceActorId: string
    targetActorId: string
    currentnessChecksum: string
    passedIncomingGate?: EncounterSettledIncomingGateDto
    reactionChildren?: PendingReactionChildren
  }
): ServerKernelRuleExecutionPendingSnapshotDto {
  const { execution } = input
  return {
    ...execution.continuation,
    snapshotKind: 'KERNEL_EVIDENCE',
    optionalCombatSnapshotChecksum: input.optionalCombatSnapshotChecksum,
    applicationContext: {
      kind: 'ENCOUNTER_ACTION',
      schemaVersion: 1,
      commandJson: input.commandJson,
      commandFingerprint: input.commandFingerprint,
      initiatorUserId: input.initiatorUserId,
      // The offer a rolled d20 or a hit holds for a creature that may react to it is answered by that
      // creature, not the roller (D219).
      rollerActorId:
        (execution.pause?.kind === 'CAST_REACTION' &&
          execution.pause.payload.reactions[0]?.reactorActorId) ||
        (execution.roller === 'SOURCE' ? input.sourceActorId : input.targetActorId),
      currentnessChecksum: input.currentnessChecksum,
      d20Policy: execution.d20Policy,
      twoPhase: execution.twoPhase,
      ...(execution.d20Belief ? { d20Belief: execution.d20Belief } : {}),
      ...(execution.heldD20 ? { heldD20: execution.heldD20 } : {}),
      ...(execution.pause ? { pause: execution.pause } : {}),
      ...(input.passedIncomingGate ? { passedIncomingGate: input.passedIncomingGate } : {}),
      ...recordedReactionChildren(input)
    },
    ...(execution.phaseReceipts ? { phaseReceipts: execution.phaseReceipts } : {})
  }
}

/**
 * The sealed pending snapshot of an action held before it executes: a cast waiting on a creature's
 * chance to counter it, a source owing the roll of its incoming gate, or an action a ward
 * stopped waiting on its attacker's choice to turn it on another creature. The continuation is the
 * pause; the action itself is not held, it replays from the command once the pause is answered.
 */
export function buildEncounterHeldActionPendingSnapshot(
  input: PendingCast & {
    continuation: ServerRuleExecutionContinuationDto
    pause: Extract<
      EncounterActionPauseDto,
      { kind: 'CAST_REACTION' | 'INCOMING_GATE' | 'ATTACK_RETARGET' }
    >
    rollerActorId: string
    optionalCombatSnapshotChecksum: string | null | undefined
    commandJson: string
    commandFingerprint: string
    initiatorUserId: string
    currentnessChecksum: string
    passedIncomingGate?: EncounterSettledIncomingGateDto
    reactionChildren?: PendingReactionChildren
  }
): ServerKernelRuleExecutionPendingSnapshotDto {
  return {
    ...input.continuation,
    snapshotKind: 'KERNEL_EVIDENCE',
    optionalCombatSnapshotChecksum: input.optionalCombatSnapshotChecksum,
    applicationContext: {
      kind: 'ENCOUNTER_ACTION',
      schemaVersion: 1,
      commandJson: input.commandJson,
      commandFingerprint: input.commandFingerprint,
      initiatorUserId: input.initiatorUserId,
      rollerActorId: input.rollerActorId,
      currentnessChecksum: input.currentnessChecksum,
      d20Policy: null,
      twoPhase: null,
      pause: input.pause,
      ...(input.passedIncomingGate ? { passedIncomingGate: input.passedIncomingGate } : {}),
      ...recordedReactionChildren(input)
    }
  }
}
