import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { SceneStoredGeometrySave } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { movementRuleResolutionCommandDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  isServerKernelRuleExecutionPendingSnapshot,
  serverRuleExecutionPendingSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { serverRuleExecutionPendingOccurrenceId } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { readCampaignAssignedCharacter } from '../campaigns/assignedCharacter'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireSession } from '../campaigns/sessionDocuments'
import { readRunActor, readRunState } from '../encounters/documents'
import {
  assertGeometryReceiving,
  readGeometrySave,
  readMovementResolution
} from './geometryDocuments'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'

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
  const session = await requireSession(ctx, campaign.id, state.sessionId)
  if (
    campaign.status !== 'ACTIVE' ||
    campaign.gameSystemId !== state.gameSystemId ||
    session.status !== 'OPEN' ||
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
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
    JSON.parse(occurrence.pendingSnapshotJson)
  )
  const { context, root } = readEncounterMovementPendingContext(snapshot)
  const kernelSnapshot = isServerKernelRuleExecutionPendingSnapshot(snapshot) ? snapshot : null
  if (
    (context.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' && !kernelSnapshot) ||
    checksumCanonicalJson(snapshot) !== occurrence.pendingSnapshotChecksum ||
    serverRuleExecutionPendingOccurrenceId(snapshot) !== occurrence.id ||
    root.encounterId !== state.id ||
    root.commandId !== occurrence.rootCommandId ||
    root.resolutionCommands.length !== occurrence.version ||
    (snapshot.optionalCombatSnapshotChecksum ?? null) !== state.optionalCombatSnapshotChecksum
  )
    throw new Error('Stored movement response evidence is inconsistent.')
  const assigned =
    membership.role === 'PLAYER'
      ? await readCampaignAssignedCharacter(ctx, campaign, membership)
      : null
  if (context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE') {
    if (
      membership.role !== 'OWNER' &&
      (!context.sourceControllerCharacterId ||
        !assigned ||
        assigned.id !== context.sourceControllerCharacterId)
    )
      throw new Error('The current movement decision belongs to another controller.')
  } else if (context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST') {
    if (!kernelSnapshot) throw new Error('Stored movement response evidence is inconsistent.')
    const participantActorId =
      kernelSnapshot.request.nodeId === context.initiator.requestNodeId
        ? context.sourceActorId
        : kernelSnapshot.request.nodeId === context.defender.requestNodeId
          ? context.targetActorId
          : null
    const participantActor = participantActorId
      ? await readRunActor(ctx, state, participantActorId)
      : null
    if (!participantActor) throw new Error('Movement passage participant is unavailable.')
    const participant =
      kernelSnapshot.request.nodeId === context.initiator.requestNodeId
        ? context.initiatorControllerCharacterId
        : participantActor.kind === 'CHARACTER'
          ? participantActor.sourceId
          : null
    if (membership.role !== 'OWNER' && (!participant || !assigned || assigned.id !== participant))
      throw new Error('The current movement decision belongs to another controller.')
  } else if (membership.role !== 'OWNER') {
    let characterId: string | null = null
    if (context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT') {
      if (context.currentCandidate.target.kind === 'CHARACTER')
        characterId = context.currentCandidate.target.characterId
    } else if (context.phase.kind === 'CONCENTRATION_EVIDENCE') {
      const targetActorId = context.phase.concentration.application.targetActorId
      const actor = await readRunActor(ctx, state, targetActorId)
      characterId = actor?.kind === 'CHARACTER' ? actor.sourceId : null
    } else if (context.phase.kind === 'SPATIAL_EVIDENCE') {
      if (context.phase.currentCandidate.target.kind === 'CHARACTER')
        characterId = context.phase.currentCandidate.target.characterId
    } else {
      const entry = context.reactionTimeline[0]
      const options =
        entry?.kind === 'AUTOMATIC_ACTION' ? [entry.option] : (entry?.group.options ?? [])
      const phase = context.phase
      const current =
        phase.kind === 'CHOICE'
          ? options
          : phase.kind === 'ACTION_EVIDENCE'
            ? options.filter((option) => option.optionId === phase.selectedOptionId)
            : []
      if (
        current.length &&
        current.every(
          (option) =>
            option.authority.kind === 'CHARACTER_CONTROLLER' &&
            option.authority.characterId === assigned?.id
        )
      )
        characterId = assigned?.id ?? null
    }
    if (!assigned || characterId !== assigned.id)
      throw new Error('The current movement decision belongs to another controller.')
  }
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
    assigned,
    session,
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
    current.session.id !== save.sessionVision?.sessionId
  )
    throw new Error('Movement decision changed before Scene publication.')
  return { ...current, command: resolution.command }
}
