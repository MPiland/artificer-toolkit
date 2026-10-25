import type { LiveSessionEncounterCleavingCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterCleaving'
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
import {
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  cleavingCarriesOn,
  cleavingDamageApplication
} from '@artificer-toolkit/rules-runtime/encounterCleavingFacts'
import { cleavingChildOccurrenceIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import { nativeConcentrationDamageApplications } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { consequenceRollDamageFacts } from '@artificer-toolkit/rules-runtime/encounterConsequenceRolls'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { readCleavingResponseAdmission } from './cleavingResponseAdmission.js'
import { insertNativeCleavingChoice } from './actionChildPersistence.js'
import { projectNativeGm } from './nativeProjection.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import { addResponseChangesToRoot } from './consumedGrantPersistence.js'
import { idleTurnMarkChanges } from './idleTurnMark.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import type { readEncounterMaintenanceCapture } from './maintenanceCapture.js'
import type {
  bindEncounterConcentrationApplications,
  persistEncounterConcentrationChildren
} from './concentrationChildrenPersistence.js'
import { persistConsequenceRollOffers } from './consequenceRollCommands.js'
import { bindEncounterDamageSaveChain } from './effectRepeatSavePersistence.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/** Records the admitted answer, damage, Concentration checks, next choice and receipts atomically. */
export async function persistEncounterCleavingResponse(
  ctx: EncounterCharacterWriteTransaction,
  input: LiveSessionEncounterCleavingCommitInput,
  callbacks: {
    readMaintenanceCapture(
      state: EncounterRunState,
      request: LiveSessionEncounterCleavingCommitInput['maintenanceOwners'][number]
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
    bindConcentrationApplications(
      state: EncounterRunState,
      applications: Parameters<typeof bindEncounterConcentrationApplications>[2]
    ): ReturnType<typeof bindEncounterConcentrationApplications>
    persistConcentrationChildren(
      input: Parameters<typeof persistEncounterConcentrationChildren>[1]
    ): ReturnType<typeof persistEncounterConcentrationChildren>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readCleavingResponseAdmission(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const {
    run,
    state,
    campaign,
    membership,
    actors,
    occurrence,
    fingerprint,
    pending,
    selected,
    actionOccurrenceId
  } = admission
  const { response, execution, occurredAt } = input
  const { context } = pending
  const output =
    execution.status === 'AGGREGATE_CHOICE_COMPLETE' ? execution.applicationOutputs : null
  const remaining = context.damage.remainingAmount
  if (
    execution.status !== 'AGGREGATE_CHOICE_COMPLETE' ||
    output?.kind !== 'CLEAVING_DAMAGE' ||
    execution.occurrenceId !== occurrence.id ||
    execution.occurrenceVersion !== occurrence.version + 1 ||
    output.occurrenceId !== occurrence.id ||
    output.parentOccurrenceId !== context.parentOccurrenceId ||
    output.sourceActorId !== context.sourceActorId ||
    output.targetActorId !== (selected?.targetActorId ?? null) ||
    output.selectedOptionId !== (selected?.optionId ?? null) ||
    output.sealedContextChecksum !== checksumRuleDocument(context) ||
    output.outcome !== (selected ? 'APPLIED' : 'DECLINED') ||
    output.damage.sourceNodeId !== context.damage.sourceNodeId ||
    output.damage.sourceOperationKey !== context.damage.sourceOperationKey ||
    output.damage.damageTypeId !== context.damage.damageTypeId ||
    output.damage.requestedAmount !== remaining ||
    output.damage.resolvedAmount !== remaining ||
    (selected === null) !== (output.targetTransition === null) ||
    (selected === null && output.damage.appliedAmount !== 0)
  )
    throw new Error('Live Session Cleaving result scope mismatch.')
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    input.rules.actors.length !== ruleActors.length ||
    new Set(input.rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
    input.rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error('Live Session Cleaving output scope mismatch.')
  const characterIds = new Set(
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  const ownerRequests = new Set<string>()
  for (const request of input.maintenanceOwners) {
    const key = checksumCanonicalJson(request)
    if (request.actorId !== selected?.targetActorId || ownerRequests.has(key))
      throw new Error('Live Session maintenance owner scope mismatch.')
    ownerRequests.add(key)
    await callbacks.readMaintenanceCapture(state, request)
    if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
  }
  // The choice was sealed on this Scene version; any token change since then refuses it.
  if (selected)
    await callbacks.readActionSceneInputs(
      state,
      {
        actorId: context.sourceActorId,
        targetActorId: selected.targetActorId,
        sceneContext: {
          sceneId: context.scene.sceneId,
          expectedSceneVersion: context.scene.sceneVersion,
          sourceTokenId: context.scene.sourceTokenId,
          targetTokenId: selected.targetTokenId
        }
      },
      membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
    )
  await callbacks.validateReadFence(state, [...characterIds], input.revisions)
  const transition = output.targetTransition
  const application =
    selected && transition
      ? cleavingDamageApplication({
          damage: context.damage,
          targetActorId: selected.targetActorId,
          before: {
            current: transition.before.currentHitPoints,
            temporary: transition.before.temporaryHitPoints,
            maximum: transition.before.maximumHitPoints
          }
        })
      : null
  const mechanics =
    application && transition
      ? await callbacks.applyMechanics({
          encounterId: state.id,
          targetActorId: application.targetActorId,
          expectedEncounterVersion: state.version,
          occurrenceId: occurrence.id,
          sourceCommandId: occurrence.rootCommandId,
          commandId: response.commandId,
          occurredAt,
          applications: [application],
          effectiveMaximumHitPoints: transition.before.maximumHitPoints,
          effectiveScalarValues: transition.before.scalarValues,
          forceVersionAdvance: false
        })
      : null
  const applied = mechanics?.receiptApplications[0]
  if (
    mechanics &&
    (checksumCanonicalJson(mechanics.targetTransition) !== checksumCanonicalJson(transition) ||
      applied?.kind !== 'DAMAGE' ||
      applied.appliedAmount !== output.damage.appliedAmount)
  )
    throw new Error('Live Session Cleaving damage receipt mismatch.')
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: occurredAt
  })
  const damageBatches = mechanics
    ? [{ targetActorId: mechanics.updatedActor.id, applications: mechanics.receiptApplications }]
    : []
  const applications = nativeConcentrationDamageApplications(damageBatches, true)
  const damagedActors = await persistConsequenceRollOffers(ctx, {
    state: nextState,
    actors: actors.map((actor) =>
      actor.id === mechanics?.updatedActor.id ? mechanics.updatedActor : actor
    ),
    facts: consequenceRollDamageFacts(damageBatches),

    sourceCommandId: occurrence.rootCommandId,
    occurredAt
  })
  const { actors: nextActors } = await callbacks.persistConcentrationChildren({
    state: nextState,
    actors: damagedActors,
    parentOccurrenceId: occurrence.id,
    parentCommandFingerprint: fingerprint,
    finalizedDamageEnvelopeChecksum: checksumRuleDocument(applications),
    remaining: await bindEncounterDamageSaveChain(ctx, {
      concentration: await callbacks.bindConcentrationApplications(nextState, applications),
      state: nextState,
      actors: damagedActors,
      applications,
      parentOccurrenceId: occurrence.id,
      damagerActorId: context.sourceActorId
    }),
    correlationId: occurrence.id,
    userId: input.expectedUserId,
    authorizedCharacterIds: characterIds,
    occurredAt,
    damagedActorIds: new Set(mechanics ? [mechanics.updatedActor.id] : []),
    concentration: input.concentration,
    concentrationEnds: input.concentrationEnds,
    endedGrants: input.endedGrants,
    pendingConcentration: input.pendingConcentration
  })
  await addResponseChangesToRoot(ctx, {
    campaignId: campaign.id,
    actionOccurrenceId,
    endedGrants: input.endedGrants,
    idleTurnMarkChanges: idleTurnMarkChanges(actors, nextActors)
  })
  const projection = await projectNativeGm(ctx, nextState, nextActors, input.rules)
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion: execution.occurrenceVersion,
      status: 'COMPLETE',
      pending: null
    }
  })
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt: occurredAt
  })
  await ctx.db.patch(occurrence._id, {
    state: 'COMPLETED',
    version: execution.occurrenceVersion,
    expectedEncounterVersion: nextState.version,
    pendingSnapshotChecksum: await writePendingSnapshot(ctx, occurrence, null),
    completedAt: occurredAt,
    updatedAt: occurredAt
  })
  const ruleResultChecksum = checksumRuleDocument(execution)
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: response.commandId,
      commandType: response.type,
      ruleOccurrenceId: occurrence.id,
      ruleResultChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      commandFingerprint: fingerprint,
      actorUserId: input.expectedUserId,
      version: nextState.version,
      commandJson: JSON.stringify(response),
      ...encounterReplayReceipt(result),
      createdAt: occurredAt
    })
  )
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      occurrenceId: occurrence.id,
      commandId: response.commandId,
      commandType: response.type,
      commandFingerprint: fingerprint,
      encounterVersion: nextState.version,
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'OPTIONAL_COMBAT_CLEAVING',
          commandType: response.type,
          expectedAggregateVersion: response.expectedVersion,
          expectedOccurrenceVersion: response.expectedOccurrenceVersion,
          response: response.resolution,
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      ),
      resultJson: JSON.stringify(execution),
      resultChecksum: ruleResultChecksum,
      actorUserId: input.expectedUserId,
      correlationId: response.correlationId ?? null,
      createdAt: occurredAt
    })
  )
  const child = input.cleaving
  if (child) {
    const next = child.applicationContext
    if (
      !application ||
      !cleavingCarriesOn(application) ||
      next.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' ||
      child.occurrenceId !==
        cleavingChildOccurrenceIdentity(occurrence.id, context.chainStep + 1) ||
      child.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      next.parentOccurrenceId !== occurrence.id ||
      next.parentResultChecksum !== ruleResultChecksum ||
      next.sourceActorId !== context.sourceActorId ||
      next.initialTargetActorId !== context.initialTargetActorId ||
      next.chainStep !== context.chainStep + 1 ||
      checksumCanonicalJson(next.action) !== checksumCanonicalJson(context.action) ||
      checksumCanonicalJson(next.scene) !== checksumCanonicalJson(context.scene) ||
      checksumCanonicalJson(next.visitedTargetActorIds) !==
        checksumCanonicalJson([...context.visitedTargetActorIds, application.targetActorId]) ||
      next.options.some((option) => !actors.some((actor) => actor.id === option.targetActorId))
    )
      throw new Error('Live Session Cleaving choice scope mismatch.')
    // A pending Concentration check defers the choice until it settles.
    await insertNativeCleavingChoice(ctx, nextState, child, occurredAt)
  }
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result
  })
}
