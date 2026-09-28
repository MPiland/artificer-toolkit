import { v } from 'convex/values'
import { liveSessionEncounterActionCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import {
  featureChargeUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { internalMutation } from '../lib/mutations'
import { readLiveEncounterActionAdmission } from './encounterActionAdmission'
import { insertActionEvidenceReceipt } from '../encounters/actionEvidenceReceipt'
import { readNativeActionSceneInputs } from '../encounters/actionSceneInputs'
import { readRunActors } from '@artificer-toolkit/encounter-persistence/documents'
import { consumeEncounterAllyAdvantages } from '../encounters/allyAdvantage'
import { readEncounterCharacterStates } from '../encounters/characterStates'
import { readEncounterInitiativeRound } from '../encounters/initiativeStore'
import { insertRunCommand } from '@artificer-toolkit/encounter-persistence/timelineEntries'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'
import { applyLiveEncounterMechanicsBatch } from './encounterActionMechanics'
import { readLiveCharacterMaximumHitPoints } from './encounterMovementTargetState'
import {
  prepareLiveEncounterActionMaintenance,
  persistLiveEncounterActionEffects
} from './encounterActionEffectsCommit'
import { persistLiveEncounterActionChildren } from './encounterActionChildrenCommit'
import { presentEncounterResultForMember } from '../encounters/resultPresentation'

/** The DO computes rules; this transaction validates current authority and applies bounded outcomes. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterActionCommitInputSchema.parse(args)
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
      command.optionalCombatIntent != null
    )
      throw new Error('Live Session terminal action is not an ordinary completed root.')
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
      batch.targetActorId !== command.targetActorId ||
      batch.occurrenceId !== execution.occurrenceId
    )
      throw new Error('Live Session action result scope mismatch.')
    const actors = await readRunActors(ctx, state)
    const source = actors.find((actor) => actor.id === command.actorId)
    const target = actors.find((actor) => actor.id === command.targetActorId)
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
      input.rules.actors.some(
        (actor) => !ruleActors.some((current) => current.id === actor.actorId)
      )
    )
      throw new Error('Live Session action output scope mismatch.')
    const characterIds = new Set(
      actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
    )
    const ownerRequests = new Set<string>()
    for (const request of input.maintenanceOwners) {
      const key = checksumCanonicalJson(request)
      if (
        (request.actorId !== source.id && request.actorId !== target.id) ||
        ownerRequests.has(key)
      )
        throw new Error('Live Session maintenance owner scope mismatch.')
      ownerRequests.add(key)
      await readEncounterMaintenanceCapture(ctx, state, request)
      if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
    }
    await readNativeActionSceneInputs(
      ctx,
      state,
      command,
      membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
    )
    await assertLiveSessionRulesRevisions(ctx, input.revisions, {
      systemId: state.gameSystemId,
      campaignId: state.campaignId,
      characterIds: [...characterIds]
    })
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
    const maintenance = await prepareLiveEncounterActionMaintenance(ctx, effectInput)
    const resource = input.resourceConsumption
    if (resource) {
      const {
        owner: _owner,
        usageId: _usage,
        characterId,
        // The mechanics batch checks it against the fenced Character it plans with.
        expectedStreamVersion: _expectedStreamVersion,
        ...receipt
      } = resource
      if (
        source.kind !== 'CHARACTER' ||
        source.sourceId !== characterId ||
        checksumCanonicalJson(receipt) !== checksumCanonicalJson(batch.resourceConsumption)
      )
        throw new Error('Live Session action resource scope mismatch.')
    } else if (batch.resourceConsumption !== null)
      throw new Error('Live Session action resource is missing.')
    const stow = command.acceptedWieldConflict
    if (stow && source.kind !== 'CHARACTER')
      throw new Error('Live Session shield stow scope mismatch.')
    const sourceMutation = {
      ...(resource ? { characterResourceConsumption: resource } : {}),
      ...(stow ? { stowEquippedItemInstanceId: stow.shieldItemInstanceId } : {})
    }
    const common = {
      encounterId: state.id,
      expectedEncounterVersion: state.version,
      occurrenceId: execution.occurrenceId,
      sourceCommandId: command.commandId,
      occurredAt: input.occurredAt
    }
    const sourceMechanics =
      (resource || stow) && source.id !== target.id && source.kind === 'CHARACTER'
        ? await applyLiveEncounterMechanicsBatch(ctx, {
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
            effectiveMaximumHitPoints: await readLiveCharacterMaximumHitPoints(
              ctx,
              state,
              source.sourceId
            ),
            forceVersionAdvance: false,
            ...sourceMutation
          })
        : null
    const mechanics = await applyLiveEncounterMechanicsBatch(ctx, {
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
    const beforeSource =
      sourceMechanics?.updatedActor ?? (source.id === target.id ? mechanics.updatedActor : source)
    let settledSource = beforeSource
    const feature = batch.featureResourceConsumption
    if (feature) {
      if (
        source.kind !== 'CREATURE' ||
        feature.ownerActorId !== source.id ||
        featureChargeUsed(settledSource, feature.ownerFeatureId) !== feature.beforeUsed ||
        feature.afterUsed !== feature.beforeUsed + feature.cost ||
        feature.afterRemaining !== feature.beforeRemaining - feature.cost
      )
        throw new Error('Live Session feature resource receipt mismatch.')
      settledSource = encounterRunActorStateSchema.parse({
        ...settledSource,
        resources: withFeatureChargeUsed(settledSource, feature.ownerFeatureId, feature.afterUsed)
      })
    }
    if (batch.actionEconomyTransition)
      settledSource = consumeEncounterActionEconomy({
        actor: settledSource,
        consumption: batch.actionEconomyTransition,
        overridden: overridesActionEconomy(input.ruleOverrides)
      })
    if (checksumCanonicalJson(settledSource) !== checksumCanonicalJson(beforeSource)) {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id).eq('id', source.id))
        .unique()
      if (!row || row.stateChecksum !== checksumCanonicalJson(beforeSource))
        throw new Error('Encounter action source changed before settlement.')
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(settledSource),
        stateChecksum: checksumCanonicalJson(settledSource)
      })
    }
    let nextActors = actors.map((actor) =>
      actor.id === source.id
        ? settledSource
        : actor.id === target.id
          ? mechanics.updatedActor
          : actor
    )
    nextActors = await persistLiveEncounterActionEffects(ctx, {
      ...effectInput,
      maintenance,
      actors: nextActors,
      occurredAt: input.occurredAt
    })
    // The helper's ally advantage (Help) this attack used ends now.
    nextActors = await consumeEncounterAllyAdvantages(ctx, {
      actors: nextActors,
      uses: input.allyAdvantageUses,
      rollerActorIds: [source.id]
    })
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
    // A resumed action settles its own occurrence first, so a child opens as the only pending one.
    const completedOccurrence = encounterStoredRuleOccurrenceSchema.parse({
      id: execution.occurrenceId,
      campaignId: state.campaignId,
      encounterId: state.id,
      rootCommandId: command.commandId,
      state: 'COMPLETED',
      version: occurrenceVersion,
      expectedEncounterVersion: nextState.version,
      pendingSnapshotJson: null,
      pendingSnapshotChecksum: null,
      completedAt: input.occurredAt,
      createdAt: resume?.occurrence.createdAt ?? input.occurredAt,
      updatedAt: input.occurredAt
    })
    if (resume) await ctx.db.patch(resume.occurrence._id, completedOccurrence)
    else await ctx.db.insert('encounterRuleOccurrences', completedOccurrence)
    nextActors = await persistLiveEncounterActionChildren(ctx, {
      input,
      state: nextState,
      actors: nextActors,
      execution,
      fingerprint,
      userId,
      authorizedCharacterIds: characterIds
    })
    const projection = projectCurrentEncounterGm({
      state: nextState,
      actors: nextActors,
      rules: input.rules,
      initiativeRoundState: await readEncounterInitiativeRound(ctx, {
        encounterId: state.id,
        round: state.round
      }),
      characterStates: await readEncounterCharacterStates(ctx, nextState, nextActors)
    })
    const result = encounterCommandResultDtoSchema.parse({
      projection,
      roll: null,
      occurrence: {
        occurrenceId: execution.occurrenceId,
        occurrenceVersion,
        status: 'COMPLETE',
        outcome: null,
        pending: null
      }
    })
    const resultChecksum = checksumCanonicalJson(result)
    const ruleResultChecksum = checksumRuleDocument(execution)
    await ctx.db.patch(run._id, {
      version: nextState.version,
      stateJson: JSON.stringify(nextState),
      stateChecksum: checksumCanonicalJson(nextState),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection),
      updatedAt: input.occurredAt
    })
    await ctx.db.insert(
      'encounterRuleReceipts',
      encounterStoredRuleReceiptSchema.parse({
        id: crypto.randomUUID(),
        campaignId: state.campaignId,
        encounterId: state.id,
        occurrenceId: execution.occurrenceId,
        commandId: command.commandId,
        commandType: 'RESOLVE_ACTION',
        commandFingerprint: fingerprint,
        encounterVersion: nextState.version,
        commandMetadataJson: JSON.stringify(
          serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
            schemaVersion: 1,
            transition: 'START',
            definitionId: input.initialDefinitionId,
            expectedAggregateVersion: state.version,
            factsChecksum: execution.initialFactsChecksum,
            optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
          })
        ),
        resultJson: JSON.stringify(execution),
        resultChecksum: ruleResultChecksum,
        actorUserId: initiatorUserId,
        correlationId: null,
        createdAt: input.occurredAt
      })
    )
    await insertRunCommand(
      ctx,
      encounterStoredRunCommandSchema.parse({
        id: crypto.randomUUID(),
        campaignId: state.campaignId,
        encounterId: state.id,
        commandId: command.commandId,
        commandType: 'RESOLVE_ACTION',
        ruleOccurrenceId: execution.occurrenceId,
        ruleResultChecksum,
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
        ruleOverrides: input.ruleOverrides,
        allyAdvantageUses: input.allyAdvantageUses,
        commandFingerprint: fingerprint,
        actorUserId: initiatorUserId,
        version: nextState.version,
        commandJson: JSON.stringify(command),
        resultJson: JSON.stringify(result),
        resultChecksum,
        createdAt: input.occurredAt
      })
    )
    if (resume && input.response)
      await insertActionEvidenceReceipt(ctx, {
        occurrence: { ...resume.occurrence, ...completedOccurrence },
        response: input.response,
        rootCommand: command,
        rootFingerprint: fingerprint,
        userId,
        rootInitiatorUserId: initiatorUserId,
        result: execution
      })
    return presentEncounterResultForMember(ctx, { campaign, membership, result })
  }
})
