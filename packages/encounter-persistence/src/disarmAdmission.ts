import {
  encounterExecuteInputSchema,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { actionTargetActorId } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readEncounterActorDefeated } from './characterStates.js'
import { rejectDomain } from './domainRejections.js'
import { readEncounterAutoRollByActorId, requireEncounterActorControl } from './actorController.js'
import {
  projectNativeDisarmPendingForMember,
  readNativeDisarmPending
} from './actionDisarmPending.js'
import { readNativeDisarmEvidenceReplay, readNativeDisarmReplay } from './actionDisarmReplay.js'
import { nativeActionPendingResult } from './actionPending.js'
import { readRunActor, readRunActors, readRunState } from './documents.js'
import { replayEncounterCommandResult } from './replayReceipts.js'
import { readEncounterSettledAppRoll } from './evidenceRolls.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { requireUnusedEvidenceCommandId } from './timelineEntries.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

type DisarmCommand = ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto

function normalizeRoot(command: ResolveEncounterActionInputDto) {
  const { target } = command
  // Disarm takes one creature; a point-origin area has no Disarm.
  if (target.kind !== 'ACTOR')
    rejectDomain('TARGET_UNAVAILABLE', 'Area actions are not available yet.')
  return {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    actorId: command.actorId.toLowerCase(),
    target: { ...target, actorId: target.actorId.toLowerCase() },
    sceneContext: command.sceneContext
      ? {
          ...command.sceneContext,
          sceneId: command.sceneContext.sceneId.toLowerCase(),
          sourceTokenId: command.sceneContext.sourceTokenId.toLowerCase(),
          targetTokenId: command.sceneContext.targetTokenId.toLowerCase()
        }
      : null
  }
}

function normalizeResponse(response: ResolveRuleOccurrenceInputDto): ResolveRuleOccurrenceInputDto {
  return {
    ...response,
    encounterId: response.encounterId.toLowerCase(),
    commandId: response.commandId.toLowerCase(),
    occurrenceId: response.occurrenceId.toLowerCase(),
    correlationId: response.correlationId?.toLowerCase() ?? null
  }
}

/**
 * Admits a Disarm, or a participant's d20 for one, for the room: current control and versions,
 * the one pending contest, and a stored result replaying before any currentness check. It reads
 * no rules inputs and writes nothing.
 */
export async function readDisarmAdmission(
  ctx: EncounterReadTransaction,
  input: Omit<LiveSessionEncounterRulesInput, 'request'> & { command: DisarmCommand }
) {
  const { userId } = await ctx.ports.requireIdentity()
  if (
    userId !== input.expectedUserId ||
    input.command.encounterId.toLowerCase() !== input.encounterId ||
    input.command.expectedVersion !== input.expectedVersion
  )
    throw new Error('Live Session Disarm scope mismatch.')
  await ctx.ports.requireActiveLiveAuthority({
    campaignId: input.campaignId,
    epoch: input.authorityEpoch
  })
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const state = readRunState(run)
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(
    state.campaignId,
    userId
  )
  if (campaign.id !== input.campaignId || membership.role !== input.expectedRole)
    throw new Error('Live Session Disarm scope mismatch.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign System is stale.')
  const scope = { run, state, campaign, membership }
  const replay = async (
    result: Parameters<typeof presentEncounterResultForMember>[1]['result']
  ) => ({
    ...scope,
    kind: 'REPLAY' as const,
    result: await presentEncounterResultForMember(ctx, { campaign, membership, result })
  })
  let response: ResolveRuleOccurrenceInputDto | null = null
  let root: ResolveEncounterActionInputDto
  let answered: EncounterDocument<'encounterRuleOccurrences'> | null = null
  if (input.command.type === 'RESOLVE_RULE_OCCURRENCE') {
    response = normalizeResponse(input.command)
    const occurrenceId = response.occurrenceId
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
      .unique()
    if (!occurrence) throw new Error('Rule occurrence is unavailable.')
    if (occurrence.encounterId !== run.id || occurrence.campaignId !== run.campaignId)
      throw new Error('The Disarm occurrence scope is invalid.')
    const rootReceipt = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', run.campaignId).eq('commandId', occurrence.rootCommandId)
      )
      .unique()
    const pending =
      occurrence.state === 'PENDING' ? await readNativeDisarmPending(ctx, occurrence) : null
    if (pending) root = pending.command
    else {
      if (rootReceipt?.commandType !== 'RESOLVE_ACTION')
        throw new Error('Stored Disarm action root is missing.')
      const parsed = encounterExecuteInputSchema.parse({
        command: JSON.parse(rootReceipt.commandJson)
      }).command
      if (parsed.type !== 'RESOLVE_ACTION') throw new Error('Stored Disarm action root is invalid.')
      root = parsed
    }
    const initiatorUserId = pending?.context.initiatorUserId ?? rootReceipt!.actorUserId
    const rootReplay = rootReceipt
      ? await readNativeDisarmReplay(ctx, { run, command: root, receipt: rootReceipt })
      : null
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaign.id).eq('commandId', response!.commandId)
      )
      .unique()
    if (receipt) {
      const evidence = readNativeDisarmEvidenceReplay({
        receipt,
        occurrence,
        response,
        rootCommand: root,
        initiatorUserId,
        userId
      })
      if (receipt.encounterVersion > run.version)
        throw new Error('Stored Disarm evidence aggregate mismatch.')
      if (
        evidence.payload.status === 'COMPLETE' &&
        (!rootReplay ||
          checksumRuleDocument(evidence.payload) !== checksumRuleDocument(rootReplay.payload))
      )
        throw new Error('Stored Disarm terminal evidence receipt mismatch.')
      return replay(await replayEncounterCommandResult(ctx, state, evidence.replayReceipt))
    }
    if (
      !pending ||
      occurrence.version !== response.expectedOccurrenceVersion ||
      run.version !== response.expectedVersion ||
      occurrence.expectedEncounterVersion !== run.version
    )
      rejectDomain('VERSION_STALE', 'The Disarm occurrence version is stale.')
    if (response.commandId === root.commandId || rootReceipt) rejectDomain('COMMAND_ID_REUSED')
    const [usedCommand, usedRoot] = await Promise.all([
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', campaign.id).eq('commandId', response!.commandId)
        )
        .unique(),
      ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_campaignId_rootCommandId', (q) =>
          q.eq('campaignId', campaign.id).eq('rootCommandId', response!.commandId)
        )
        .unique()
    ])
    if (usedCommand || usedRoot) rejectDomain('COMMAND_ID_REUSED')
    answered = occurrence
  } else root = normalizeRoot(input.command)

  await requireUnusedEvidenceCommandId(ctx, campaign.id, root.commandId)
  const fingerprint = checksumCanonicalJson(root)
  const rootReceipt = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', root.commandId)
    )
    .unique()
  if (rootReceipt) {
    if (response || rootReceipt.actorUserId !== userId) rejectDomain('COMMAND_ID_REUSED')
    const { receipt } = await readNativeDisarmReplay(ctx, {
      run,
      command: root,
      receipt: rootReceipt
    })
    return replay(await replayEncounterCommandResult(ctx, state, receipt))
  }
  if (!response) {
    const [actor, target] = await Promise.all([
      readRunActor(ctx, state, root.actorId),
      readRunActor(ctx, state, actionTargetActorId(root.target))
    ])
    await requireEncounterActorControl(ctx, { campaign, membership, actor })
    if (await readEncounterActorDefeated(ctx, actor)) rejectDomain('ACTOR_DEFEATED')
    if (membership.role !== 'OWNER' && !target.public) rejectDomain('TARGET_UNAVAILABLE')
    // A defeated creature can't contest a Disarm (D63).
    if (await readEncounterActorDefeated(ctx, target))
      rejectDomain('TARGET_UNAVAILABLE', 'The target is defeated.')
  }
  if (state.version !== root.expectedVersion) rejectDomain('VERSION_STALE')
  if (state.automationMode === 'MANUAL') rejectDomain('ASSISTED_ONLY')
  const pendingOccurrences = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
    .take(2)
  if (pendingOccurrences.length > 1)
    throw new Error('Stored Encounter occurrence state is invalid.')
  const occurrence = pendingOccurrences[0] ?? null
  if (occurrence && occurrence.rootCommandId !== root.commandId) rejectDomain('PENDING_DECISION')
  const prior = occurrence ? await readNativeDisarmPending(ctx, occurrence) : null
  const initiatorUserId = prior?.context.initiatorUserId ?? userId
  if (prior && prior.context.commandFingerprint !== fingerprint) rejectDomain('COMMAND_ID_REUSED')
  if (!response && prior) {
    if (initiatorUserId !== userId) rejectDomain('COMMAND_ID_REUSED')
    return replay(await nativeActionPendingResult(ctx, run, occurrence!))
  }
  if (response) {
    if (
      !occurrence ||
      !prior ||
      occurrence._id !== answered?._id ||
      occurrence.version !== answered.version ||
      occurrence.version !== response.expectedOccurrenceVersion ||
      occurrence.expectedEncounterVersion !== state.version ||
      response.expectedVersion !== state.version ||
      response.encounterId !== run.id ||
      response.occurrenceId !== occurrence.id ||
      !('requestId' in response.resolution) ||
      response.resolution.requestId !== prior.snapshot.request.requestId
    )
      rejectDomain('VERSION_STALE', 'The Disarm occurrence version or evidence request is stale.')
    if (!(await projectNativeDisarmPendingForMember(ctx, run, campaign, membership, occurrence)))
      throw new Error('The current Disarm participant must supply this evidence.')
  }
  const usedRoot = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', campaign.id).eq('rootCommandId', root.commandId)
    )
    .unique()
  if (usedRoot && usedRoot._id !== occurrence?._id) rejectDomain('COMMAND_ID_REUSED')
  const appRoll =
    response && occurrence
      ? await readEncounterSettledAppRoll(ctx, { occurrence, response, userId })
      : null
  if (
    response &&
    response.resolution.kind !== 'ENTER_DICE' &&
    response.resolution.kind !== 'SYSTEM_ROLL'
  )
    throw new Error('Disarm requires d20 evidence.')
  return {
    ...scope,
    kind: 'READY' as const,
    root,
    response,
    fingerprint,
    initiatorUserId,
    occurrence,
    prior,
    appRoll,
    // Each participant's d20 goes to that actor's controllers; the initiator rolls their own.
    autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
      campaign,
      initiatorUserId,
      actors: await readRunActors(ctx, state)
    })
  }
}
