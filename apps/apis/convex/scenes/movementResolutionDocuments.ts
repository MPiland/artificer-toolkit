import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { SceneStoredGeometrySave } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { movementRuleResolutionCommandDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { isServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'
import { serverRuleExecutionPendingOccurrenceId } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { readEncounterControlledActorIds } from '../encounters/actorController'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readRunActor, readRunState } from '../encounters/documents'
import {
  readStoredPendingSnapshot,
  storedPendingSnapshotChecksum
} from '../encounters/pendingSnapshots'
import {
  assertGeometryReceiving,
  readGeometrySave,
  readMovementResolution
} from './geometryDocuments'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { readEncounterSettledAppRoll } from '../encounters/evidenceRolls'
import { rejectDomain } from '../lib/domainRejections'

export type Geometry = {
  sceneTokens: readonly SceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
}

export async function readResponse(ctx: MutationCtx, saveId: string, geometry: Geometry) {
  const { save, header, userId } = await readGeometrySave(ctx, saveId)
  assertGeometryReceiving(save, header.version, userId)
  const current = await assertMovementResolutionCurrent(ctx, save)
  const root = current.root
  const token = geometry.sceneTokens.find((entry) => entry.id === root.tokenId)
  if (
    !token ||
    token.locked ||
    !geometry.actorIdByTokenId.has(root.tokenId) ||
    checksumCanonicalJson(token.position) !== checksumCanonicalJson(root.currentPosition)
  )
    throw new Error('Movement response token is stale.')
  const responseCommand = movementRuleResolutionCommandDtoSchema.parse({
    commandId: current.command.commandId,
    commandFingerprint: checksumCanonicalJson(current.command),
    actorUserId: userId,
    correlationId: current.command.correlationId,
    expectedOccurrenceVersion: current.command.expectedOccurrenceVersion,
    kind: current.command.resolution.kind,
    ...('requestId' in current.command.resolution
      ? { requestId: current.command.resolution.requestId }
      : {}),
    ...('optionId' in current.command.resolution
      ? { optionId: current.command.resolution.optionId }
      : {})
  })
  if (root.resolutionCommands.some((entry) => entry.commandId === responseCommand.commandId))
    throw new Error('Movement response command was already used.')
  return { save, current, root, token, responseCommand }
}

/** Response authority belongs to the issued decision, independently of the movement initiator. */
export async function readMovementResponseAuthority(
  ctx: QueryCtx,
  command: ResolveRuleOccurrenceInputDto
) {
  const { userId } = await requireIdentity(ctx)
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', command.encounterId))
    .unique()
  if (!run) throw new Error('Movement Encounter is unavailable.')
  const state = readRunState(run)
  const { campaign, membership } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (
    campaign.status !== 'ACTIVE' ||
    campaign.gameSystemId !== state.gameSystemId ||
    state.status !== 'ACTIVE' ||
    state.version !== command.expectedVersion
  )
    throw new Error('Movement response Encounter scope is stale.')
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', command.occurrenceId))
    .unique()
  if (!occurrence) throw new Error('Movement occurrence is unavailable.')
  const { _id, _creationTime, ...stored } = occurrence
  encounterStoredRuleOccurrenceSchema.parse(stored)
  if (
    occurrence.campaignId !== campaign.id ||
    occurrence.encounterId !== state.id ||
    occurrence.state !== 'PENDING' ||
    occurrence.version !== command.expectedOccurrenceVersion ||
    occurrence.expectedEncounterVersion !== state.version ||
    !occurrence.pendingSnapshotJson ||
    !occurrence.pendingSnapshotChecksum
  )
    throw new Error('Movement response occurrence is stale.')
  const snapshot = readStoredPendingSnapshot(occurrence)!
  const { context, root } = readEncounterMovementPendingContext(snapshot)
  const kernelSnapshot = isServerKernelRuleExecutionPendingSnapshot(snapshot) ? snapshot : null
  if (
    (context.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' && !kernelSnapshot) ||
    storedPendingSnapshotChecksum(occurrence) !== occurrence.pendingSnapshotChecksum ||
    serverRuleExecutionPendingOccurrenceId(snapshot) !== occurrence.id ||
    root.encounterId !== state.id ||
    root.commandId !== occurrence.rootCommandId ||
    root.resolutionCommands.length !== occurrence.version ||
    (snapshot.optionalCombatSnapshotChecksum ?? null) !== state.optionalCombatSnapshotChecksum
  )
    throw new Error('Stored movement response evidence is inconsistent.')
  let decisionActorIds: string[]
  if (context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE') {
    decisionActorIds = [context.sourceActorId]
  } else if (context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST') {
    if (!kernelSnapshot) throw new Error('Stored movement response evidence is inconsistent.')
    const participantActorId =
      kernelSnapshot.request.nodeId === context.initiator.requestNodeId
        ? context.sourceActorId
        : kernelSnapshot.request.nodeId === context.defender.requestNodeId
          ? context.targetActorId
          : null
    if (!participantActorId) throw new Error('Movement passage participant is unavailable.')
    decisionActorIds = [participantActorId]
  } else if (context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT') {
    decisionActorIds = [context.currentCandidate.candidate.targetActorId]
  } else if (context.phase.kind === 'CONCENTRATION_EVIDENCE') {
    decisionActorIds = [context.phase.concentration.application.targetActorId]
  } else if (context.phase.kind === 'SPATIAL_EVIDENCE') {
    decisionActorIds = [context.phase.currentCandidate.candidate.targetActorId]
  } else if (context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE') {
    decisionActorIds = [context.phase.resistance.targetActorId]
  } else if (context.phase.kind === 'ACTION_EVIDENCE') {
    decisionActorIds = [context.phase.rollerActorId]
  } else {
    const options = context.reactionTimeline[0]?.group.options ?? []
    decisionActorIds = (context.phase.kind === 'CHOICE' ? options : []).map(
      (option) => option.candidate.reactorActorId
    )
  }
  // The decision belongs to the controllers of the actor whose roll or choice it is.
  const controlledActorIds = await readEncounterControlledActorIds(ctx, {
    campaign,
    membership,
    actors: await Promise.all(
      [...new Set(decisionActorIds)].map((actorId) => readRunActor(ctx, state, actorId))
    )
  })
  if (
    decisionActorIds.length === 0 ||
    decisionActorIds.some((actorId) => !controlledActorIds.has(actorId))
  )
    rejectDomain('NOT_ACTOR_CONTROLLER', "This decision isn't yours to answer.")
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  if (!binding || binding.sceneId !== root.sceneId || binding.campaignId !== campaign.id)
    throw new Error('Movement response Scene binding is stale.')
  return {
    userId,
    campaign,
    membership,
    run,
    state,
    occurrence,
    snapshot,
    context,
    root
  }
}

/** Recheck the frozen response after Node geometry work and before any gameplay writes. */
export async function assertMovementResolutionCurrent(
  ctx: QueryCtx,
  save: SceneStoredGeometrySave
) {
  const resolution = readMovementResolution(save)
  if (!resolution) throw new Error('Movement response evidence is unavailable.')
  const current = await readMovementResponseAuthority(ctx, resolution.command)
  if (
    current.userId !== save.actorUserId ||
    current.occurrence.pendingSnapshotChecksum !==
      save.movementResolution!.pendingSnapshotChecksum ||
    current.occurrence.pendingSnapshotJson !== save.movementResolution!.pendingSnapshotJson ||
    current.root.currentSceneVersion !== save.snapshotVersion ||
    save.sessionVision?.campaignId !== current.campaign.id
  )
    throw new Error('Movement decision changed before Scene publication.')
  const appRoll = await readEncounterSettledAppRoll(ctx, {
    occurrence: current.occurrence,
    response: resolution.command,
    userId: current.userId
  })
  return {
    ...current,
    command: resolution.command,
    appRoll,
    /** The response as the rules consume it, with an app roll's recorded faces. */
    answer: withEncounterAppRoll(resolution.command.resolution, appRoll)
  }
}
