import { actionTargetActorId } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { contestDefenderPolicy } from '@artificer-toolkit/rules-runtime/encounterOptionalContestActionExecution'
import { readEncounterActorControl } from './actorController.js'
import { readRunActors, readRunState } from './documents.js'
import {
  projectNativeActionPending,
  readNativeActionPending,
  type NativeActionPending
} from './actionPending.js'
import { withEncounterRollModeReasons } from './rollModeReasons.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

type PendingContest = NonNullable<NativeActionPending['context']['contest']>

/** A paused contest and the participant whose evidence it awaits (null policy past its d20s). */
export type NativeContestPending = NativeActionPending & {
  contest: PendingContest
  participant: 'INITIATOR' | 'DEFENDER' | 'OUTCOME' | 'DESTINATION'
  policy: PendingContest['initiator'] | ReturnType<typeof contestDefenderPolicy> | null
  rollerActorId: string
}

/** Identifies the sealed participant, independently of the user who started the action. */
export async function readNativeContestPending(
  ctx: EncounterReadContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
): Promise<NativeContestPending> {
  const pending = await readNativeActionPending(ctx, occurrence)
  const { snapshot, context, command } = pending
  const contest = context.contest
  const origin = contest?.origin
  if (
    !contest ||
    // A Disarm seals its optional combat pin; a basic action contest is the action itself, and a
    // contested escape names the held effect and the escaper's check (D152).
    (command.type === 'ESCAPE'
      ? origin?.kind !== 'ESCAPE' ||
        origin.activeEffectId !== command.activeEffectId ||
        origin.initiatorCheckDefinitionId !== command.checkDefinitionId
      : (origin?.kind === 'OPTIONAL_COMBAT'
          ? origin.actionKind !== 'DISARM' ||
            origin.selection.kind !== 'DISARM' ||
            origin.pin.definitionId !== command.optionalCombatIntent?.definitionId ||
            origin.pin.snapshotChecksum !== snapshot.optionalCombatSnapshotChecksum
          : origin?.kind !== 'BASIC_ACTION' || command.optionalCombatIntent != null) ||
        contest.actionId !== command.actionId ||
        contest.targetActorId !== actionTargetActorId(command.target)) ||
    contest.sourceActorId !== command.actorId ||
    snapshot.request.kind !== 'INTEGER_RANGE' ||
    contest.initiator.requestNodeId !== 'initiator_d20' ||
    contest.defender.requestNodeId !== 'target_d20' ||
    context.d20Policy !== null ||
    context.twoPhase !== null ||
    snapshot.phaseReceipts !== undefined
  )
    throw new Error('Stored action contest context is invalid.')
  const onContestGraph =
    snapshot.graph.source.definitionId === contest.contestGraph.definitionId &&
    snapshot.graph.source.checksum === contest.contestGraph.checksum
  // A won basic action contest's outcome waits on its initiator's dice (D173), or its settled
  // forced movement on the initiator's destination pick (D157), both checks rolled. A won escape
  // has no outcome dice; only its holder's landing waits on a pick (MOVE-4.3).
  if (context.contestPhase === 'OUTCOME' || context.contestPhase === 'DESTINATION') {
    if (
      onContestGraph ||
      (origin?.kind !== 'BASIC_ACTION' &&
        (origin?.kind !== 'ESCAPE' || context.contestPhase !== 'DESTINATION')) ||
      contest.rollEvidence.initiator === null ||
      contest.rollEvidence.defender === null ||
      (context.contestPhase === 'DESTINATION') !== (context.pause?.kind === 'FORCED_MOVEMENT')
    )
      throw new Error('Stored action contest outcome evidence is invalid.')
    return {
      ...pending,
      contest,
      participant: context.contestPhase,
      policy: null,
      rollerActorId: contest.initiator.actorId
    }
  }
  if (!onContestGraph || snapshot.request.min !== 1 || snapshot.request.max !== 20)
    throw new Error('Stored action contest context is invalid.')
  const participant =
    snapshot.request.nodeId === 'initiator_d20'
      ? 'INITIATOR'
      : snapshot.request.nodeId === 'target_d20'
        ? 'DEFENDER'
        : null
  if (
    !participant ||
    contest.rollEvidence.defender !== null ||
    (participant === 'INITIATOR'
      ? contest.rollEvidence.initiator !== null
      : contest.rollEvidence.initiator === null)
  )
    throw new Error('Stored action contest participant evidence is invalid.')
  const policy =
    participant === 'INITIATOR' ? contest.initiator : contestDefenderPolicy(contest.defender, null)
  return { ...pending, contest, participant, policy, rollerActorId: policy.actorId }
}

/** Shared by the pending query and the response guard so their audience cannot diverge. */
export async function projectNativeContestPendingForMember(
  ctx: EncounterReadTransaction,
  run: EncounterDocument<'encounterRuns'>,
  campaign: EncounterDocument<'campaigns'>,
  membership: EncounterDocument<'campaignMemberships'>,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  const pending = await readNativeContestPending(ctx, occurrence)
  const project = () =>
    withEncounterRollModeReasons(ctx, run, membership, (reasons) =>
      projectNativeActionPending(occurrence, pending, membership.role === 'OWNER', reasons)
    )
  if (membership.role === 'OWNER') return project()
  const actor = (await readRunActors(ctx, readRunState(run))).find(
    (entry) => entry.id === pending.rollerActorId
  )
  return actor && (await readEncounterActorControl(ctx, { campaign, membership, actor }))
    ? project()
    : null
}
