import {
  encounterExecuteInputSchema,
  type EncounterCommandResultDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  executeEncounterOptionalContestAction,
  type OptionalContestResolution
} from '@artificer-toolkit/rules-runtime/encounterOptionalContestActionExecution'
import { projectPlayerEncounterProjection } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { nextRollInt } from '../lib/rollRandom'
import { createRulesRuntime } from '../rules/runtime'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt'
import { projectNativeDisarmPendingForMember, readNativeDisarmPending } from './actionDisarmPending'
import { prepareNativeDisarm } from './actionDisarmPreparation'
import { readNativeDisarmEvidenceReplay, readNativeDisarmReplay } from './actionDisarmReplay'
import { settleNativeDisarm } from './actionDisarmSettlement'
import { nativeActionPendingResult } from './actionPending'
import { projectNativeGm } from './nativeProjection'
import { readRunActor, readRunActors, readRunProjection, readRunState } from './documents'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries'

type DisarmResume = {
  occurrence: Doc<'encounterRuleOccurrences'>
  response: ResolveRuleOccurrenceInputDto
  resolution: OptionalContestResolution
}

async function projectDisarmResponse(
  ctx: MutationCtx,
  run: Doc<'encounterRuns'>,
  campaign: Doc<'campaigns'>,
  membership: Doc<'campaignMemberships'>,
  occurrence: Doc<'encounterRuleOccurrences'>,
  result: EncounterCommandResultDto
): Promise<EncounterCommandResultDto> {
  if (membership.role === 'OWNER') return result
  return encounterCommandResultDtoSchema.parse({
    ...result,
    projection: projectPlayerEncounterProjection(
      encounterGmProjectionDtoSchema.parse(result.projection)
    ),
    occurrence: result.occurrence && {
      ...result.occurrence,
      pending:
        occurrence.state === 'PENDING'
          ? await projectNativeDisarmPendingForMember(ctx, run, campaign, membership, occurrence)
          : null
    }
  })
}

/** Keeps both participant rolls under the original action; settlement is one transaction. */
export async function executeNativeDisarm(
  ctx: MutationCtx,
  command: ResolveEncounterActionInputDto,
  userId: string,
  resume?: DisarmResume
): Promise<EncounterCommandResultDto> {
  const input = {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    actorId: command.actorId.toLowerCase(),
    targetActorId: command.targetActorId.toLowerCase(),
    sceneContext: command.sceneContext
      ? {
          ...command.sceneContext,
          sceneId: command.sceneContext.sceneId.toLowerCase(),
          sourceTokenId: command.sceneContext.sourceTokenId.toLowerCase(),
          targetTokenId: command.sceneContext.targetTokenId.toLowerCase()
        }
      : null
  }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const state = readRunState(run)
  readRunProjection(run)
  const { campaign, membership } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (!resume && membership.role !== 'OWNER') throw new Error('Campaign not found.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign System is stale.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const fingerprint = checksumCanonicalJson(input)
  const rootReceipt = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (rootReceipt) {
    if (resume || rootReceipt.actorUserId !== userId)
      throw new Error('Command ID was already used with different input.')
    return (await readNativeDisarmReplay(ctx, { run, command: input, receipt: rootReceipt })).result
  }
  if (state.version !== input.expectedVersion) throw new Error('Encounter version is stale.')
  if (state.automationMode === 'MANUAL')
    throw new Error('Disarm requires Automatic or Assisted Encounter mode.')
  const pendingOccurrences = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
    .take(2)
  if (pendingOccurrences.length > 1)
    throw new Error('Stored Encounter occurrence state is invalid.')
  const occurrence = pendingOccurrences[0]
  if (occurrence && occurrence.rootCommandId !== input.commandId)
    throw new Error('An Encounter rule occurrence is awaiting resolution.')
  const prior = occurrence ? readNativeDisarmPending(occurrence) : null
  const initiatorUserId = prior?.context.initiatorUserId ?? userId
  if (prior && prior.context.commandFingerprint !== fingerprint)
    throw new Error('Command ID was already used with different input.')
  if (!resume && prior) {
    if (initiatorUserId !== userId)
      throw new Error('Command ID was already used with different input.')
    return nativeActionPendingResult(run, occurrence!)
  }
  if (resume) {
    if (
      !occurrence ||
      !prior ||
      occurrence._id !== resume.occurrence._id ||
      occurrence.version !== resume.occurrence.version ||
      occurrence.version !== resume.response.expectedOccurrenceVersion ||
      occurrence.expectedEncounterVersion !== state.version ||
      resume.response.expectedVersion !== state.version ||
      resume.response.encounterId !== run.id ||
      resume.response.occurrenceId !== occurrence.id ||
      resume.resolution.requestId !== prior.snapshot.request.requestId
    )
      throw new Error('The Disarm occurrence version or evidence request is stale.')
    if (!(await projectNativeDisarmPendingForMember(ctx, run, campaign, membership, occurrence)))
      throw new Error('The current Disarm participant must supply this evidence.')
  }
  const usedRoot = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', campaign.id).eq('rootCommandId', input.commandId)
    )
    .unique()
  if (usedRoot && usedRoot._id !== resume?.occurrence._id)
    throw new Error('Command ID was already used with different input.')
  const [actor, target, actors] = await Promise.all([
    readRunActor(ctx, state, input.actorId),
    readRunActor(ctx, state, input.targetActorId),
    readRunActors(ctx, state)
  ])
  const preparation = await prepareNativeDisarm(ctx, {
    state,
    actor,
    target,
    actors,
    command: input,
    campaignOwnerUserId: campaign.ownerUserId,
    ...(prior ? { priorContest: prior.contest } : {})
  })
  if (prior && preparation.currentnessChecksum !== prior.context.currentnessChecksum)
    throw new Error('The pending Disarm source or target changed.')
  let contest = preparation.contest
  let resolution = resume?.resolution
  if (resume && prior) {
    const rawFaces =
      resume.resolution.kind === 'ENTER_DICE'
        ? [...resume.resolution.rawFaces]
        : Array.from(
            { length: prior.policy.rollMode === 'NORMAL' ? 1 : 2 },
            () => nextRollInt(20) + 1
          )
    resolution = { kind: 'ENTER_DICE', requestId: resume.resolution.requestId, rawFaces }
    contest = {
      ...contest,
      rollEvidence: {
        ...contest.rollEvidence,
        [prior.participant === 'INITIATOR' ? 'initiator' : 'defender']: {
          requestId: resolution.requestId,
          rawFaces
        }
      }
    }
  }
  const priorRolls = new Map<'INITIATOR' | 'DEFENDER', readonly number[]>()
  if (contest.rollEvidence.initiator)
    priorRolls.set('INITIATOR', contest.rollEvidence.initiator.rawFaces)
  if (contest.rollEvidence.defender)
    priorRolls.set('DEFENDER', contest.rollEvidence.defender.rawFaces)
  const occurrenceId = occurrence?.id ?? crypto.randomUUID()
  const occurrenceVersion = occurrence ? occurrence.version + 1 : 0
  const runtime = await createRulesRuntime(ctx, campaign.ownerUserId)
  const { checkDefinitionId: _checkDefinitionId, ...defender } = contest.defender
  const execution = await executeEncounterOptionalContestAction({
    runtime,
    automationMode: state.automationMode,
    graph: preparation.graph,
    initiator: { ...contest.initiator, requestNodeId: 'initiator_d20' },
    defender: { ...defender, requestNodeId: 'target_d20' },
    occurrenceId,
    priorRolls,
    rollD20: () => nextRollInt(20) + 1,
    ...(prior && resolution ? { continuation: prior.continuation, resolution } : {})
  })
  const updatedAt = new Date().toISOString()
  if (execution.kind === 'PENDING') {
    const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse({
      ...execution.continuation,
      snapshotKind: 'KERNEL_EVIDENCE',
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      applicationContext: {
        kind: 'ENCOUNTER_ACTION',
        schemaVersion: 1,
        commandJson: JSON.stringify(input),
        commandFingerprint: fingerprint,
        initiatorUserId,
        currentnessChecksum: checksumRuleDocument({
          actor,
          target,
          sceneContext: preparation.sceneContext,
          contest
        }),
        d20Policy: null,
        twoPhase: null,
        contest
      }
    })
    const value = encounterStoredRuleOccurrenceSchema.parse({
      id: occurrenceId,
      campaignId: campaign.id,
      encounterId: run.id,
      rootCommandId: input.commandId,
      state: 'PENDING',
      version: occurrenceVersion,
      expectedEncounterVersion: state.version,
      pendingSnapshotJson: JSON.stringify(snapshot),
      pendingSnapshotChecksum: checksumCanonicalJson(snapshot),
      completedAt: null,
      createdAt: occurrence?.createdAt ?? updatedAt,
      updatedAt
    })
    const id = occurrence?._id ?? (await ctx.db.insert('encounterRuleOccurrences', value))
    if (occurrence) await ctx.db.patch(id, value)
    const stored = await ctx.db.get(id)
    if (!stored) throw new Error('The pending Disarm was not stored.')
    const result = await projectDisarmResponse(
      ctx,
      run,
      campaign,
      membership,
      stored,
      nativeActionPendingResult(run, stored)
    )
    if (resume)
      await insertActionEvidenceReceipt(ctx, {
        occurrence: stored,
        response: resume.response,
        rootCommand: input,
        rootFingerprint: fingerprint,
        rootInitiatorUserId: initiatorUserId,
        userId,
        commandResult: result,
        result: storedRuleExecutionResultDtoSchema.parse({
          status: 'PAUSED',
          occurrenceId,
          occurrenceVersion,
          request: execution.continuation.request,
          pending: {
            kind: 'D20_EVIDENCE',
            rollMode:
              execution.participant === 'INITIATOR'
                ? contest.initiator.rollMode
                : contest.defender.rollMode
          }
        })
      })
    return result
  }
  if (!resume) {
    contest = {
      ...contest,
      rollEvidence: {
        initiator: {
          requestId: contest.initiator.requestNodeId,
          rawFaces: [...execution.initiator.rawFaces]
        },
        defender: {
          requestId: contest.defender.requestNodeId,
          rawFaces: [...execution.defender.rawFaces]
        }
      }
    }
  }
  const settled = await settleNativeDisarm(ctx, {
    preparation: { ...preparation, contest },
    execution,
    occurrenceId,
    commandId: resume?.response.commandId ?? input.commandId,
    sourceCommandId: input.commandId,
    userId,
    campaignOwnerUserId: campaign.ownerUserId,
    occurredAt: updatedAt
  })
  const nextActors = actors.map((entry) =>
    entry.id === settled.actor.id
      ? settled.actor
      : entry.id === settled.target.id
        ? settled.target
        : entry
  )
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt
  })
  const nextFacts = buildEncounterActorRuleFacts({ actors: nextActors })
  const nextRules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
    nextFacts,
    { output: preparation.prepared.actorRules }
  )
  const nextProjection = await projectNativeGm(ctx, nextState, nextActors, nextRules)
  const result = encounterCommandResultDtoSchema.parse({
    projection: nextProjection,
    roll: null,
    resolution: null,
    occurrence: {
      occurrenceId,
      occurrenceVersion,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  })
  const storedExecution = storedRuleExecutionResultDtoSchema.parse({
    status: 'COMPLETE',
    occurrenceId,
    occurrenceVersion,
    outputs: execution.execution.outputs,
    evidence: execution.execution.evidence,
    applicationOutputs: settled.applicationOutputs
  })
  const ruleResultChecksum = checksumRuleDocument(storedExecution)
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    projectionJson: JSON.stringify(nextProjection),
    projectionChecksum: checksumCanonicalJson(nextProjection),
    updatedAt
  })
  const completed = encounterStoredRuleOccurrenceSchema.parse({
    id: occurrenceId,
    campaignId: campaign.id,
    encounterId: run.id,
    rootCommandId: input.commandId,
    state: 'COMPLETED',
    version: occurrenceVersion,
    expectedEncounterVersion: nextState.version,
    pendingSnapshotJson: null,
    pendingSnapshotChecksum: null,
    completedAt: updatedAt,
    createdAt: occurrence?.createdAt ?? updatedAt,
    updatedAt
  })
  const completedId =
    occurrence?._id ?? (await ctx.db.insert('encounterRuleOccurrences', completed))
  if (occurrence) await ctx.db.patch(completedId, completed)
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      occurrenceId,
      commandId: input.commandId,
      commandType: 'RESOLVE_ACTION',
      commandFingerprint: fingerprint,
      encounterVersion: nextState.version,
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'START',
          definitionId: preparation.graph.published.id,
          expectedAggregateVersion: input.expectedVersion,
          factsChecksum: checksumRuleDocument(execution.execution.evidence.facts),
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      ),
      resultJson: JSON.stringify(storedExecution),
      resultChecksum: ruleResultChecksum,
      actorUserId: initiatorUserId,
      correlationId: null,
      createdAt: updatedAt
    })
  )
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.commandId,
      commandType: 'RESOLVE_ACTION',
      ruleOccurrenceId: occurrenceId,
      ruleResultChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      commandFingerprint: fingerprint,
      actorUserId: initiatorUserId,
      version: nextState.version,
      commandJson: JSON.stringify(input),
      resultJson: JSON.stringify(result),
      resultChecksum: checksumCanonicalJson(result),
      createdAt: updatedAt
    })
  )
  const completedOccurrence = await ctx.db.get(completedId)
  if (!completedOccurrence) throw new Error('The completed Disarm was not stored.')
  const responseResult = await projectDisarmResponse(
    ctx,
    run,
    campaign,
    membership,
    completedOccurrence,
    result
  )
  if (resume)
    await insertActionEvidenceReceipt(ctx, {
      occurrence: completedOccurrence,
      response: resume.response,
      rootCommand: input,
      rootFingerprint: fingerprint,
      rootInitiatorUserId: initiatorUserId,
      userId,
      commandResult: responseResult,
      result: storedExecution
    })
  return responseResult
}

/** Called only for occurrences `readNativeEncounterOccurrenceOwner` assigns to Disarm. */
export async function resumeNativeDisarm(
  ctx: MutationCtx,
  response: ResolveRuleOccurrenceInputDto,
  run: Doc<'encounterRuns'>,
  userId: string
): Promise<EncounterCommandResultDto> {
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', response.occurrenceId))
    .unique()
  if (!occurrence) throw new Error('Rule occurrence is unavailable.')
  const rootReceipt = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', run.campaignId).eq('commandId', occurrence.rootCommandId)
    )
    .unique()
  if (
    occurrence.encounterId !== run.id ||
    occurrence.campaignId !== run.campaignId ||
    response.encounterId !== run.id
  )
    throw new Error('The Disarm occurrence scope is invalid.')
  const state = readRunState(run)
  readRunProjection(run)
  const { campaign, membership } = await requireCampaignAuthority(ctx, run.campaignId, userId)
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign System is stale.')
  const pending = occurrence.state === 'PENDING' ? readNativeDisarmPending(occurrence) : null
  let command = pending?.command
  if (!command) {
    if (rootReceipt?.commandType !== 'RESOLVE_ACTION')
      throw new Error('Stored Disarm action root is missing.')
    const parsed = encounterExecuteInputSchema.parse({
      command: JSON.parse(rootReceipt.commandJson)
    }).command
    if (parsed.type !== 'RESOLVE_ACTION') throw new Error('Stored Disarm action root is invalid.')
    command = parsed
  }
  const initiatorUserId = pending?.context.initiatorUserId ?? rootReceipt!.actorUserId
  const rootReplay = rootReceipt
    ? await readNativeDisarmReplay(ctx, { run, command, receipt: rootReceipt })
    : null
  const receipt = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', response.commandId)
    )
    .unique()
  if (receipt) {
    const replay = readNativeDisarmEvidenceReplay({
      receipt,
      occurrence,
      response,
      rootCommand: command,
      initiatorUserId,
      userId
    })
    if (receipt.encounterVersion > run.version)
      throw new Error('Stored Disarm evidence aggregate mismatch.')
    if (
      replay.payload.status === 'COMPLETE' &&
      (!rootReplay ||
        checksumRuleDocument(replay.payload) !== checksumRuleDocument(rootReplay.payload))
    )
      throw new Error('Stored Disarm terminal evidence receipt mismatch.')
    if (membership.role !== 'OWNER')
      encounterPlayerProjectionDtoSchema.parse(replay.result.projection)
    return replay.result
  }
  if (
    !pending ||
    occurrence.version !== response.expectedOccurrenceVersion ||
    run.version !== response.expectedVersion ||
    occurrence.expectedEncounterVersion !== run.version
  )
    throw new Error('The Disarm occurrence version is stale.')
  if (response.commandId === command.commandId || rootReceipt)
    throw new Error('Command ID was already used with different input.')
  const [usedCommand, usedRoot] = await Promise.all([
    ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaign.id).eq('commandId', response.commandId)
      )
      .unique(),
    ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_campaignId_rootCommandId', (q) =>
        q.eq('campaignId', campaign.id).eq('rootCommandId', response.commandId)
      )
      .unique()
  ])
  if (usedCommand || usedRoot) throw new Error('Command ID was already used with different input.')
  const resolution = response.resolution
  if (resolution.kind !== 'ENTER_DICE' && resolution.kind !== 'SYSTEM_ROLL')
    throw new Error('Disarm requires d20 evidence.')
  return executeNativeDisarm(ctx, command, userId, { occurrence, response, resolution })
}
