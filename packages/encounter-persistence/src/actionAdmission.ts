import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { systemAbilityDefinitions } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { parseEncounterRuleActionId } from '@artificer-toolkit/rules-runtime/encounterRuleAction'
import { readEncounterActorDefeated } from './characterStates.js'
import { requireSystemTriggerAdmission } from './systemTriggerAdmission.js'
import { nativeActionPendingResult, readNativePendingRoot } from './actionPendingResult.js'
import { readRunActor, readRunState } from './documents.js'
import { readEncounterSpellPins } from './spellPins.js'
import { readEncounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { requireEncounterActorControl } from './actorController.js'
import { presentTimelineEntry, requireUnusedEvidenceCommandId } from './timelineEntries.js'
import { rejectDomain } from './domainRejections.js'
import { requireTargetSeenByMember } from './targetVisibility.js'
import { presentStoredCommandReplay } from './resultPresentation.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * Authorizes one action and verifies sealed replay before any fresh execution. A fresh action needs
 * the caller to control the acting actor and, for players, a target they can see. A resume passes
 * the original initiator: its responder is authorized by the evidence's roller instead.
 */
export async function readNativeEncounterActionAdmission(
  ctx: EncounterReadTransaction,
  command: ResolveEncounterActionInputDto,
  userId: string,
  resume?: { occurrence: EncounterDocument<'encounterRuleOccurrences'>; initiatorUserId: string }
) {
  const { target } = command
  const input = {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    actorId: command.actorId.toLowerCase(),
    target:
      target.kind === 'ACTOR'
        ? { ...target, actorId: target.actorId.toLowerCase() }
        : target.kind === 'ACTORS'
          ? {
              ...target,
              actorIds: target.actorIds.map((actorId) => actorId.toLowerCase()),
              scene: target.scene && {
                ...target.scene,
                sceneId: target.scene.sceneId.toLowerCase()
              }
            }
          : { ...target, sceneId: target.sceneId.toLowerCase() },
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
    .withIndex('by_publicId', (query) => query.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const state = readRunState(run)
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(
    state.campaignId,
    userId
  )
  const initiatorUserId = resume?.initiatorUserId ?? userId
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign System is stale.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const fingerprint = checksumCanonicalJson(input)
  const replay = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (replay) {
    presentTimelineEntry(replay)
    if (
      replay.commandType !== 'RESOLVE_ACTION' ||
      replay.encounterId !== run.id ||
      replay.actorUserId !== initiatorUserId ||
      replay.version !== input.expectedVersion + 1 ||
      replay.version > state.version ||
      replay.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    // A CHECK action's root records its check occurrence, not a mechanics batch; its stored result replays whole.
    const { root } = replay
    if (root.kind === 'CHECK')
      return {
        kind: 'REPLAY' as const,
        input,
        run,
        state,
        campaign,
        membership,
        fingerprint,
        result: await presentStoredCommandReplay(ctx, {
          state,
          campaign,
          membership,
          stored: replay
        })
      }
    const replayReceipt = readEncounterReplayReceipt(replay)
    const { ruleOccurrenceId } = root
    if (checksumCanonicalJson(JSON.parse(replay.commandJson)) !== fingerprint)
      throw new Error('Stored Encounter action receipt mismatch.')
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (query) => query.eq('id', ruleOccurrenceId))
      .unique()
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (query) =>
        query.eq('encounterId', run.id).eq('commandId', input.commandId)
      )
      .unique()
    if (!occurrence || !receipt) throw new Error('Stored Encounter action receipt mismatch.')
    const { _id: _occurrenceId, _creationTime: _occurrenceTime, ...storedOccurrence } = occurrence
    encounterStoredRuleOccurrenceSchema.parse(storedOccurrence)
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    const commonMismatch =
      occurrence.state !== 'COMPLETED' ||
      occurrence.encounterId !== run.id ||
      occurrence.campaignId !== campaign.id ||
      occurrence.rootCommandId !== input.commandId ||
      occurrence.expectedEncounterVersion !== replay.version ||
      receipt.campaignId !== campaign.id ||
      receipt.occurrenceId !== occurrence.id ||
      receipt.commandType !== 'RESOLVE_ACTION' ||
      receipt.commandFingerprint !== fingerprint ||
      receipt.encounterVersion !== replay.version ||
      receipt.actorUserId !== initiatorUserId ||
      receipt.correlationId !== null ||
      receipt.resultChecksum !== checksumRuleDocument(payload) ||
      receipt.resultChecksum !== root.ruleResultChecksum ||
      payload.occurrenceId !== occurrence.id ||
      payload.occurrenceVersion !== occurrence.version ||
      metadata.transition !== 'START' ||
      metadata.expectedAggregateVersion !== input.expectedVersion ||
      metadata.optionalCombatSnapshotChecksum !== root.optionalCombatSnapshotChecksum ||
      replayReceipt.occurrence?.status !== 'COMPLETE' ||
      replayReceipt.occurrence.occurrenceId !== occurrence.id ||
      replayReceipt.occurrence.occurrenceVersion !== occurrence.version ||
      replayReceipt.occurrence.pending !== null ||
      replayReceipt.roll !== null
    // A countered or gated action ran no graph: its receipt names the Character spends, not rebuilt facts.
    if (payload.status === 'AGGREGATE_CHOICE_COMPLETE') {
      if (
        commonMismatch ||
        (payload.applicationOutputs.kind !== 'ENCOUNTER_COUNTERED_CAST' &&
          payload.applicationOutputs.kind !== 'ENCOUNTER_GATED_ACTION') ||
        payload.applicationOutputs.occurrenceId !== occurrence.id ||
        payload.applicationOutputs.sourceActorId !== input.actorId
      )
        throw new Error('Stored Encounter action receipt mismatch.')
    } else {
      if (payload.status !== 'COMPLETE')
        throw new Error('Stored Encounter action receipt mismatch.')
      const initialExecution = payload.phaseReceipts?.[0]?.execution ?? payload
      const terminalExecution = payload.phaseReceipts?.at(-1)?.execution ?? payload
      if (
        checksumRuleDocument({
          outputs: terminalExecution.outputs,
          evidence: terminalExecution.evidence
        }) !==
        checksumRuleDocument({
          outputs: payload.outputs,
          evidence: payload.evidence
        })
      )
        throw new Error('Stored Encounter action phase receipt mismatch.')
      if (
        commonMismatch ||
        (payload.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
          payload.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH') ||
        payload.applicationOutputs.occurrenceId !== occurrence.id ||
        payload.applicationOutputs.sourceActorId !== input.actorId ||
        (input.target.kind === 'ACTOR' &&
          payload.applicationOutputs.targetActorId !== input.target.actorId) ||
        metadata.definitionId !== initialExecution.evidence.source.definitionId ||
        (payload.initialFactsChecksum !== undefined
          ? metadata.factsChecksum !== payload.initialFactsChecksum ||
            (payload.phaseReceipts !== undefined &&
              payload.initialFactsChecksum !== payload.phaseReceipts[0]?.boundFactsChecksum)
          : metadata.factsChecksum !==
            (payload.phaseReceipts?.[0]?.boundFactsChecksum ??
              checksumRuleDocument(initialExecution.evidence.facts)))
      )
        throw new Error('Stored Encounter action receipt mismatch.')
    }
    const result = await replayEncounterCommandResult(ctx, state, replay)
    return { kind: 'REPLAY' as const, input, run, state, campaign, membership, fingerprint, result }
  }
  const { systemTrigger } = input
  // A rule's own action runs only when the rule raises it; naming it would apply its outcomes at will.
  if (
    !resume &&
    systemTrigger?.trigger !== 'RULE' &&
    parseEncounterRuleActionId(input.actorId, input.actionId)
  )
    rejectDomain(
      'SOURCE_REQUIREMENTS_NOT_MET',
      'A rule’s own action runs only when the rule raises it.'
    )
  // Only an ordinary attack at one creature is delegated; other routes never charge the commander.
  if (input.delegatingActorId !== undefined && (systemTrigger || input.target.kind !== 'ACTOR'))
    rejectDomain(
      'SOURCE_REQUIREMENTS_NOT_MET',
      'A delegated attack is one ordinary attack at one creature.'
    )
  if (systemTrigger)
    await requireSystemTriggerAdmission(ctx, {
      run,
      state,
      command: { ...input, systemTrigger },
      fresh: !resume
    })
  else if (!resume) {
    const actor = await readRunActor(ctx, state, input.actorId)
    await requireEncounterActorControl(ctx, { campaign, membership, actor })
    if (await readEncounterActorDefeated(ctx, actor)) rejectDomain('ACTOR_DEFEATED')
    if (input.delegatingActorId !== undefined) {
      // A delegated attack is the commanding actor's to make, with a creature it summoned.
      const delegating = await readRunActor(ctx, state, input.delegatingActorId)
      await requireEncounterActorControl(ctx, { campaign, membership, actor: delegating })
      if (await readEncounterActorDefeated(ctx, delegating)) rejectDomain('ACTOR_DEFEATED')
      if (actor.owner?.ownerActorId !== delegating.id)
        rejectDomain(
          'SOURCE_REQUIREMENTS_NOT_MET',
          'Only a creature the commanding actor summoned attacks in its place.'
        )
    }
    if (actor.kind === 'CREATURE') {
      // A start-of-turn trait runs by itself; naming it as an action would be a free use.
      const system = await ctx.ports.requireSystem(state.gameSystemId)
      const { passiveStartOfTurnEffects } = discoverEncounterFeatureActions({
        actor,
        conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
        abilityDefinitions: systemAbilityDefinitions(system),
        spells: await readEncounterSpellPins(ctx, state.id)
      })
      if (
        passiveStartOfTurnEffects.some(({ capability }) => capability.actionId === input.actionId)
      )
        rejectDomain(
          'SOURCE_REQUIREMENTS_NOT_MET',
          'A start-of-turn trait runs by itself at the start of the creature’s turn.'
        )
    }
    // An area names no creature: the Scene decides whom it catches. A player's own save still
    // shows only the creatures their projection holds.
    const namedActorIds =
      input.target.kind === 'ACTOR'
        ? [input.target.actorId]
        : input.target.kind === 'ACTORS'
          ? input.target.actorIds
          : []
    for (const targetActorId of namedActorIds) {
      const target = await readRunActor(ctx, state, targetActorId)
      // Players target only actors in their projection; a hidden actor reads as unavailable.
      await requireTargetSeenByMember(ctx, { encounterId: state.id, target, membership })
    }
  }
  if (state.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  if (state.status !== 'ACTIVE')
    rejectDomain('ENCOUNTER_NOT_ACTIVE', 'Actions require an active Encounter.')
  if (state.automationMode === 'MANUAL') rejectDomain('ASSISTED_ONLY')
  if (!systemTrigger && state.currentActorId !== (input.delegatingActorId ?? input.actorId))
    rejectDomain('NOT_CURRENT_ACTOR')
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (query) =>
      query.eq('encounterId', run.id).eq('state', 'PENDING')
    )
    .take(2)
  if (pending.length > 1) throw new Error('Stored Encounter occurrence state is invalid.')
  if (pending.length === 1) {
    const occurrence = pending[0]!
    if (occurrence.rootCommandId !== input.commandId) rejectDomain('PENDING_DECISION')
    const { context } = await readNativePendingRoot(ctx, occurrence)
    if (context.commandFingerprint !== fingerprint || context.initiatorUserId !== initiatorUserId)
      rejectDomain('COMMAND_ID_REUSED')
    if (!resume)
      return {
        kind: 'REPLAY' as const,
        input,
        run,
        state,
        campaign,
        membership,
        fingerprint,
        result: await nativeActionPendingResult(ctx, run, occurrence)
      }
    if (
      resume.occurrence._id !== occurrence._id ||
      resume.occurrence.version !== occurrence.version
    )
      rejectDomain('VERSION_STALE', 'The action occurrence version is stale.')
  } else if (resume) rejectDomain('VERSION_STALE', 'The action occurrence is no longer pending.')
  const usedRoot = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (query) =>
      query.eq('campaignId', campaign.id).eq('rootCommandId', input.commandId)
    )
    .unique()
  if (usedRoot && usedRoot._id !== resume?.occurrence._id) rejectDomain('COMMAND_ID_REUSED')

  return {
    kind: 'READY' as const,
    input,
    run,
    state: { ...state, automationMode: state.automationMode },
    campaign,
    membership,
    initiatorUserId,
    fingerprint
  }
}
