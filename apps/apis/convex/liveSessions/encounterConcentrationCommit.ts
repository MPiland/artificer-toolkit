import { v } from 'convex/values'
import { liveSessionEncounterConcentrationCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterConcentration'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { concentrationOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { cleavingChildOccurrenceIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { internalMutation } from '../lib/mutations'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readEncounterCharacterStates } from '../encounters/characterStates'
import { readEncounterInitiativeRound } from '../encounters/initiativeStore'
import { readNativeActionSceneInputs } from '../encounters/actionSceneInputs'
import { insertRunCommand } from '@artificer-toolkit/encounter-persistence/timelineEntries'
import {
  persistNativeConcentrationResult,
  insertNativeCleavingChoice
} from '../encounters/actionChildPersistence'
import { persistLiveEncounterConcentrationChildren } from './encounterConcentrationChildrenCommit'
import { readLiveConcentrationResponseAdmission } from './concentrationResponseAdmission'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import { applyLiveConcentrationCleanup } from './concentrationCleanupCommit'
import { readLiveCharacterStreamVersion } from './encounterMovementTargetState'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'
import { presentEncounterResultForMember } from '../encounters/resultPresentation'

/**
 * Commits one admitted check, its cleanup and receipt, the remaining checks it auto-rolled and the
 * next decision in the same transaction (D23).
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterConcentrationCommitInputSchema.parse(args)
    const admission = await readLiveConcentrationResponseAdmission(ctx, input)
    // The successful write consumed these versions; an exact retry must return before checking them.
    if (admission.kind === 'REPLAY') return admission.result
    const { state, run, campaign, membership, occurrence, pending, fingerprint, resolution } =
      admission
    const { context, continuation, snapshot } = pending
    const response = input.concentrationResponse
    const execution = input.execution
    if (
      execution.status !== 'COMPLETE' ||
      execution.applicationOutputs.kind !== 'CONCENTRATION_CHECK'
    )
      throw new Error('Live Session concentration did not complete.')
    const output = execution.applicationOutputs
    const failed = output.outcome === 'SAVE_FAILURE'
    if (
      execution.occurrenceId !== occurrence.id ||
      execution.occurrenceVersion !== occurrence.version + 1 ||
      execution.initialFactsChecksum !== checksumRuleDocument(continuation.facts) ||
      execution.evidence.source.gameSystemId !== state.gameSystemId ||
      execution.evidence.source.definitionId !== context.concentrationDefinition.id ||
      execution.evidence.source.checksum !== context.concentrationDefinition.checksum ||
      output.occurrenceId !== occurrence.id ||
      output.parentOccurrenceId !== context.parentOccurrenceId ||
      output.contextChecksum !== context.contextChecksum ||
      checksumCanonicalJson(output.concentrationDefinition) !==
        checksumCanonicalJson(context.concentrationDefinition) ||
      checksumCanonicalJson(output.systemVocabularySnapshot) !==
        checksumCanonicalJson(context.systemVocabularySnapshot) ||
      checksumCanonicalJson(output.targetCharacter) !==
        checksumCanonicalJson(context.targetCharacter) ||
      checksumCanonicalJson(output.application) !==
        checksumCanonicalJson({
          ...context.application,
          maintainedStateId: context.maintainedState.id
        }) ||
      checksumCanonicalJson(output.trigger) !== checksumCanonicalJson(context.trigger) ||
      output.savingThrowAbilityDefinitionId !== context.save.savingThrowAbilityDefinitionId ||
      output.d20.requestId !== resolution.requestId ||
      output.d20.requestId !== continuation.request.requestId ||
      output.d20.rollMode !== context.save.rollMode ||
      output.d20.modifier !== context.save.modifier ||
      output.d20.contributorChecksum !== context.save.contributorChecksum ||
      checksumCanonicalJson(output.d20.contributors) !==
        checksumCanonicalJson(context.save.contributors) ||
      (resolution.kind === 'ENTER_DICE' &&
        checksumCanonicalJson(resolution.rawFaces) !==
          checksumCanonicalJson(output.d20.rawFaces)) ||
      execution.outputs.targetActorId !== context.application.targetActorId ||
      execution.outputs.appliedDamage !== context.application.appliedAmount ||
      execution.outputs.contributorChecksum !== context.save.contributorChecksum ||
      execution.outputs.naturalD20 !== output.d20.selectedNatural ||
      execution.outputs.total !== output.d20.total ||
      execution.outputs.dc !== output.d20.dc ||
      execution.outputs.resultPath !== (failed ? 'ON_SAVE_FAIL' : 'ON_SAVE_SUCCESS')
    )
      throw new Error('Live Session concentration result does not match its pending evidence.')

    const store = createActiveRuleEffectStore(ctx)
    const slots = new Map<
      string,
      NonNullable<Awaited<ReturnType<typeof store.findMaintainedState>>>
    >()
    for (const actorId of new Set(
      admission.parentApplications
        .slice(admission.applicationIndex)
        .map((application) => application.targetActorId)
    )) {
      const slot = await store.findMaintainedState({
        encounterId: state.id,
        ownerActorId: actorId,
        maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      })
      if (
        slot &&
        admission.actors.some((actor) => actor.id === actorId && actor.kind === 'CHARACTER')
      )
        slots.set(actorId, slot)
    }
    const slot = slots.get(context.application.targetActorId)
    const target = admission.actors.find((actor) => actor.id === context.application.targetActorId)
    if (
      !slot ||
      !target ||
      target.kind !== 'CHARACTER' ||
      (await readLiveCharacterStreamVersion(ctx, state, target.sourceId)) !==
        context.targetCharacter.streamVersion ||
      checksumCanonicalJson(context.maintainedState) !==
        checksumCanonicalJson({
          id: slot.id,
          version: slot.version,
          maintenanceDefinitionId: slot.maintenanceDefinitionId,
          descriptorChecksum: slot.descriptorChecksum
        })
    )
      throw new Error('Live Session concentration target changed.')
    const remaining = admission.parentApplications
      .slice(admission.applicationIndex + 1)
      .flatMap((application) => {
        const maintainedStateId = slots.get(application.targetActorId)?.id
        return maintainedStateId ? [{ ...application, maintainedStateId }] : []
      })
    if (checksumCanonicalJson(remaining) !== checksumCanonicalJson(context.remaining))
      throw new Error('Live Session concentration damage order changed.')
    const nextRemaining = remaining.filter(
      (entry) => !failed || entry.maintainedStateId !== slot.id
    )
    const next = nextRemaining[0]
    if (
      output.nextOccurrenceId !==
        (next ? concentrationOccurrenceId(context.parentOccurrenceId, next) : null) ||
      checksumCanonicalJson(output.skipped) !==
        checksumCanonicalJson(
          failed
            ? remaining
                .filter((entry) => entry.maintainedStateId === slot.id)
                .map((entry) => ({ ...entry, reason: 'MAINTAINED_STATE_ENDED' }))
            : []
        )
    )
      throw new Error('Live Session concentration successor mismatch.')

    // Remaining checks the commit auto-rolled; one version advance covers every failure (D23).
    const commitFailed =
      failed ||
      input.concentration.some(
        ({ result }) =>
          result.status === 'COMPLETE' &&
          result.applicationOutputs.kind === 'CONCENTRATION_CHECK' &&
          result.applicationOutputs.outcome === 'SAVE_FAILURE'
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
        !commitFailed ||
        !requestSlot ||
        request.stateId !== requestSlot.id ||
        request.definitionId !== requestSlot.maintenanceDefinitionId ||
        ownerRequests.has(key)
      )
        throw new Error('Live Session concentration owner scope mismatch.')
      ownerRequests.add(key)
      await readEncounterMaintenanceCapture(ctx, state, request)
      if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
    }
    const deferred = snapshot.deferredCleaving
    if (deferred) {
      for (const option of deferred.options)
        await readNativeActionSceneInputs(
          ctx,
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
    await assertLiveSessionRulesRevisions(ctx, input.revisions, {
      systemId: state.gameSystemId,
      campaignId: state.campaignId,
      characterIds: [...characterIds]
    })
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
    if (output.cleanup)
      actors = await applyLiveConcentrationCleanup(ctx, {
        state,
        actors,
        slot,
        cleanup: output.cleanup,
        authorizedCharacterIds: characterIds,
        occurredAt: input.occurredAt
      })
    const nextState = commitFailed
      ? encounterRunStateSchema.parse({
          ...state,
          version: state.version + 1,
          updatedAt: input.occurredAt
        })
      : state
    // The remaining checks this commit auto-rolled, then the first one that prompts.
    actors = (
      await persistLiveEncounterConcentrationChildren(ctx, {
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
        concentration: input.concentration,
        pendingConcentration: nextPending
      })
    ).actors
    const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
    const rules = input.rules
    if (
      commitFailed
        ? !rules ||
          rules.actors.length !== ruleActors.length ||
          new Set(rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
          rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
        : rules !== null
    )
      throw new Error('Live Session concentration projection scope mismatch.')
    const projection =
      commitFailed && rules
        ? projectCurrentEncounterGm({
            state: nextState,
            actors,
            rules,
            initiativeRoundState: await readEncounterInitiativeRound(ctx, {
              encounterId: state.id,
              round: state.round
            }),
            characterStates: await readEncounterCharacterStates(ctx, nextState, actors)
          })
        : admission.projection
    const result = encounterCommandResultDtoSchema.parse({
      projection,
      roll: null,
      occurrence: {
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version + 1,
        status: 'COMPLETE',
        outcome: output.outcome,
        pending: null
      }
    })
    if (commitFailed)
      await ctx.db.patch(run._id, {
        version: nextState.version,
        stateJson: JSON.stringify(nextState),
        stateChecksum: checksumCanonicalJson(nextState),
        projectionJson: JSON.stringify(projection),
        projectionChecksum: checksumCanonicalJson(projection),
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
        resultJson: JSON.stringify(result),
        resultChecksum: checksumCanonicalJson(result),
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
})
