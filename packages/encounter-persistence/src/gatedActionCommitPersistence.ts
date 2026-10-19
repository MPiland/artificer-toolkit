import type { LiveSessionEncounterGatedActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
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
import { settleActionSourceSpend, sourceSpendMutation } from './actionSourceSpend.js'
import { endEffects } from './consumedGrantPersistence.js'
import { readRunActors } from './documents.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { projectNativeGm } from './nativeProjection.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { presentEncounterResultForMember } from './resultPresentation.js'

/**
 * Commits an attack or harmful spell a warded creature's gate stopped, in the transaction of the roll
 * that failed the attacker's save: the root with the source's one spend and nothing of the action. When
 * the save was asked of a player, the sealed offer the answer resumed must be the gate the root records.
 */
export async function persistEncounterGatedActionCommit(
  ctx: EncounterCharacterWriteTransaction,
  input: LiveSessionEncounterGatedActionCommitInput,
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
    command.optionalCombatIntent != null ||
    rootExecution.status !== 'AGGREGATE_CHOICE_COMPLETE' ||
    rootExecution.applicationOutputs.kind !== 'ENCOUNTER_GATED_ACTION' ||
    rootExecution.occurrenceVersion !== (resume ? resume.occurrence.version + 1 : 0) ||
    (resume && rootExecution.occurrenceId !== resume.occurrence.id) ||
    // A save asked of a player is always the answer to the pause that offered it.
    Boolean(resume) !== Boolean(response)
  )
    throw new Error('Live Session terminal action is not an ordinary gated action.')
  const root = rootExecution.applicationOutputs
  // The failed save is lost by its roll, or by the attacker declining the retarget it earned.
  const retarget = resume?.pending.context.attackRetarget
  const offered = resume?.pending.context.incomingGate ?? retarget?.gate
  if (
    resume &&
    (!offered ||
      !response ||
      (retarget
        ? response.resolution.kind !== 'DECLINE' ||
          checksumCanonicalJson(retarget.gate.d20) !== checksumCanonicalJson(root.gate.d20)
        : response.resolution.kind !== 'ENTER_DICE' &&
          response.resolution.kind !== 'SYSTEM_ROLL') ||
      offered.effectId !== root.gate.effectId ||
      offered.holderActorId !== root.gate.holderActorId ||
      offered.checkDefinitionId !== root.gate.checkDefinitionId ||
      offered.dc !== root.gate.dc)
  )
    throw new Error('Live Session gated action offer mismatch.')
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session gated action offer mismatch.')
  const actors = await readRunActors(ctx, state)
  const source = actors.find((actor) => actor.id === command.actorId)
  const holder = actors.find((actor) => actor.id === root.gate.holderActorId)
  if (
    !source ||
    root.sourceActorId !== source.id ||
    root.sourceCharacterId !== (source.kind === 'CHARACTER' ? source.sourceId : null) ||
    !holder ||
    holder.id === source.id
  )
    throw new Error('Live Session gated action actor scope mismatch.')
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    input.rules.actors.length !== ruleActors.length ||
    new Set(input.rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
    input.rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error('Live Session gated action output scope mismatch.')
  await callbacks.validateReadFence(
    state,
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : [])),
    input.revisions
  )
  const collision = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', root.occurrenceId))
    .unique()
  if (collision && collision._id !== resume?.occurrence._id)
    throw new Error('Encounter rule occurrence ID was already used.')

  const { spends, mutation } = sourceSpendMutation({
    source,
    command,
    resource: input.resourceConsumption,
    item: input.itemConsumption,
    spell: input.spellConsumption,
    receipts: root
  })
  const sourceMechanics =
    source.kind === 'CHARACTER' && (spends || root.sourceApplications.length)
      ? await callbacks.applyMechanics({
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          occurrenceId: root.occurrenceId,
          sourceCommandId: command.commandId,
          occurredAt: input.occurredAt,
          forceVersionAdvance: false,
          applications: root.sourceApplications.map((application) => ({
            ...application,
            targetActorId: source.id
          })),
          targetActorId: source.id,
          commandId: deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: root.occurrenceId,
            sourceCommandId: command.commandId,
            phase: 'DIRECT_ACTION_RESOURCE',
            ordinal: 0,
            targetCharacterId: source.sourceId
          }),
          effectiveMaximumHitPoints: await callbacks.currentCharacterMaximumHitPoints(
            state,
            source.sourceId
          ),
          ...mutation
        })
      : null
  if (
    (sourceMechanics?.characterStreamVersion ?? null) !== root.sourceCharacterStreamVersion ||
    checksumCanonicalJson(sourceMechanics?.receiptApplications ?? []) !==
      checksumCanonicalJson(root.sourceApplications) ||
    checksumCanonicalJson(sourceMechanics?.itemUseStateTransition ?? null) !==
      checksumCanonicalJson(root.sourceItemUseStateTransition)
  )
    throw new Error('Live Session source Character receipt mismatch.')

  const settledSource = await settleActionSourceSpend(ctx, {
    encounterId: state.id,
    source: sourceMechanics?.updatedActor ?? source,
    spend: { ...root, attackActionTransition: undefined },
    economyOverridden: overridesActionEconomy(input.ruleOverrides)
  })
  const endedMaintainedStates = await endEffects(ctx, input.consumedGrants)
  const nextActors = actors.map((actor) => (actor.id === source.id ? settledSource : actor))
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
    resume: resume ? { occurrence: resume.occurrence } : null,
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
    // No graph ran: the receipt names the facts the held action was prepared against.
    factsChecksum: input.currentnessChecksum,
    result,
    commandFields: {
      label: input.label,
      ruleOverrides: input.ruleOverrides,
      consumedGrants: input.consumedGrants,
      endedMaintainedStates,
      addedConcentrationCasterId: null,
      speedBonusTurn: null,
      teleportAllowanceTurn: null,
      turnUses: null,
      failedCounters: []
    },
    occurredAt: input.occurredAt
  })
  if (resume && response)
    await insertActionEvidenceReceipt(ctx, {
      occurrence: { ...resume.occurrence, ...completedOccurrence },
      response,
      rootCommand: command,
      rootFingerprint: fingerprint,
      userId: input.expectedUserId,
      rootInitiatorUserId: initiatorUserId,
      answeredRequestId: resume.pending.snapshot.request.requestId,
      result: rootExecution
    })
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
