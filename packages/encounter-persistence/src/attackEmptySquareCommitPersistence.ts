import {
  actionAreaSceneRequestDtoSchema,
  type ActionAreaSceneRequestDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterEmptySquareCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
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
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { readLiveEncounterActionAdmission } from './liveActionAdmission.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import { completeActionOccurrence, recordActionRoot } from './actionCommitRecords.js'
import { settleActionSourceSpend, sourceSpendMutation } from './actionSourceSpend.js'
import { actionSystemRollAnswers, readAppCardedDice } from './appCardedDice.js'
import { recordActionRollCards, settledD20s } from './actionRollCards.js'
import { deleteGrants, receiptConsumedGrants } from './consumedGrantPersistence.js'
import { readRunActors } from './documents.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { projectNativeGm } from './nativeProjection.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'
import { presentEncounterResultForMember } from './resultPresentation.js'

/**
 * Commits an attack on a square the GM ruled empty, in the transaction of the attacker's d20 answer:
 * the root with the attacker's one spend and the d20 as a miss. Nothing else changes, so it has no
 * target, effect, Concentration or child to write; the attacker's card shows the d20 and total only.
 */
export async function persistEncounterAttackEmptySquareCommit(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: LiveSessionEncounterEmptySquareCommitInput,
  callbacks: {
    readAreaSceneInputs(
      state: EncounterRunState,
      input: ActionAreaSceneRequestDto
    ): Promise<Extract<LiveSessionEncounterRulesResponse, { kind: 'ACTION_AREA_SCENE' }>['context']>
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
  const { execution } = input
  // The attacker's d20 answers the pending the GM's ruling opened, or the ruling itself settles it
  // for an attacker who auto-rolls; either way it is the command the ruling derived.
  const version = resume ? resume.occurrence.version + 1 : 0
  if (
    command.type !== 'RESOLVE_ACTION' ||
    command.target.kind !== 'SQUARE' ||
    command.optionalCombatIntent != null ||
    execution.status !== 'COMPLETE' ||
    execution.applicationOutputs.kind !== 'ATTACK_EMPTY_SQUARE' ||
    (resume && execution.occurrenceId !== resume.occurrence.id) ||
    execution.occurrenceVersion !== version
  )
    throw new Error('Live Session terminal action is not an empty-square attack.')
  const { target } = command
  const root = execution.applicationOutputs
  if (
    execution.evidence.source.definitionId !== input.initialDefinitionId ||
    execution.evidence.source.gameSystemId !== state.gameSystemId ||
    root.occurrenceId !== execution.occurrenceId ||
    root.sourceActorId !== command.actorId ||
    input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code))
  )
    throw new Error('Live Session empty-square result scope mismatch.')
  const actors = await readRunActors(ctx, state)
  const source = actors.find((actor) => actor.id === command.actorId)
  if (!source || root.sourceCharacterId !== (source.kind === 'CHARACTER' ? source.sourceId : null))
    throw new Error('Live Session empty-square actor scope mismatch.')
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    input.rules.actors.length !== ruleActors.length ||
    new Set(input.rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
    input.rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error('Live Session empty-square output scope mismatch.')
  await callbacks.readAreaSceneInputs(
    state,
    actionAreaSceneRequestDtoSchema.parse({
      actorId: command.actorId,
      sceneId: target.sceneId,
      expectedSceneVersion: target.expectedSceneVersion
    })
  )
  await callbacks.validateReadFence(
    state,
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : [])),
    input.revisions
  )
  const collision = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', execution.occurrenceId))
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
    spends && source.kind === 'CHARACTER'
      ? await callbacks.applyMechanics({
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          occurrenceId: execution.occurrenceId,
          sourceCommandId: command.commandId,
          occurredAt: input.occurredAt,
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
          ...mutation
        })
      : null
  if (
    (sourceMechanics?.characterStreamVersion ?? null) !== root.sourceCharacterStreamVersion ||
    checksumCanonicalJson(sourceMechanics?.itemUseStateTransition ?? null) !==
      checksumCanonicalJson(root.sourceItemUseStateTransition)
  )
    throw new Error('Live Session source Character receipt mismatch.')
  const settledSource = await settleActionSourceSpend(ctx, {
    encounterId: state.id,
    source: sourceMechanics?.updatedActor ?? source,
    spend: root,
    economyOverridden: overridesActionEconomy(input.ruleOverrides)
  })
  // The one-roll grants the d20 used up end with the roll.
  await deleteGrants(ctx, input.consumedGrants)
  const nextActors = actors.map((actor) => (actor.id === source.id ? settledSource : actor))
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
    version,
    resume,
    occurredAt: input.occurredAt
  })
  const projection = await projectNativeGm(ctx, nextState, nextActors, input.rules)
  await recordActionRollCards(ctx, {
    campaign,
    encounterId: state.id,
    gameSystemId: state.gameSystemId,
    rollScope: execution.occurrenceId,
    batch: { d20: root.d20, nestedD20: null, applications: [] },
    actionLabel: (await ctx.ports.readContentLabel(input.actionDefinitionId)) ?? 'Action',
    source,
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
      dice: settledD20s({ d20: root.d20, nestedD20: null })
    })
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: execution.occurrenceId,
      occurrenceVersion: version,
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
    execution,
    definitionId: input.initialDefinitionId,
    factsChecksum: execution.initialFactsChecksum,
    result,
    commandFields: {
      label: input.label,
      ruleOverrides: input.ruleOverrides,
      consumedGrants: receiptConsumedGrants({
        consumedGrants: input.consumedGrants,
        endedGrants: []
      }),
      endedMaintainedStates: [],
      addedConcentrationCasterId: null,
      speedBonusTurn: null,
      turnUses: null
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
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
