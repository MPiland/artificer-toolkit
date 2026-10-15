import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { ActionSceneRequestDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { executionAddsSpeedToMovement } from '@artificer-toolkit/rules-runtime/systems/dnd5e/addSpeedToMovement'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { readLiveEncounterActionAdmission } from './liveActionAdmission.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import { readRunActors } from './documents.js'
import { sourceSpendMutation, settleActionSourceSpend } from './actionSourceSpend.js'
import { completeActionOccurrence, recordActionRoot } from './actionCommitRecords.js'
import { deleteConsumedGrants, receiptConsumedGrants } from './consumedGrantPersistence.js'
import { projectNativeGm } from './nativeProjection.js'
import { recordTurnSpeedBonus } from './turnMovement.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import type { readEncounterMaintenanceCapture } from './maintenanceCapture.js'
import type {
  prepareEncounterActionMaintenance,
  persistEncounterActionEffects
} from './actionEffectPersistence.js'
import type { persistEncounterActionChildren } from './actionChildrenPersistence.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'
import { actionSystemRollAnswers, readAppCardedDice } from './appCardedDice.js'
import { recordActionRollCards, settledD20s } from './actionRollCards.js'

/** Validates the admitted completed root and applies its native writes in the owning transaction. */
export async function persistEncounterActionCommit(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: LiveSessionEncounterActionCommitInput,
  callbacks: {
    readMaintenanceCapture(
      state: EncounterRunState,
      request: LiveSessionEncounterActionCommitInput['maintenanceOwners'][number]
    ): ReturnType<typeof readEncounterMaintenanceCapture>
    readActionSceneInputs(
      state: EncounterRunState,
      input: ActionSceneRequestDto,
      role: 'OWNER' | 'MEMBER'
    ): Promise<Extract<LiveSessionEncounterRulesResponse, { kind: 'ACTION_SCENE' }>['context']>
    validateReadFence(
      state: EncounterRunState,
      characterIds: readonly string[],
      revisions: LiveSessionRulesRevisions
    ): Promise<void>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    currentCharacterMaximumHitPoints(state: EncounterRunState, characterId: string): Promise<number>
    prepareActionMaintenance(
      input: Parameters<typeof prepareEncounterActionMaintenance>[1]
    ): ReturnType<typeof prepareEncounterActionMaintenance>
    persistActionEffects(
      input: Parameters<typeof persistEncounterActionEffects>[1]
    ): ReturnType<typeof persistEncounterActionEffects>
    persistActionChildren(
      input: Parameters<typeof persistEncounterActionChildren>[1]
    ): ReturnType<typeof persistEncounterActionChildren>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readLiveEncounterActionAdmission(ctx, input)
  const userId = input.expectedUserId
  const { state, run, fingerprint, campaign, membership } = admission
  if (state.campaignId !== input.campaignId)
    throw new Error('Live Session Encounter scope mismatch.')
  // A lost response replays before checking revisions consumed by the successful transaction.
  if (admission.kind === 'REPLAY')
    return presentEncounterResultForMember(ctx, {
      campaign,
      membership,
      result: admission.result
    })
  const { resume, initiatorUserId } = admission
  const occurrenceVersion = resume ? resume.occurrence.version + 1 : 0
  const command = admission.input
  const execution = input.execution
  if (
    execution.status !== 'COMPLETE' ||
    execution.occurrenceVersion !== occurrenceVersion ||
    (resume && execution.occurrenceId !== resume.occurrence.id) ||
    command.optionalCombatIntent != null ||
    command.target.kind !== 'ACTOR'
  )
    throw new Error('Live Session terminal action is not an ordinary completed root.')
  const targetActorId = command.target.actorId
  const initialEvidence = execution.phaseReceipts?.[0]?.execution.evidence ?? execution.evidence
  if (
    initialEvidence.source.definitionId !== input.initialDefinitionId ||
    initialEvidence.source.gameSystemId !== state.gameSystemId ||
    execution.evidence.source.gameSystemId !== state.gameSystemId ||
    execution.phaseReceipts?.some((phase) => phase.template.gameSystemId !== state.gameSystemId)
  )
    throw new Error('Live Session action evidence source mismatch.')
  const batch = execution.applicationOutputs
  // The room gated these warnings; only codes the command acknowledged may be recorded.
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session action overrides were not acknowledged.')
  if (
    (batch.kind !== 'CHARACTER_MECHANICS_BATCH' &&
      batch.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') ||
    batch.sourceActorId !== command.actorId ||
    batch.targetActorId !== targetActorId ||
    batch.occurrenceId !== execution.occurrenceId
  )
    throw new Error('Live Session action result scope mismatch.')
  const actors = await readRunActors(ctx, state)
  const source = actors.find((actor) => actor.id === command.actorId)
  const target = actors.find((actor) => actor.id === targetActorId)
  if (
    !source ||
    !target ||
    (target.kind === 'CHARACTER') !== (batch.kind === 'CHARACTER_MECHANICS_BATCH')
  )
    throw new Error('Live Session action actor scope mismatch.')
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    ('sourceCharacterId' in batch &&
      batch.sourceCharacterId !== (source.kind === 'CHARACTER' ? source.sourceId : null)) ||
    (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
      (batch.spellCastConsumption !== null || batch.targetFeatureResourceConsumption !== null)) ||
    input.rules.actors.length !== ruleActors.length ||
    new Set(input.rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
    input.rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error('Live Session action output scope mismatch.')
  const characterIds = new Set(
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  const ownerRequests = new Set<string>()
  for (const request of input.maintenanceOwners) {
    const key = checksumCanonicalJson(request)
    if ((request.actorId !== source.id && request.actorId !== target.id) || ownerRequests.has(key))
      throw new Error('Live Session maintenance owner scope mismatch.')
    ownerRequests.add(key)
    await callbacks.readMaintenanceCapture(state, request)
    if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
  }
  await callbacks.readActionSceneInputs(
    state,
    {
      actorId: command.actorId,
      targetActorId,
      sceneContext: command.sceneContext
    },
    membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
  )
  await callbacks.validateReadFence(state, [...characterIds], input.revisions)
  const collision = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', execution.occurrenceId))
    .unique()
  if (collision && collision._id !== resume?.occurrence._id)
    throw new Error('Encounter rule occurrence ID was already used.')
  const effectInput = {
    state,
    command,
    execution,
    maintainedState: input.maintainedState,
    createdEffects: input.createdEffects,
    authorizedCharacterIds: characterIds
  }
  const maintenance = await callbacks.prepareActionMaintenance(effectInput)
  const { spends, mutation: sourceMutation } = sourceSpendMutation({
    source,
    command,
    resource: input.resourceConsumption,
    item: input.itemConsumption,
    receipts: batch
  })
  const common = {
    encounterId: state.id,
    expectedEncounterVersion: state.version,
    occurrenceId: execution.occurrenceId,
    sourceCommandId: command.commandId,
    occurredAt: input.occurredAt
  }
  const sourceMechanics =
    spends && source.id !== target.id && source.kind === 'CHARACTER'
      ? await callbacks.applyMechanics({
          ...common,
          targetActorId: source.id,
          commandId: deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: execution.occurrenceId,
            sourceCommandId: command.commandId,
            phase: 'DIRECT_ACTION_RESOURCE',
            ordinal: 0,
            targetCharacterId: source.sourceId
          }),
          applications: [],
          effectiveMaximumHitPoints: await callbacks.currentCharacterMaximumHitPoints(
            state,
            source.sourceId
          ),
          forceVersionAdvance: false,
          ...sourceMutation
        })
      : null
  const mechanics = await callbacks.applyMechanics({
    ...common,
    targetActorId: target.id,
    commandId: command.commandId,
    applications: batch.applications.map((application) => ({
      ...application,
      targetActorId: target.id
    })),
    effectiveMaximumHitPoints: batch.targetTransition.before.maximumHitPoints,
    effectiveScalarValues: batch.targetTransition.before.scalarValues,
    forceVersionAdvance: target.kind === 'CHARACTER' && input.createdEffects.length > 0,
    ...(source.id === target.id ? sourceMutation : {})
  })
  if (
    checksumCanonicalJson(mechanics.receiptApplications) !==
      checksumCanonicalJson(batch.applications) ||
    checksumCanonicalJson(mechanics.targetTransition) !==
      checksumCanonicalJson(batch.targetTransition) ||
    (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
      batch.targetCharacterStreamVersion !== mechanics.characterStreamVersion) ||
    // The accepted stow must be exactly the one the room planned and this commit applied.
    checksumCanonicalJson(
      (source.id === target.id ? mechanics : sourceMechanics)?.itemUseStateTransition ?? null
    ) !== checksumCanonicalJson(batch.sourceItemUseStateTransition)
  )
    throw new Error('Live Session mechanics receipt mismatch.')
  // A Legendary Resistance the target used spends one of its own charges with the outcome.
  const targetCharge =
    batch.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ? batch.targetFeatureResourceConsumption : null
  if (targetCharge && targetCharge.ownerActorId !== target.id)
    throw new Error('Live Session action charge scope mismatch.')
  const settledTarget = targetCharge
    ? await settleActionSourceSpend(ctx, {
        encounterId: state.id,
        source: mechanics.updatedActor,
        spend: {
          featureResourceConsumption: targetCharge,
          actionEconomyTransition: null,
          attackActionTransition: undefined
        },
        economyOverridden: false
      })
    : mechanics.updatedActor
  const beforeSource =
    sourceMechanics?.updatedActor ?? (source.id === target.id ? settledTarget : source)
  const settledSource = await settleActionSourceSpend(ctx, {
    encounterId: state.id,
    source: beforeSource,
    spend: batch,
    economyOverridden: overridesActionEconomy(input.ruleOverrides)
  })
  let nextActors = actors.map((actor) =>
    actor.id === source.id ? settledSource : actor.id === target.id ? settledTarget : actor
  )
  nextActors = await callbacks.persistActionEffects({
    ...effectInput,
    maintenance,
    actors: nextActors,
    occurredAt: input.occurredAt
  })
  // The one-roll grants the rolls used up (Vicious Mockery's disadvantage, Help) end with the roll.
  await deleteConsumedGrants(ctx, input.consumedGrants)
  const sourceVersion =
    sourceMechanics?.characterStreamVersion ??
    (source.kind === 'CHARACTER' && source.id !== target.id
      ? (batch.maintenanceTransition?.characterOwnerTransitions.find(
          (entry) => entry.characterId === source.sourceId
        )?.afterStreamVersion ?? null)
      : null)
  if (batch.sourceCharacterStreamVersion !== sourceVersion)
    throw new Error('Live Session source Character receipt mismatch.')
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const completedOccurrence = await completeActionOccurrence(ctx, {
    state,
    nextState,
    occurrenceId: execution.occurrenceId,
    rootCommandId: command.commandId,
    version: occurrenceVersion,
    resume,
    occurredAt: input.occurredAt
  })
  nextActors = await callbacks.persistActionChildren({
    input,
    state: nextState,
    actors: nextActors,
    execution,
    fingerprint,
    userId,
    authorizedCharacterIds: characterIds
  })
  const projection = await projectNativeGm(ctx, nextState, nextActors, input.rules)
  // Each d20 the action rolled gets a chat card: an attack is the source's, a save the target's.
  await recordActionRollCards(ctx, {
    campaign,
    encounterId: state.id,
    gameSystemId: state.gameSystemId,
    rollScope: execution.occurrenceId,
    batch,
    actionLabel: (await ctx.ports.readContentLabel(input.initialDefinitionId)) ?? 'Action',
    source,
    target,
    initiatorUserId,
    visibility: command.visibility,
    createdAt: input.occurredAt,
    appCardedD20s: await readAppCardedDice(ctx, {
      occurrenceId: execution.occurrenceId,
      answers: await actionSystemRollAnswers(ctx, {
        occurrenceId: execution.occurrenceId,
        response: input.response,
        responderUserId: userId
      }),
      dice: settledD20s(batch)
    })
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: execution.occurrenceId,
      occurrenceVersion,
      status: 'COMPLETE',
      pending: null
    }
  })
  // A Dash adds the actor's speed to this turn's movement; the stored execution proves it resolved.
  const addsSpeed = executionAddsSpeedToMovement(execution)
  if (addsSpeed) await recordTurnSpeedBonus(ctx, { state, actorId: source.id })
  await recordActionRoot(ctx, {
    run,
    state,
    nextState,
    command,
    fingerprint,
    initiatorUserId,
    execution,
    definitionId: input.initialDefinitionId,
    factsChecksum: execution.initialFactsChecksum,
    result,
    commandFields: {
      label: input.label,
      ruleOverrides: input.ruleOverrides,
      consumedGrants: receiptConsumedGrants(input),
      addedConcentrationCasterId: maintenance?.addedConcentrationCasterId ?? null,
      speedBonusTurn: addsSpeed ? { round: state.round, turnActorId: source.id } : null
    },
    occurredAt: input.occurredAt
  })
  if (resume && input.response)
    await insertActionEvidenceReceipt(ctx, {
      occurrence: { ...resume.occurrence, ...completedOccurrence },
      response: input.response,
      rootCommand: command,
      rootFingerprint: fingerprint,
      userId,
      rootInitiatorUserId: initiatorUserId,
      answeredRequestId: resume.pending.snapshot.request.requestId,
      result: execution
    })
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result
  })
}
