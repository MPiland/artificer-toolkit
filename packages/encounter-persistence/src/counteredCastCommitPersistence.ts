import type { LiveSessionEncounterCounteredCastCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { readLiveEncounterActionAdmission } from './liveActionAdmission.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import { completeActionOccurrence, recordActionRoot } from './actionCommitRecords.js'
import { castCounteredCarriesFailedCounters } from './actionPending.js'
import { applyFailedCounterSpends, failedCounterSpends } from './failedCounterSpend.js'
import { settleActionSourceSpend, sourceSpendMutation } from './actionSourceSpend.js'
import { readRunActors } from './documents.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { projectNativeGm } from './nativeProjection.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { presentEncounterResultForMember } from './resultPresentation.js'

/**
 * Commits a cast that another creature countered, in the transaction of the answer that used the
 * counter: the root with the caster's one spend and the reactor's own (its slot and its reaction),
 * and nothing of the spell. The sealed offer the answer resumed must be the one the counter used.
 */
export async function persistEncounterCounteredCastCommit(
  ctx: EncounterCharacterWriteTransaction,
  input: LiveSessionEncounterCounteredCastCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      characterIds: readonly string[],
      revisions: LiveSessionRulesRevisions
    ): Promise<void>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    currentCharacterMaximumHitPoints(state: EncounterRunState, characterId: string): Promise<number>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readLiveEncounterActionAdmission(ctx, input)
  const userId = input.expectedUserId
  const { state, run, fingerprint, campaign, membership } = admission
  if (state.campaignId !== input.campaignId)
    throw new Error('Live Session Encounter scope mismatch.')
  if (admission.kind === 'REPLAY')
    return presentEncounterResultForMember(ctx, {
      campaign,
      membership,
      result: admission.result
    })
  const { resume, initiatorUserId } = admission
  const command = admission.input
  const rootExecution = input.execution
  const { response } = input
  if (
    command.type !== 'RESOLVE_ACTION' ||
    command.target.kind !== 'ACTOR' ||
    command.optionalCombatIntent != null ||
    // The counter is always the answer to the pause that offered it.
    !resume ||
    !response ||
    rootExecution.status !== 'AGGREGATE_CHOICE_COMPLETE' ||
    rootExecution.applicationOutputs.kind !== 'ENCOUNTER_COUNTERED_CAST' ||
    rootExecution.occurrenceVersion !== resume.occurrence.version + 1 ||
    rootExecution.occurrenceId !== resume.occurrence.id
  )
    throw new Error('Live Session terminal action is not an ordinary countered cast.')
  const root = rootExecution.applicationOutputs
  const { counter } = root
  const offered = resume.pending.context.castReaction
  if (
    !offered ||
    // The counter was chosen at the offer, or its check was rolled at the pause that chose it.
    (offered.check
      ? (response.resolution.kind !== 'ENTER_DICE' && response.resolution.kind !== 'SYSTEM_ROLL') ||
        counter.check === null ||
        checksumCanonicalJson(offered.check.choiceExecution) !==
          checksumCanonicalJson(counter.choiceExecution)
      : response.resolution.kind !== 'OPTION' ||
        response.resolution.optionId !== counter.reaction.useOptionId) ||
    !offered.reactions.some(
      (pin) => checksumCanonicalJson(pin) === checksumCanonicalJson(counter.reaction)
    ) ||
    !castCounteredCarriesFailedCounters(resume.pending.context, {
      failedCounters: input.failedCounters.map(({ receipt }) => receipt)
    }) ||
    input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code))
  )
    throw new Error('Live Session countered cast offer mismatch.')
  const actors = await readRunActors(ctx, state)
  const source = actors.find((actor) => actor.id === command.actorId)
  const reactor = actors.find((actor) => actor.id === counter.reaction.reactorActorId)
  if (
    !source ||
    source.kind !== 'CHARACTER' ||
    root.sourceActorId !== source.id ||
    root.sourceCharacterId !== source.sourceId ||
    !reactor ||
    reactor.kind !== 'CHARACTER' ||
    reactor.id === source.id ||
    reactor.sourceId !== counter.reaction.characterId
  )
    throw new Error('Live Session countered cast actor scope mismatch.')
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    input.rules.actors.length !== ruleActors.length ||
    new Set(input.rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
    input.rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error('Live Session countered cast output scope mismatch.')
  await callbacks.validateReadFence(
    state,
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : [])),
    input.revisions
  )
  const collision = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', root.occurrenceId))
    .unique()
  if (collision && collision._id !== resume.occurrence._id)
    throw new Error('Encounter rule occurrence ID was already used.')

  const { spends, mutation: sourceMutation } = sourceSpendMutation({
    source,
    command,
    resource: input.resourceConsumption,
    item: input.itemConsumption,
    spell: input.spellConsumption,
    receipts: root
  })
  const { spends: reactorSpends, mutation: reactorMutation } = sourceSpendMutation({
    source: reactor,
    command: { acceptedWieldConflict: null },
    resource: null,
    item: null,
    spell: input.reactionSpellConsumption,
    receipts: {
      resourceConsumption: null,
      sourceItemConsumption: null,
      spellCastConsumption: counter.spellCastConsumption
    }
  })
  const failedSpends = failedCounterSpends({
    failedCounters: input.failedCounters,
    actors,
    source
  })
  if (failedSpends.some(({ reactor: failed }) => failed.id === reactor.id))
    throw new Error('Live Session failed counter reactor countered the cast.')
  const common = {
    encounterId: state.id,
    expectedEncounterVersion: state.version,
    occurrenceId: root.occurrenceId,
    sourceCommandId: command.commandId,
    occurredAt: input.occurredAt,
    applications: [],
    forceVersionAdvance: false
  }
  const spend = async (
    character: typeof source,
    mutation: typeof sourceMutation | typeof reactorMutation
  ) =>
    callbacks.applyMechanics({
      ...common,
      targetActorId: character.id,
      commandId: deriveEncounterCharacterMechanicsEventCommandId({
        occurrenceId: root.occurrenceId,
        sourceCommandId: command.commandId,
        phase: 'DIRECT_ACTION_RESOURCE',
        ordinal: 0,
        targetCharacterId: character.sourceId
      }),
      effectiveMaximumHitPoints: await callbacks.currentCharacterMaximumHitPoints(
        state,
        character.sourceId
      ),
      ...mutation
    })
  const sourceMechanics = spends ? await spend(source, sourceMutation) : null
  if (
    (sourceMechanics?.characterStreamVersion ?? null) !== root.sourceCharacterStreamVersion ||
    checksumCanonicalJson(sourceMechanics?.itemUseStateTransition ?? null) !==
      checksumCanonicalJson(root.sourceItemUseStateTransition)
  )
    throw new Error('Live Session source Character receipt mismatch.')
  const reactorMechanics = reactorSpends ? await spend(reactor, reactorMutation) : null
  if ((reactorMechanics?.characterStreamVersion ?? null) !== counter.characterStreamVersion)
    throw new Error('Live Session reactor Character receipt mismatch.')

  const settledSource = await settleActionSourceSpend(ctx, {
    encounterId: state.id,
    source: sourceMechanics?.updatedActor ?? source,
    spend: root,
    economyOverridden: overridesActionEconomy(input.ruleOverrides)
  })
  const settledReactor = await settleActionSourceSpend(ctx, {
    encounterId: state.id,
    source: reactorMechanics?.updatedActor ?? reactor,
    spend: {
      featureResourceConsumption: null,
      actionEconomyTransition: counter.actionEconomyTransition,
      attackActionTransition: undefined
    },
    economyOverridden: false
  })
  const settledFailed = await applyFailedCounterSpends(ctx, {
    state,
    occurrenceId: root.occurrenceId,
    sourceCommandId: command.commandId,
    occurredAt: input.occurredAt,
    spends: failedSpends,
    exceptActorId: null,
    applyMechanics: callbacks.applyMechanics,
    currentCharacterMaximumHitPoints: callbacks.currentCharacterMaximumHitPoints
  })
  const nextActors = actors.map((actor) =>
    actor.id === source.id
      ? settledSource
      : actor.id === reactor.id
        ? settledReactor
        : (settledFailed.get(actor.id) ?? actor)
  )
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const completedOccurrence = await completeActionOccurrence(ctx, {
    state,
    nextState,
    occurrenceId: root.occurrenceId,
    rootCommandId: command.commandId,
    version: rootExecution.occurrenceVersion,
    resume: { occurrence: resume.occurrence },
    occurredAt: input.occurredAt
  })
  const projection = await projectNativeGm(ctx, nextState, nextActors, input.rules)
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: root.occurrenceId,
      occurrenceVersion: rootExecution.occurrenceVersion,
      status: 'COMPLETE',
      pending: null
    }
  })
  await recordActionRoot(ctx, {
    run,
    state,
    nextState,
    command,
    fingerprint,
    initiatorUserId,
    execution: rootExecution,
    definitionId: input.initialDefinitionId,
    // No graph ran: the receipt names the facts the held cast was prepared against.
    factsChecksum: resume.pending.context.currentnessChecksum,
    result,
    commandFields: {
      label: input.label,
      ruleOverrides: input.ruleOverrides,
      consumedGrants: [],
      addedConcentrationCasterId: null,
      speedBonusTurn: null,
      turnUses: null,
      failedCounters: input.failedCounters.map(({ receipt }) => receipt)
    },
    occurredAt: input.occurredAt
  })
  await insertActionEvidenceReceipt(ctx, {
    occurrence: { ...resume.occurrence, ...completedOccurrence },
    response,
    rootCommand: command,
    rootFingerprint: fingerprint,
    userId,
    rootInitiatorUserId: initiatorUserId,
    answeredRequestId: resume.pending.snapshot.request.requestId,
    result: rootExecution
  })
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
