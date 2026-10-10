import { readEncounterActorControl } from './actorController.js'
import { readRunActors, readRunState } from './documents.js'
import { projectNativeActionPending, readNativeActionPending } from './actionPending.js'
import { withEncounterRollModeReasons } from './rollModeReasons.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/** Identifies the sealed participant, independently of the user who started the action. */
export async function readNativeDisarmPending(
  ctx: EncounterReadContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  const pending = await readNativeActionPending(ctx, occurrence)
  const { snapshot, context, command } = pending
  const contest = context.contest
  if (
    !contest ||
    contest.actionKind !== 'DISARM' ||
    contest.selection.kind !== 'DISARM' ||
    contest.actionId !== command.actionId ||
    contest.sourceActorId !== command.actorId ||
    contest.targetActorId !== command.target.actorId ||
    contest.optionalCombat.definitionId !== command.optionalCombatIntent?.definitionId ||
    contest.optionalCombat.snapshotChecksum !== snapshot.optionalCombatSnapshotChecksum ||
    snapshot.graph.source.definitionId !== contest.contestGraph.definitionId ||
    snapshot.graph.source.checksum !== contest.contestGraph.checksum ||
    snapshot.request.kind !== 'INTEGER_RANGE' ||
    snapshot.request.min !== 1 ||
    snapshot.request.max !== 20 ||
    contest.initiator.requestNodeId !== 'initiator_d20' ||
    contest.defender.requestNodeId !== 'target_d20' ||
    context.d20Policy !== null ||
    context.twoPhase !== null ||
    snapshot.phaseReceipts !== undefined
  )
    throw new Error('Stored Disarm context is invalid.')
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
    throw new Error('Stored Disarm participant evidence is invalid.')
  const policy = participant === 'INITIATOR' ? contest.initiator : contest.defender
  return { ...pending, contest, participant, policy }
}

/** Shared by the pending query and the response guard so their audience cannot diverge. */
export async function projectNativeDisarmPendingForMember(
  ctx: EncounterReadTransaction,
  run: EncounterDocument<'encounterRuns'>,
  campaign: EncounterDocument<'campaigns'>,
  membership: EncounterDocument<'campaignMemberships'>,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  const pending = await readNativeDisarmPending(ctx, occurrence)
  const project = () =>
    withEncounterRollModeReasons(ctx, run, membership, (reasons) =>
      projectNativeActionPending(occurrence, pending, membership.role === 'OWNER', reasons)
    )
  if (membership.role === 'OWNER') return project()
  const actor = (await readRunActors(ctx, readRunState(run))).find(
    (entry) => entry.id === pending.policy.actorId
  )
  return actor && (await readEncounterActorControl(ctx, { campaign, membership, actor }))
    ? project()
    : null
}
