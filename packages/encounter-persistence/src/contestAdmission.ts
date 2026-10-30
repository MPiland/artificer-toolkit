import {
  encounterExecuteInputSchema,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  actionTargetActorId,
  type EscapeRelationshipInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readEncounterActorDefeated } from './characterStates.js'
import { rejectDomain } from './domainRejections.js'
import { readEncounterAutoRollByActorId, requireEncounterActorControl } from './actorController.js'
import {
  projectNativeContestPendingForMember,
  readNativeContestPending
} from './actionContestPending.js'
import { readNativeContestEvidenceReplay, readNativeContestReplay } from './actionContestReplay.js'
import { nativeActionPendingResult } from './actionPendingResult.js'
import { readRunActor, readRunActors, readRunState } from './documents.js'
import { replayEncounterCommandResult } from './replayReceipts.js'
import { readEncounterSettledAppRoll } from './evidenceRolls.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { requireTargetSeenByMember } from './targetVisibility.js'
import { requireUnusedEvidenceCommandId } from './timelineEntries.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/** A contest's root: the contested action, or an escape its holder contests (D152). */
export type ContestRootCommand = ResolveEncounterActionInputDto | EscapeRelationshipInputDto
type ContestCommand = ContestRootCommand | ResolveRuleOccurrenceInputDto

function normalizeRoot(command: ContestRootCommand): ContestRootCommand {
  // An escape normalizes exactly as its own admission does, so both seal one fingerprint.
  if (command.type === 'ESCAPE')
    return {
      ...command,
      encounterId: command.encounterId.toLowerCase(),
      commandId: command.commandId.toLowerCase(),
      actorId: command.actorId.toLowerCase()
    }
  // A delegated attack (DELEGATED_ATTACK) is an ordinary attack; a contest never charges a commander.
  if (command.delegatingActorId !== undefined)
    rejectDomain(
      'SOURCE_REQUIREMENTS_NOT_MET',
      'A delegated attack is one ordinary attack at one creature.'
    )
  const { target } = command
  // A contest takes one creature; a point-origin area has no contest.
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
 * Admits a contest, or a participant's d20 for one, for the room: current control and versions,
 * the one pending contest, and a stored result replaying before any currentness check. It reads
 * no rules inputs and writes nothing.
 */
export async function readContestAdmission(
  ctx: EncounterReadTransaction,
  input: Omit<LiveSessionEncounterRulesInput, 'request'> & { command: ContestCommand }
) {
  const { userId } = await ctx.ports.requireIdentity()
  if (
    userId !== input.expectedUserId ||
    input.command.encounterId.toLowerCase() !== input.encounterId ||
    input.command.expectedVersion !== input.expectedVersion
  )
    throw new Error('Live Session contest scope mismatch.')
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
    throw new Error('Live Session contest scope mismatch.')
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
  let root: ContestRootCommand
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
      throw new Error('The contest occurrence scope is invalid.')
    const rootReceipt = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', run.campaignId).eq('commandId', occurrence.rootCommandId)
      )
      .unique()
    const pending =
      occurrence.state === 'PENDING' ? await readNativeContestPending(ctx, occurrence) : null
    if (pending) root = pending.command
    else {
      if (rootReceipt?.commandType !== 'RESOLVE_ACTION' && rootReceipt?.commandType !== 'ESCAPE')
        throw new Error('Stored contest action root is missing.')
      const parsed = encounterExecuteInputSchema.parse({
        command: JSON.parse(rootReceipt.commandJson)
      }).command
      if (
        (parsed.type !== 'RESOLVE_ACTION' && parsed.type !== 'ESCAPE') ||
        parsed.type !== rootReceipt.commandType
      )
        throw new Error('Stored contest action root is invalid.')
      root = parsed
    }
    const initiatorUserId = pending?.context.initiatorUserId ?? rootReceipt!.actorUserId
    const rootReplay = rootReceipt
      ? await readNativeContestReplay(ctx, { run, command: root, receipt: rootReceipt })
      : null
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaign.id).eq('commandId', response!.commandId)
      )
      .unique()
    if (receipt) {
      const evidence = readNativeContestEvidenceReplay({
        receipt,
        occurrence,
        response,
        rootCommand: root,
        initiatorUserId,
        userId
      })
      if (receipt.encounterVersion > run.version)
        throw new Error('Stored contest evidence aggregate mismatch.')
      if (
        evidence.payload.status === 'COMPLETE' &&
        (!rootReplay ||
          checksumRuleDocument(evidence.payload) !== checksumRuleDocument(rootReplay.payload))
      )
        throw new Error('Stored contest terminal evidence receipt mismatch.')
      return replay(await replayEncounterCommandResult(ctx, state, evidence.replayReceipt))
    }
    if (
      !pending ||
      occurrence.version !== response.expectedOccurrenceVersion ||
      run.version !== response.expectedVersion ||
      occurrence.expectedEncounterVersion !== run.version
    )
      rejectDomain('VERSION_STALE', 'The contest occurrence version is stale.')
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
    const { receipt } = await readNativeContestReplay(ctx, {
      run,
      command: root,
      receipt: rootReceipt
    })
    return replay(await replayEncounterCommandResult(ctx, state, receipt))
  }
  if (!response) {
    const actor = await readRunActor(ctx, state, root.actorId)
    await requireEncounterActorControl(ctx, { campaign, membership, actor })
    if (await readEncounterActorDefeated(ctx, actor)) rejectDomain('ACTOR_DEFEATED')
    // An escape names no target; its planner finds the holder from the held effect.
    if (root.type === 'RESOLVE_ACTION') {
      const target = await readRunActor(ctx, state, actionTargetActorId(root.target))
      await requireTargetSeenByMember(ctx, { encounterId: state.id, target, membership })
      // A defeated creature can't take part in a contest (D63).
      if (await readEncounterActorDefeated(ctx, target))
        rejectDomain('TARGET_UNAVAILABLE', 'The target is defeated.')
    }
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
  const prior = occurrence ? await readNativeContestPending(ctx, occurrence) : null
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
      rejectDomain('VERSION_STALE', 'The contest occurrence version or evidence request is stale.')
    if (!(await projectNativeContestPendingForMember(ctx, run, campaign, membership, occurrence)))
      throw new Error('The current contest participant must supply this evidence.')
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
  // A won contest's outcome dice may also be entered as a total; its d20 phases still refuse one
  // (D173). Its destination phase takes only the square its source picks (D157).
  if (
    response &&
    (prior?.participant === 'DESTINATION'
      ? response.resolution.kind !== 'FORCED_MOVEMENT'
      : response.resolution.kind !== 'ENTER_DICE' &&
        response.resolution.kind !== 'ENTER_INTEGER' &&
        response.resolution.kind !== 'SYSTEM_ROLL' &&
        response.resolution.kind !== 'CONTEST_CHECK')
  )
    throw new Error('A contest participant answers with its roll evidence.')
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
