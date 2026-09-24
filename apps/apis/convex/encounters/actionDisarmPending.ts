import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readCampaignAssignedCharacter } from '../campaigns/assignedCharacter'
import { readRunActors, readRunState } from './documents'
import { projectNativeActionPending, readNativeActionPending } from './actionPending'

/** Identifies the sealed participant, independently of the user who started the action. */
export function readNativeDisarmPending(occurrence: Doc<'encounterRuleOccurrences'>) {
  const pending = readNativeActionPending(occurrence)
  const { snapshot, context, command } = pending
  const contest = context.contest
  if (
    !contest ||
    contest.actionKind !== 'DISARM' ||
    contest.selection.kind !== 'DISARM' ||
    contest.actionId !== command.actionId ||
    contest.sourceActorId !== command.actorId ||
    contest.targetActorId !== command.targetActorId ||
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
  const controllerCharacterId =
    participant === 'INITIATOR'
      ? contest.initiatorControllerCharacterId
      : contest.target.kind === 'CHARACTER'
        ? contest.target.characterId
        : null
  return { ...pending, contest, participant, policy, controllerCharacterId }
}

/** Shared by the pending query and the response guard so their audience cannot diverge. */
export async function projectNativeDisarmPendingForMember(
  ctx: QueryCtx,
  run: Doc<'encounterRuns'>,
  campaign: Doc<'campaigns'>,
  membership: Doc<'campaignMemberships'>,
  occurrence: Doc<'encounterRuleOccurrences'>
) {
  const pending = readNativeDisarmPending(occurrence)
  if (membership.role === 'OWNER') return projectNativeActionPending(occurrence)
  const assigned = await readCampaignAssignedCharacter(ctx, campaign, membership)
  const actor = (await readRunActors(ctx, readRunState(run))).find(
    (entry) => entry.id === pending.policy.actorId
  )
  return assigned &&
    assigned.id === pending.controllerCharacterId &&
    actor?.kind === 'CHARACTER' &&
    actor.sourceId === assigned.id
    ? projectNativeActionPending(occurrence)
    : null
}
