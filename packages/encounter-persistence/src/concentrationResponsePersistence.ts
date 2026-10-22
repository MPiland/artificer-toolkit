import type { LiveSessionEncounterConcentrationCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterConcentration'
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
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  compareDamageSaveApplications,
  damageSaveApplicationsAfterRelease,
  isMaintainedDamageApplication
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import {
  damageSaveCheckBoundApplication,
  damageSaveCheckMutatesRun
} from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { requireDerivedD20Mode } from '@artificer-toolkit/rules-runtime/encounterD20ModeValidation'
import { concentrationOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { cleavingChildOccurrenceIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { createActiveRuleEffectStore } from './effectStore.js'
import { insertRunCommand } from './timelineEntries.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { projectNativeGm, readEncounterGmProjection } from './nativeProjection.js'
import {
  persistNativeConcentrationResult,
  insertNativeCleavingChoice
} from './actionChildPersistence.js'
import { concentrationTargetPinChanged } from './concentrationTargetPin.js'
import { readEffectRepeatSaveRow, releaseEffectRepeatSave } from './effectRepeatSavePersistence.js'
import { readLiveConcentrationResponseAdmission } from './liveConcentrationResponseAdmission.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import type { readEncounterMaintenanceCapture } from './maintenanceCapture.js'
import type { applyLiveConcentrationCleanup } from './concentrationCleanupPersistence.js'
import type { persistEncounterConcentrationChildren } from './concentrationChildrenPersistence.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'

type MaintainedSlot = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createActiveRuleEffectStore>['findMaintainedState']>>
>

/** Commits the admitted check, cleanup, receipt, remaining checks and next decision atomically (D23). */
export async function persistEncounterConcentrationResponse(
  ctx: EncounterCharacterWriteTransaction & {
    ports: EncounterCharacterWriteTransaction['ports'] &
      Pick<EncounterWritePorts, 'recordConcentrationCheckRoll' | 'postRulesChatMessage'>
  },
  input: LiveSessionEncounterConcentrationCommitInput,
  callbacks: {
    currentCharacterStreamVersion(state: EncounterRunState, characterId: string): Promise<number>
    readMaintenanceCapture(
      state: EncounterRunState,
      request: LiveSessionEncounterConcentrationCommitInput['maintenanceOwners'][number]
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
    applyCleanup(
      input: Parameters<typeof applyLiveConcentrationCleanup>[1]
    ): ReturnType<typeof applyLiveConcentrationCleanup>
    persistConcentrationChildren(
      input: Parameters<typeof persistEncounterConcentrationChildren>[1]
    ): ReturnType<typeof persistEncounterConcentrationChildren>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readLiveConcentrationResponseAdmission(ctx, input)
  // The successful write consumed these versions; an exact retry must return before checking them.
  if (admission.kind === 'REPLAY') return admission.result
  const { state, run, campaign, membership, occurrence, pending, fingerprint, resolution } =
    admission
  const { context, continuation, snapshot } = pending
  const response = input.concentrationResponse
  const execution = input.execution
  if (execution.status !== 'COMPLETE' || execution.applicationOutputs.kind !== 'DAMAGE_SAVE_CHECK')
    throw new Error('Live Session concentration did not complete.')
  // The holder's end was settled with the damage that prompted this check (D95).
  if (input.concentrationEnds.length)
    throw new Error('Live Session concentration response carries unexpected ends.')
  const output = execution.applicationOutputs
  const failed = output.outcome === 'SAVE_FAILURE'
  // The save the roller made: Concentration's derived one, or the effect's frozen policy.
  const save = context.source === 'CONCENTRATION' ? context.save : context.d20Policy
  requireDerivedD20Mode({
    gameSystemId: state.gameSystemId,
    contributors: output.d20.contributors,
    rollMode: output.d20.derivedRollMode
  })
  requireDerivedD20Mode({ gameSystemId: state.gameSystemId, ...save })
  if (
    output.source !== context.source ||
    execution.occurrenceId !== occurrence.id ||
    execution.occurrenceVersion !== occurrence.version + 1 ||
    execution.initialFactsChecksum !== checksumRuleDocument(continuation.facts) ||
    execution.evidence.source.gameSystemId !== state.gameSystemId ||
    output.occurrenceId !== occurrence.id ||
    output.parentOccurrenceId !== context.parentOccurrenceId ||
    output.contextChecksum !== context.contextChecksum ||
    checksumCanonicalJson(output.systemVocabularySnapshot) !==
      checksumCanonicalJson(context.systemVocabularySnapshot) ||
    checksumCanonicalJson(output.targetCharacter) !==
      checksumCanonicalJson(context.targetCharacter) ||
    checksumCanonicalJson(output.trigger) !== checksumCanonicalJson(context.trigger) ||
    output.savingThrowAbilityDefinitionId !== save.savingThrowAbilityDefinitionId ||
    output.d20.requestId !== resolution.requestId ||
    output.d20.requestId !== continuation.request.requestId ||
    output.d20.rollMode !== save.rollMode ||
    output.d20.keep !== save.keep ||
    output.d20.modifier !== save.modifier ||
    output.d20.contributorChecksum !== save.contributorChecksum ||
    checksumCanonicalJson(output.d20.contributors) !== checksumCanonicalJson(save.contributors) ||
    (resolution.kind === 'ENTER_DICE' &&
      checksumCanonicalJson(resolution.rawFaces) !== checksumCanonicalJson(output.d20.rawFaces)) ||
    execution.outputs.total !== output.d20.total ||
    execution.outputs.resultPath !== (failed ? 'ON_SAVE_FAIL' : 'ON_SAVE_SUCCESS')
  )
    throw new Error('Live Session concentration result does not match its pending evidence.')
  if (context.source === 'CONCENTRATION' && output.source === 'CONCENTRATION') {
    if (
      execution.evidence.source.definitionId !== context.concentrationDefinition.id ||
      execution.evidence.source.checksum !== context.concentrationDefinition.checksum ||
      checksumCanonicalJson(output.concentrationDefinition) !==
        checksumCanonicalJson(context.concentrationDefinition) ||
      checksumCanonicalJson(output.application) !==
        checksumCanonicalJson({
          ...context.application,
          maintainedStateId: context.maintainedState.id
        }) ||
      execution.outputs.targetActorId !== context.application.targetActorId ||
      execution.outputs.appliedDamage !== context.application.appliedAmount ||
      execution.outputs.contributorChecksum !== context.save.contributorChecksum ||
      execution.outputs.naturalD20 !== output.d20.selectedNatural ||
      execution.outputs.dc !== output.d20.dc
    )
      throw new Error('Live Session concentration result does not match its pending evidence.')
  } else if (context.source === 'EFFECT_REPEAT_SAVE' && output.source === 'EFFECT_REPEAT_SAVE') {
    if (
      checksumCanonicalJson(output.activeEffect) !== checksumCanonicalJson(context.activeEffect) ||
      checksumCanonicalJson(output.application) !== checksumCanonicalJson(context.application) ||
      output.d20.dc !== context.d20Policy.dc
    )
      throw new Error('Live Session repeat save result does not match its pending evidence.')
  } else throw new Error('Live Session damage save result does not match its pending evidence.')

  const store = createActiveRuleEffectStore(ctx)
  const slots = new Map<string, MaintainedSlot>()
  for (const actorId of new Set(
    admission.parentApplications
      .slice(admission.applicationIndex)
      .map((application) => application.targetActorId)
  )) {
    const slot = await store.findMaintainedState({
      encounterId: state.id,
      ownerActorId: actorId,
      maintenanceDefinitionId: requireInstalledConcentrationMaintenanceDefinitionId(
        state.gameSystemId
      )
    })
    if (slot && admission.actors.some((actor) => actor.id === actorId)) slots.set(actorId, slot)
  }
  const target = admission.actors.find((actor) => actor.id === context.application.targetActorId)
  if (
    !target ||
    (await concentrationTargetPinChanged(target, context.targetCharacter, (characterId) =>
      callbacks.currentCharacterStreamVersion(state, characterId)
    ))
  )
    throw new Error('Live Session concentration target changed.')
  // The chain after the answered check, in canonical order: Concentration checks re-derived from the
  // parent's damage and the committed slots, effect checks proved to be on the parent and still held.
  const bound = damageSaveCheckBoundApplication(output)
  const effectItems = context.remaining.filter(
    (entry): entry is Extract<typeof entry, { activeEffectId: string }> =>
      !isMaintainedDamageApplication(entry)
  )
  for (const item of effectItems) {
    const { activeEffectId, ...damage } = item
    const holder = admission.actors.find((actor) => actor.id === damage.targetActorId)
    if (
      !holder ||
      !admission.parentApplications.some(
        (application) => checksumRuleDocument(application) === checksumRuleDocument(damage)
      ) ||
      !(await store.list(turnEffectOwner(holder, state.id))).some(({ id }) => id === activeEffectId)
    )
      throw new Error('Live Session repeat save damage order changed.')
  }
  const remaining = [
    ...admission.parentApplications.slice(admission.applicationIndex).flatMap((application) => {
      const maintainedStateId = slots.get(application.targetActorId)?.id
      return maintainedStateId ? [{ ...application, maintainedStateId }] : []
    }),
    ...effectItems
  ]
    .sort(compareDamageSaveApplications)
    .filter((entry) => compareDamageSaveApplications(entry, bound) > 0)
  if (checksumCanonicalJson(remaining) !== checksumCanonicalJson(context.remaining))
    throw new Error('Live Session concentration damage order changed.')
  let nextRemaining = remaining
  let slot: MaintainedSlot | null = null
  if (context.source === 'CONCENTRATION' && output.source === 'CONCENTRATION') {
    slot = slots.get(context.application.targetActorId) ?? null
    if (
      !slot ||
      checksumCanonicalJson(context.maintainedState) !==
        checksumCanonicalJson({
          id: slot.id,
          version: slot.version,
          maintenanceDefinitionId: slot.maintenanceDefinitionId,
          descriptorChecksum: slot.descriptorChecksum
        })
    )
      throw new Error('Live Session concentration target changed.')
    const maintainedStateId = slot.id
    const ended = (entry: (typeof remaining)[number]) =>
      isMaintainedDamageApplication(entry) && entry.maintainedStateId === maintainedStateId
    nextRemaining = remaining.filter((entry) => !failed || !ended(entry))
    const next = nextRemaining[0]
    if (
      output.nextOccurrenceId !==
        (next ? concentrationOccurrenceId(context.parentOccurrenceId, next) : null) ||
      checksumCanonicalJson(output.skipped) !==
        checksumCanonicalJson(
          failed
            ? remaining
                .filter(ended)
                .map((entry) => ({ ...entry, reason: 'MAINTAINED_STATE_ENDED' }))
            : []
        )
    )
      throw new Error('Live Session concentration successor mismatch.')
  } else if (context.source === 'EFFECT_REPEAT_SAVE' && output.source === 'EFFECT_REPEAT_SAVE') {
    const effect = await readEffectRepeatSaveRow(ctx, {
      encounterId: state.id,
      holder: target,
      pin: context.activeEffect
    })
    const frozen = effect.definition.frozenGraph.source
    nextRemaining = output.released
      ? damageSaveApplicationsAfterRelease(remaining, output.released.activeEffectId)
      : remaining
    const next = nextRemaining[0]
    if (
      execution.evidence.source.definitionId !== frozen.definitionId ||
      execution.evidence.source.checksum !== frozen.checksum ||
      output.nextOccurrenceId !==
        (next ? concentrationOccurrenceId(context.parentOccurrenceId, next) : null)
    )
      throw new Error('Live Session repeat save successor mismatch.')
  }

  // Remaining checks the commit auto-rolled; one version advance covers every state change (D23).
  const commitMutated =
    damageSaveCheckMutatesRun(output) ||
    input.concentration.some(
      ({ result }) =>
        result.status === 'COMPLETE' &&
        result.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
        damageSaveCheckMutatesRun(result.applicationOutputs)
    )
  const characterIds = new Set(
    admission.actors.flatMap((actor) => {
      if (actor.kind !== 'CHARACTER') return []
      return [actor.sourceId]
    })
  )
  const ownerRequests = new Set<string>()
  for (const request of input.maintenanceOwners) {
    const key = checksumCanonicalJson(request)
    const requestSlot = slots.get(request.actorId)
    if (
      !commitMutated ||
      !requestSlot ||
      request.stateId !== requestSlot.id ||
      request.definitionId !== requestSlot.maintenanceDefinitionId ||
      ownerRequests.has(key)
    )
      throw new Error('Live Session concentration owner scope mismatch.')
    ownerRequests.add(key)
    await callbacks.readMaintenanceCapture(state, request)
    if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
  }
  const deferred = snapshot.deferredCleaving
  if (deferred) {
    for (const option of deferred.options)
      await callbacks.readActionSceneInputs(
        state,
        {
          actorId: deferred.sourceActorId,
          targetActorId: option.targetActorId,
          sceneContext: {
            sceneId: deferred.scene.sceneId,
            expectedSceneVersion: deferred.scene.sceneVersion,
            sourceTokenId: deferred.scene.sourceTokenId,
            targetTokenId: option.targetTokenId
          }
        },
        membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
      )
  }
  await callbacks.validateReadFence(state, [...characterIds], input.revisions)
  const nextPending = input.pendingConcentration
  if (
    nextPending &&
    (nextPending.snapshotKind !== 'KERNEL_EVIDENCE' ||
      input.cleaving ||
      checksumCanonicalJson(nextPending.deferredCleaving ?? null) !==
        checksumCanonicalJson(deferred ?? null))
  )
    throw new Error('The next concentration decision does not match its parent.')
  let actors = admission.actors
  if (output.source === 'CONCENTRATION' && output.cleanup && slot)
    actors = await callbacks.applyCleanup({
      state,
      actors,
      slot,
      cleanup: output.cleanup,
      authorizedCharacterIds: characterIds,
      occurredAt: input.occurredAt
    })
  else if (output.source === 'EFFECT_REPEAT_SAVE')
    actors = await releaseEffectRepeatSave(ctx, {
      encounterId: state.id,
      actors,
      output,
      occurredAt: input.occurredAt
    })
  const nextState = commitMutated
    ? encounterRunStateSchema.parse({
        ...state,
        version: state.version + 1,
        updatedAt: input.occurredAt
      })
    : state
  // The remaining checks this commit auto-rolled, then the first one that prompts.
  actors = (
    await callbacks.persistConcentrationChildren({
      state: nextState,
      actors,
      parentOccurrenceId: context.parentOccurrenceId,
      parentCommandFingerprint: context.parentCommandFingerprint,
      finalizedDamageEnvelopeChecksum: context.finalizedDamageEnvelopeChecksum,
      remaining: nextRemaining,
      correlationId: occurrence.id,
      userId: input.expectedUserId,
      authorizedCharacterIds: characterIds,
      occurredAt: input.occurredAt,
      damagedActorIds: new Set(),
      concentration: input.concentration,
      concentrationEnds: input.concentrationEnds,
      endedGrants: input.endedGrants,
      answeredCheck: output,
      pendingConcentration: nextPending
    })
  ).actors
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  const rules = input.rules
  if (
    commitMutated
      ? !rules ||
        rules.actors.length !== ruleActors.length ||
        new Set(rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
        rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
      : rules !== null
  )
    throw new Error('Live Session concentration projection scope mismatch.')
  const projection =
    commitMutated && rules
      ? await projectNativeGm(ctx, nextState, actors, rules)
      : await readEncounterGmProjection(ctx, nextState)
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version + 1,
      status: 'COMPLETE',
      pending: null
    }
  })
  if (commitMutated)
    await ctx.db.patch(run._id, {
      version: nextState.version,
      stateJson: JSON.stringify(nextState),
      stateChecksum: checksumCanonicalJson(nextState),

      updatedAt: input.occurredAt
    })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: state.id,
      commandId: response.commandId,
      commandType: response.type,
      ruleOccurrenceId: occurrence.id,
      ruleResultChecksum: checksumRuleDocument(execution),
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      commandFingerprint: fingerprint,
      actorUserId: input.expectedUserId,
      version: nextState.version,
      commandJson: JSON.stringify(response),
      ...encounterReplayReceipt(result),
      createdAt: input.occurredAt
    })
  )
  await persistNativeConcentrationResult(ctx, {
    state: nextState,
    result: execution,
    occurrence,
    commandId: response.commandId,
    fingerprint,
    userId: input.expectedUserId,
    correlationId: response.correlationId ?? null,
    occurredAt: input.occurredAt,
    metadata: {
      schemaVersion: 1,
      transition: 'RESUME',
      expectedAggregateVersion: response.expectedVersion,
      expectedOccurrenceVersion: response.expectedOccurrenceVersion,
      response: { requestId: resolution.requestId, value: output.d20.selectedNatural },
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
    }
  })
  const cleaving = input.cleaving
  if (cleaving) {
    if (
      !deferred ||
      cleaving.snapshotKind !== 'AGGREGATE_CHOICE' ||
      cleaving.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING'
    )
      throw new Error('Unexpected deferred Cleaving decision.')
    const choice = cleaving.applicationContext
    if (
      cleaving.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      cleaving.occurrenceId !==
        cleavingChildOccurrenceIdentity(deferred.parentOccurrenceId, deferred.chainStep) ||
      choice.parentOccurrenceId !== deferred.parentOccurrenceId ||
      choice.parentResultChecksum !== deferred.parentResultChecksum ||
      choice.sourceActorId !== deferred.sourceActorId ||
      choice.sourceControllerCharacterId !== deferred.sourceControllerCharacterId ||
      choice.initialTargetActorId !== deferred.initialTargetActorId ||
      choice.chainStep !== deferred.chainStep ||
      checksumCanonicalJson(choice.action) !== checksumCanonicalJson(deferred.action) ||
      checksumCanonicalJson(choice.scene) !== checksumCanonicalJson(deferred.scene) ||
      checksumCanonicalJson(choice.originalAttack) !==
        checksumCanonicalJson(deferred.originalAttack) ||
      checksumCanonicalJson(choice.visitedTargetActorIds) !==
        checksumCanonicalJson(deferred.visitedTargetActorIds) ||
      choice.options.some((option) => !actors.some((actor) => actor.id === option.targetActorId))
    )
      throw new Error('Deferred Cleaving decision scope mismatch.')
    await insertNativeCleavingChoice(ctx, nextState, cleaving, input.occurredAt)
  }
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result: encounterCommandResultDtoSchema.parse({ ...result, projection })
  })
}
