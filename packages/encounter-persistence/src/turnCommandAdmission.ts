import type { EncounterCommandInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { rollsInitiative } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { projectNativeTurnPending } from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import { projectEncounterInitiativePendingSummary } from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import { delegatedLegendaryContinuationCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import {
  prepareEncounterTurnResponse,
  matchesNativeTurnResponse
} from '@artificer-toolkit/rules-runtime/encounterTurnResponse'
import type { EncounterReadTransaction } from './ports.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import { readNativeEncounterCommandReplay } from './commandReplay.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readNativeTurnCommandPending } from './turnCommandPending.js'
import { readNativeTurnResponseReplay } from './turnResponseReplay.js'
import { requireUnusedEvidenceCommandId } from './timelineEntries.js'
import { requireTurnResponseController } from './turnResponseAuthority.js'
import { rejectDomain } from './domainRejections.js'
import { readEncounterControlledActorIds, requireEncounterActorControl } from './actorController.js'
import { readRunActor, readRunActors, readRunState } from './documents.js'

/** Raw authorization and replay proof; turn rules are evaluated by the Session DO. */
export async function readLiveEncounterTurnAdmission(
  ctx: EncounterReadTransaction,
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
  const { userId } = await ctx.ports.requireIdentity()
  if (
    userId !== scope.expectedUserId ||
    scope.concentrationResponse ||
    scope.movement ||
    scope.action ||
    (scope.turnCommand &&
      checksumCanonicalJson(scope.turnCommand) !== checksumCanonicalJson(input)) ||
    input.encounterId !== scope.encounterId ||
    input.expectedVersion !== scope.expectedVersion
  )
    throw new Error('Live Session Encounter command scope mismatch.')
  await ctx.ports.requireActiveLiveAuthority({
    campaignId: scope.campaignId,
    epoch: scope.authorityEpoch
  })
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!row) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(row.campaignId, userId)
  if (membership.role !== scope.expectedRole) rejectDomain('CAMPAIGN_NOT_FOUND')
  // Players end their own actor's turn and answer its turn decisions, checked below.
  if (membership.role !== 'OWNER' && input.type === 'START') rejectDomain('GM_ONLY')
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
  const state = readRunState(row)
  if (result && input.type !== 'RESOLVE_RULE_OCCURRENCE')
    return {
      input,
      row,
      campaign,
      membership,
      state,
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
      receipt: completedReceipt
    })
    if (replay)
      return {
        input,
        row,
        campaign,
        membership,
        state,
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
      occurrence.completedAt !== null
    )
      throw new Error('Rule occurrence is unavailable.')
    const snapshot = await readPendingSnapshot(ctx, occurrence)
    if (!snapshot) throw new Error('Rule occurrence is unavailable.')
    const context = snapshot.applicationContext
    if (
      snapshot.occurrenceId !== occurrence.id ||
      (context.kind !== 'ENCOUNTER_INITIATIVE' &&
        context.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION' &&
        context.kind !== 'ENCOUNTER_TURN_RECHARGE' &&
        context.kind !== 'ENCOUNTER_TURN_DEATH_SAVE' &&
        context.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' &&
        context.kind !== 'ENCOUNTER_TURN_ZONE_EFFECTS' &&
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
      const initiativeActorIds = checksumCanonicalJson(
        (await readRunActors(ctx, state))
          .filter(rollsInitiative)
          .map((actor) => actor.id)
          .sort()
      )
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
        ) !== initiativeActorIds ||
        (starting
          ? root.initiativeBeforePin.kind !== 'INITIAL_START'
          : root.initiativeBeforePin.kind !== 'EACH_ROUND' ||
            root.initiativeBeforePin.round !== state.round ||
            root.initiativeBeforePin.version !== state.version) ||
        checksumCanonicalJson(root.initiativeBeforePin.actorIds) !== initiativeActorIds ||
        (starting &&
          (root.initiativeAdvance || root.outgoingTurn || root.completedLegendaryActions)) ||
        (starting
          ? root.startSystemId !== null && root.startSystemId !== state.gameSystemId
          : root.startSystemId !== null) ||
        root.legendaryActionQueue ||
        root.stagedLegendaryActionRefreshes ||
        root.stagedActionEconomyRefreshes ||
        root.completedRechargePlan !== undefined ||
        root.completedDeathSavePlan !== undefined
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
        projection: await readEncounterGmProjection(ctx, state),
        roll: null,
        occurrence: {
          occurrenceId: occurrence.id,
          occurrenceVersion: occurrence.version,
          status: 'PENDING',
          pending:
            context.kind === 'ENCOUNTER_INITIATIVE' ||
            context.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
              ? projectEncounterInitiativePendingSummary({
                  pendingSnapshot: snapshot,
                  occurrenceVersion: occurrence.version,
                  encounterVersion: row.version
                })
              : projectNativeTurnPending({
                  gameSystemId: state.gameSystemId,
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
    if (prepared.kind === 'STALE') rejectDomain('VERSION_STALE', 'Rule occurrence is unavailable.')
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
    commandFingerprint: fingerprint
  })
  if (pending)
    return {
      input,
      row,
      campaign,
      membership,
      state,
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
    // A player ends only the turn of an actor they control; the GM can end any turn. The room
    // finishes a turn end split around a delegated Legendary Action for whoever answered last.
    const delegation = state.delegatedLegendaryAction
    if (
      !delegation ||
      input.commandId.toLowerCase() !==
        delegatedLegendaryContinuationCommandId(delegation.parentCommandId)
    )
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
    fingerprint,
    kind: 'READY' as const,
    result: null,
    resume: null,
    pending: null
  }
}
