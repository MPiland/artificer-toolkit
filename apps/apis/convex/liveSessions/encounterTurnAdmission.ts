import type {
  EncounterRunState,
  EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  LiveSessionEncounterTurnPendingInput,
  LiveSessionEncounterTurnCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readLiveScene } from '../scenes/liveDocuments'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import type { EncounterCommandInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import {
  readNativeEncounterCommandReplay,
  readNativeEncounterCommandState
} from '../encounters/commandReplay'
import { readNativeTurnCommandPending } from '../encounters/turnCommandPending'
import { requireIdentity } from '../lib/identity'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { projectNativeTurnPending } from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import { projectEncounterInitiativePendingSummary } from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import {
  prepareEncounterTurnResponse,
  matchesNativeTurnResponse
} from '@artificer-toolkit/rules-runtime/encounterTurnResponse'
import { readNativeTurnResponseReplay } from '../encounters/turnResponseReplay'
import { requireUnusedEvidenceCommandId } from '../encounters/timelineEntries'
import { requireTurnResponseController } from '../encounters/turnResponseAuthority'
import { rejectDomain } from '../lib/domainRejections'
import {
  readEncounterControlledActorIds,
  requireEncounterActorControl
} from '../encounters/actorController'
import { readRunActor, readRunActors } from '../encounters/documents'

/** Raw authorization and replay proof; turn rules are evaluated by the Session DO. */
export async function readLiveEncounterTurnAdmission(
  ctx: QueryCtx,
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: Extract<
    EncounterCommandInputDto,
    { type: 'START' | 'ADVANCE_TURN' | 'RESOLVE_RULE_OCCURRENCE' }
  >
) {
  const input = {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase()
  }
  const { userId } = await requireIdentity(ctx)
  if (
    userId !== scope.expectedUserId ||
    // Players end their own actor's turn and answer its turn decisions, checked below.
    (scope.expectedRole !== 'OWNER' && input.type === 'START') ||
    scope.concentrationResponse ||
    scope.movement ||
    scope.action ||
    (scope.turnCommand &&
      checksumCanonicalJson(scope.turnCommand) !== checksumCanonicalJson(input)) ||
    input.encounterId !== scope.encounterId ||
    input.expectedVersion !== scope.expectedVersion
  )
    throw new Error('Live Session Encounter command scope mismatch.')
  await requireActiveCampaignLiveAuthority(ctx, {
    campaignId: scope.campaignId,
    epoch: scope.authorityEpoch
  })
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!row) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await requireCampaignAuthority(ctx, row.campaignId, userId)
  if (membership.role !== scope.expectedRole) throw new Error('Campaign not found.')
  if (campaign.id !== scope.campaignId) throw new Error('Live Session Encounter scope mismatch.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (row.gameSystemId !== campaign.gameSystemId)
    throw new Error('Encounter does not match the Campaign Game System.')
  const { fingerprint, result } = await readNativeEncounterCommandReplay(ctx, {
    input,
    row,
    campaign,
    userId
  })
  const { state, projection } = readNativeEncounterCommandState(row)
  if (result && input.type !== 'RESOLVE_RULE_OCCURRENCE')
    return {
      input,
      row,
      campaign,
      membership,
      state,
      projection,
      fingerprint,
      kind: 'REPLAY' as const,
      result,
      resume: null,
      pending: null
    }
  if (input.type === 'RESOLVE_RULE_OCCURRENCE') {
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', input.occurrenceId))
      .unique()
    if (!occurrence || occurrence.campaignId !== campaign.id || occurrence.encounterId !== row.id)
      throw new Error('Rule occurrence is unavailable.')
    const completedReceipt =
      occurrence.state === 'COMPLETED'
        ? await ctx.db
            .query('encounterRuleReceipts')
            .withIndex('by_encounterId_commandId', (q) =>
              q.eq('encounterId', row.id).eq('commandId', occurrence.rootCommandId)
            )
            .unique()
        : null
    await requireTurnResponseController(ctx, {
      campaign,
      membership,
      state,
      occurrence,
      receipt: completedReceipt,
      command: input,
      fingerprint
    })
    const replay = await readNativeTurnResponseReplay(ctx, {
      occurrence,
      row,
      campaign,
      command: input,
      userId,
      projection,
      receipt: completedReceipt
    })
    if (replay)
      return {
        input,
        row,
        campaign,
        membership,
        state,
        projection,
        fingerprint,
        kind: 'REPLAY' as const,
        result: replay,
        pending: null,
        resume: null
      }
    const occurrences = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', row.id).eq('state', 'PENDING'))
      .take(2)
    if (
      occurrences.length !== 1 ||
      occurrences[0]?._id !== occurrence._id ||
      occurrence.state !== 'PENDING' ||
      occurrence.pendingSnapshotJson === null ||
      occurrence.pendingSnapshotChecksum === null ||
      occurrence.completedAt !== null ||
      row.version !== input.expectedVersion
    )
      throw new Error('Rule occurrence is unavailable.')
    const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
      JSON.parse(occurrence.pendingSnapshotJson)
    )
    const context = snapshot.applicationContext
    if (
      checksumCanonicalJson(snapshot) !== occurrence.pendingSnapshotChecksum ||
      snapshot.occurrenceId !== occurrence.id ||
      (context.kind !== 'ENCOUNTER_INITIATIVE' &&
        context.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION' &&
        context.kind !== 'ENCOUNTER_TURN_RECHARGE' &&
        context.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' &&
        context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' &&
        context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE') ||
      (context.root.commandType === 'START'
        ? row.status !== 'PREPARED'
        : row.status !== 'ACTIVE') ||
      context.root.rootCommandId !== occurrence.rootCommandId ||
      context.root.initiatorUserId !== campaign.ownerUserId ||
      context.root.expectedEncounterVersion !== row.version ||
      occurrence.expectedEncounterVersion !== row.version
    )
      throw new Error('Rule occurrence is unavailable.')
    if (
      context.kind === 'ENCOUNTER_INITIATIVE' ||
      context.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
    ) {
      const root = context.root
      const starting = root.commandType === 'START'
      const rootCommand = {
        type: root.commandType,
        encounterId: state.id,
        commandId: root.rootCommandId,
        expectedVersion: root.expectedEncounterVersion,
        ...(starting && root.startSystemId ? { systemId: root.startSystemId } : {})
      }
      if (
        state.automationMode === 'MANUAL' ||
        !state.initiativePolicySnapshot ||
        (context.kind === 'ENCOUNTER_INITIATIVE_DECLARATION' &&
          (snapshot.snapshotKind !== 'AGGREGATE_CHOICE' ||
            state.initiativePolicySnapshot.policy.document.procedure !== 'DECLARED_ACTION_ROLL' ||
            root.stagedInitiativeRoundState.round.procedure !== 'DECLARED_ACTION_ROLL')) ||
        root.commandFingerprint !== checksumCanonicalJson(rootCommand) ||
        root.round !== (starting ? 1 : state.round + 1) ||
        root.policySnapshotChecksum !== state.initiativePolicySnapshotChecksum ||
        root.stagedInitiativeRoundState.round.encounterId !== state.id ||
        root.stagedInitiativeRoundState.round.round !== root.round ||
        root.stagedInitiativeRoundState.round.policySnapshotChecksum !==
          root.policySnapshotChecksum ||
        checksumCanonicalJson(
          root.stagedInitiativeRoundState.participants.map((actor) => actor.actorId).sort()
        ) !== checksumCanonicalJson([...state.actorIds].sort()) ||
        (starting
          ? root.initiativeBeforePin.kind !== 'INITIAL_START'
          : root.initiativeBeforePin.kind !== 'EACH_ROUND' ||
            root.initiativeBeforePin.round !== state.round ||
            root.initiativeBeforePin.version !== state.version) ||
        checksumCanonicalJson(root.initiativeBeforePin.actorIds) !==
          checksumCanonicalJson([...state.actorIds].sort()) ||
        (starting &&
          (root.initiativeAdvance || root.outgoingTurn || root.completedLegendaryActions)) ||
        (starting
          ? root.startSystemId !== null && root.startSystemId !== state.gameSystemId
          : root.startSystemId !== null) ||
        root.legendaryActionQueue ||
        root.stagedLegendaryActionRefreshes ||
        root.stagedActionEconomyRefreshes ||
        root.completedRechargePlan !== undefined
      )
        throw new Error('Initiative response state is unavailable.')
    }
    const history = context.root.resolutionCommands.find(
      (entry) => entry.commandId === input.commandId
    )
    if (history) {
      if (
        !matchesNativeTurnResponse(history, input.resolution) ||
        history.commandFingerprint !== fingerprint ||
        history.actorUserId !== userId ||
        history.correlationId !== input.correlationId ||
        history.expectedOccurrenceVersion !== input.expectedOccurrenceVersion
      )
        throw new Error('Rule occurrence is unavailable.')
      const result = encounterCommandResultDtoSchema.parse({
        projection,
        roll: null,
        occurrence: {
          occurrenceId: occurrence.id,
          occurrenceVersion: occurrence.version,
          status: 'PENDING',
          outcome: null,
          pending:
            context.kind === 'ENCOUNTER_INITIATIVE' ||
            context.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
              ? projectEncounterInitiativePendingSummary({
                  pendingSnapshot: snapshot,
                  occurrenceVersion: occurrence.version,
                  encounterVersion: row.version
                })
              : projectNativeTurnPending({
                  snapshot,
                  occurrenceId: occurrence.id,
                  occurrenceVersion: occurrence.version,
                  encounterVersion: row.version
                })
        }
      })
      return {
        input,
        row,
        campaign,
        membership,
        state,
        projection,
        fingerprint,
        kind: 'PENDING' as const,
        result,
        pending: { occurrence, snapshot },
        resume: null
      }
    }
    const prepared = prepareEncounterTurnResponse({
      pending: snapshot,
      command: input,
      userId,
      ownerUserId: campaign.ownerUserId,
      responderControlledActorIds: await readEncounterControlledActorIds(ctx, {
        campaign,
        membership,
        actors: await readRunActors(ctx, state)
      }),
      occurrence,
      encounterVersion: row.version
    })
    if (prepared.kind === 'REPLAY') throw new Error('Rule occurrence response is unavailable.')
    await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
    const commandCollision = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_campaignId_rootCommandId', (q) =>
        q.eq('campaignId', campaign.id).eq('rootCommandId', input.commandId)
      )
      .unique()
    if (commandCollision) rejectDomain('COMMAND_ID_REUSED')
    return {
      input,
      row,
      campaign,
      membership,
      state,
      projection,
      fingerprint,
      kind: 'READY' as const,
      result: null,
      pending: { occurrence, snapshot },
      resume: prepared
    }
  }
  const pending = await readNativeTurnCommandPending(ctx, {
    input,
    row,
    campaign,
    userId,
    commandFingerprint: fingerprint,
    projection
  })
  if (pending)
    return {
      input,
      row,
      campaign,
      membership,
      state,
      projection,
      fingerprint,
      kind: 'PENDING' as const,
      result: pending.result,
      resume: null,
      pending
    }
  const occurrences = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', row.id).eq('state', 'PENDING'))
    .take(2)
  if (occurrences.length > 1) throw new Error('Stored Encounter occurrence state is invalid.')
  if (occurrences.length) rejectDomain('PENDING_DECISION')
  if (input.expectedVersion !== row.version) rejectDomain('VERSION_STALE')
  if (row.status === 'COMPLETED') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  if (input.type === 'START') {
    if (state.status !== 'PREPARED')
      rejectDomain('ENCOUNTER_NOT_ACTIVE', 'Only prepared Encounters can start.')
    if (input.systemId !== undefined && input.systemId !== state.gameSystemId)
      throw new Error('Encounter does not match the requested Game System.')
    if (state.actorIds.length === 0) throw new Error('Add an actor before starting.')
    const active = await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) =>
        q.eq('campaignId', campaign.id).eq('status', 'ACTIVE')
      )
      .first()
    if (active) rejectDomain('ACTIVE_ENCOUNTER_EXISTS')
  } else {
    if (state.status !== 'ACTIVE' || state.currentActorId === null)
      rejectDomain(
        'ENCOUNTER_NOT_ACTIVE',
        'Only active Encounters with a current actor can advance.'
      )
    // A player ends only the turn of an actor they control; the GM can end any turn.
    await requireEncounterActorControl(ctx, {
      campaign,
      membership,
      actor: await readRunActor(ctx, state, state.currentActorId)
    })
  }
  return {
    input,
    row,
    campaign,
    membership,
    state,
    projection,
    fingerprint,
    kind: 'READY' as const,
    result: null,
    resume: null,
    pending: null
  }
}

/** Checks the complete read fence before a pending or terminal turn writes anything. */
export async function assertLiveTurnRevisions(
  ctx: MutationCtx,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  input: Pick<LiveSessionEncounterTurnPendingInput, 'revisions' | 'scenes'>,
  maintenanceOwners: LiveSessionEncounterTurnCommitInput['maintenanceOwners'] = []
) {
  const characterIds = actors.flatMap((actor) => {
    if (actor.kind !== 'CHARACTER') return []
    return [actor.sourceId]
  })
  if (new Set(characterIds).size !== characterIds.length)
    throw new Error('Encounter Character source binding mismatch.')
  const owners = new Set<string>()
  for (const request of maintenanceOwners) {
    const key = checksumCanonicalJson(request)
    if (!actors.some((actor) => actor.id === request.actorId) || owners.has(key))
      throw new Error('Live Session turn maintenance scope mismatch.')
    owners.add(key)
    await readEncounterMaintenanceCapture(ctx, state, request)
    if (request.owner.kind === 'CHARACTER' && !characterIds.includes(request.owner.characterId))
      characterIds.push(request.owner.characterId)
  }
  await assertLiveSessionRulesRevisions(ctx, input.revisions, {
    systemId: state.gameSystemId,
    campaignId: state.campaignId,
    characterIds
  })
  for (const scene of input.scenes) {
    const binding = await ctx.db
      .query('encounterSceneBindings')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
      .unique()
    if (!binding || binding.campaignId !== state.campaignId || binding.sceneId !== scene.sceneId)
      throw new Error('Live Session turn Scene binding is stale.')
    const { header } = await readLiveScene(ctx, scene.sceneId, 'MEMBER')
    if (
      header.campaignId !== state.campaignId ||
      header.version !== scene.sceneVersion ||
      header.definitionSaveId !== scene.definitionSaveId
    )
      throw new Error('Live Session turn Scene changed before commit.')
  }
}
