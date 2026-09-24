import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  storedRuleExecutionResultDtoSchema,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { projectPlayerEncounterProjection } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { buildCompiledActionTargetPolicy } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import type { MutationCtx } from '../_generated/server'
import { readCampaignAssignedCharacter } from '../campaigns/assignedCharacter'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireSession } from '../campaigns/sessionDocuments'
import { readRunActors, readRunProjection, readRunState } from './documents'
import { projectNativeGm } from './nativeProjection'
import type { MovementTarget } from './movementTargets'
import { loadNativeEncounterActionSource, type NativeEncounterActionSource } from './actionSources'
import { applyEncounterMechanicsBatch } from './mechanicsBatch'
import {
  insertRunCommand,
  presentTimelineEntry,
  requireUnusedEvidenceCommandId
} from './timelineEntries'
import { createNativeCleavingChoice } from '@artificer-toolkit/rules-runtime/encounterCleavingChoice'
import { cleavingChildCommandIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import { readNativeCleavingPending } from './cleavingPending'
import { startNativeConcentrationChecks } from './concentration'
import { nativeConcentrationDamageApplications } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import {
  retainedCleavingDamage,
  cleavingDamageEnvelope,
  nativeCleavingSourceCurrentness,
  type CleavingContext
} from '@artificer-toolkit/rules-runtime/encounterCleavingFacts'
import { nativeCleavingCandidates } from './cleavingFacts'
import { insertNativeCleavingChoice } from './actionChildPersistence'
import { verifyNativeCleavingParentChain } from './cleavingParent'

/** Called after resource consumption and Run publication, inside the same native mutation. */
export async function persistNativeCleavingAfterAction(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    result: Extract<StoredRuleExecutionResultDto, { status: 'COMPLETE' }>
    source: NativeEncounterActionSource
    action: CleavingContext['action']
    scene: CleavingContext['scene'] | null
    occurredAt: string
  }
) {
  const retained = retainedCleavingDamage(input.result)
  if (
    !retained ||
    !input.scene ||
    input.action.attackKind !== 'MELEE' ||
    input.state.optionalCombatSnapshotChecksum === null
  )
    return
  const visitedTargetActorIds = [retained.initialTargetActorId]
  const { candidates, targets } = await nativeCleavingCandidates(ctx, {
    state: input.state,
    sourceActorId: input.source.actor.id,
    action: input.action,
    scene: input.scene,
    originalAttack: retained.originalAttack,
    visitedTargetActorIds
  })
  const source = targets.get(input.source.actor.id)
  if (!source) throw new Error('Cleaving source is unavailable.')
  const snapshot = createNativeCleavingChoice({
    ...input.state,
    parentOccurrenceId: input.result.occurrenceId,
    parentResultChecksum: checksumRuleDocument(input.result),
    optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
    sourceActorId: source.actor.id,
    sourceControllerCharacterId: source.actor.kind === 'CHARACTER' ? source.actor.sourceId : null,
    sourceCurrentness: nativeCleavingSourceCurrentness(source, input.source),
    action: input.action,
    scene: input.scene,
    ...retained,
    visitedTargetActorIds,
    chainStep: 0,
    candidates
  })
  if (snapshot) await insertNativeCleavingChoice(ctx, input.state, snapshot, input.occurredAt)
}

async function currentSource(
  ctx: MutationCtx,
  state: EncounterRunState,
  target: MovementTarget,
  actionId: string
) {
  const character = target.characterReactionSource
  const candidate = character?.mechanics.rulePolicyInput.actionCandidates.find(
    (entry) => entry.actionId === actionId
  )
  const entry = candidate
    ? character?.mechanics.compiledActionEntryPoints.find(
        (
          entry
        ): entry is NonNullable<
          Parameters<typeof loadNativeEncounterActionSource>[1]['characterSource']
        >['entry'] =>
          entry.actionId === actionId &&
          entry.effectId === candidate.effectId &&
          entry.kind === 'CHARACTER_ACTION' &&
          entry.compilation.kind === 'COMPILED'
      )
    : undefined
  return loadNativeEncounterActionSource(ctx, {
    actor: target.actor,
    actionId,
    gameSystemId: state.gameSystemId,
    ...(character &&
    candidate &&
    entry?.kind === 'CHARACTER_ACTION' &&
    entry.compilation.kind === 'COMPILED' &&
    target.effectiveRulePolicyOutput
      ? {
          characterSource: {
            id: character.id,
            streamVersion: character.streamVersion,
            candidate,
            entry,
            effectivePolicyOutput: target.effectiveRulePolicyOutput
          }
        }
      : {})
  })
}

/** Rebuild only while the caller holds the same transaction that validates the sealed choice. */
export async function rebuildNativeDeferredCleaving(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    context: CleavingContext
    sceneScope: 'OWNER' | 'MEMBER'
  }
) {
  const { state, context, sceneScope } = input
  await verifyNativeCleavingParentChain(ctx, state, context)
  const { candidates, targets } = await nativeCleavingCandidates(ctx, {
    state,
    ...context,
    sceneScope
  })
  const sourceFacts = targets.get(context.sourceActorId)
  if (!sourceFacts) throw new Error('Deferred Cleaving source is unavailable.')
  const source = await currentSource(ctx, state, sourceFacts, context.action.actionId)
  const range =
    source.kind === 'CREATURE'
      ? buildCompiledActionTargetPolicy(source.capability).range
      : source.entry.targetPolicy?.range
  if (checksumRuleDocument(range) !== checksumRuleDocument(context.action.range))
    throw new Error('Deferred Cleaving action is stale.')
  return createNativeCleavingChoice({
    ...state,
    ...context,
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum ?? '',
    sourceCurrentness: nativeCleavingSourceCurrentness(sourceFacts, source),
    chainStep: context.chainStep - 1,
    candidates
  })
}

/** Returns null only when the occurrence belongs to another native coordinator. */
export async function resumeNativeCleaving(
  ctx: MutationCtx,
  response: ResolveRuleOccurrenceInputDto,
  userId: string
): Promise<EncounterCommandResultDto | null> {
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', response.occurrenceId))
    .unique()
  if (!occurrence) return null
  const snapshot =
    occurrence.pendingSnapshotJson === null
      ? null
      : serverRuleExecutionPendingSnapshotDtoSchema.parse(
          JSON.parse(occurrence.pendingSnapshotJson)
        )
  const isCleaving =
    snapshot?.applicationContext.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' ||
    occurrence.rootCommandId === cleavingChildCommandIdentity(occurrence.id)
  if (!isCleaving) return null
  if (response.resolution.kind !== 'OPTION' && response.resolution.kind !== 'DECLINE')
    throw new Error('Cleaving requires a target choice or decline.')
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', response.encounterId))
    .unique()
  if (!run || occurrence.encounterId !== run.id || occurrence.campaignId !== run.campaignId)
    throw new Error('Cleaving occurrence scope is invalid.')
  const state = readRunState(run)
  readRunProjection(run)
  const { campaign, membership } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Cleaving Campaign is stale.')
  const session = await requireSession(ctx, campaign.id, state.sessionId)
  if (session.status !== 'OPEN') throw new Error('Finished Sessions cannot change Encounters.')
  const assigned =
    membership.role === 'PLAYER'
      ? await readCampaignAssignedCharacter(ctx, campaign, membership)
      : null
  const actors = await readRunActors(ctx, state)
  const fingerprint = checksumCanonicalJson(response)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', response.commandId)
    )
    .unique()
  const evidence = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', response.commandId)
    )
    .unique()
  if (prior || evidence) {
    if (!prior || !evidence || prior.commandType !== 'RESOLVE_RULE_OCCURRENCE')
      throw new Error('Stored Cleaving response receipt mismatch.')
    presentTimelineEntry(prior)
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(evidence.resultJson))
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(evidence.commandMetadataJson)
    )
    const result = encounterCommandResultDtoSchema.parse(JSON.parse(prior.resultJson))
    const sourceId =
      payload.status === 'AGGREGATE_CHOICE_COMPLETE' &&
      payload.applicationOutputs.kind === 'CLEAVING_DAMAGE'
        ? payload.applicationOutputs.sourceActorId
        : null
    const source = actors.find((actor) => actor.id === sourceId)
    if (
      !source ||
      (membership.role !== 'OWNER' &&
        (source.kind !== 'CHARACTER' || source.sourceId !== assigned?.id)) ||
      prior.actorUserId !== userId ||
      evidence.actorUserId !== userId ||
      prior.commandType !== response.type ||
      evidence.commandType !== response.type ||
      prior.encounterId !== run.id ||
      evidence.encounterId !== run.id ||
      prior.ruleOccurrenceId !== occurrence.id ||
      evidence.occurrenceId !== occurrence.id ||
      prior.commandFingerprint !== fingerprint ||
      evidence.commandFingerprint !== fingerprint ||
      evidence.correlationId !== (response.correlationId ?? null) ||
      prior.version !== response.expectedVersion + 1 ||
      evidence.encounterVersion !== prior.version ||
      prior.version > state.version ||
      occurrence.state !== 'COMPLETED' ||
      occurrence.version !== response.expectedOccurrenceVersion + 1 ||
      payload.status !== 'AGGREGATE_CHOICE_COMPLETE' ||
      payload.occurrenceId !== occurrence.id ||
      payload.occurrenceVersion !== occurrence.version ||
      evidence.resultChecksum !== checksumRuleDocument(payload) ||
      prior.ruleResultChecksum !== evidence.resultChecksum ||
      metadata.transition !== 'OPTIONAL_COMBAT_CLEAVING' ||
      metadata.expectedAggregateVersion !== response.expectedVersion ||
      metadata.expectedOccurrenceVersion !== response.expectedOccurrenceVersion ||
      checksumCanonicalJson(metadata.response) !== checksumCanonicalJson(response.resolution)
    )
      throw new Error('Stored Cleaving response receipt mismatch.')
    return encounterCommandResultDtoSchema.parse({
      ...result,
      projection:
        membership.role === 'OWNER'
          ? result.projection
          : projectPlayerEncounterProjection(
              encounterGmProjectionDtoSchema.parse(result.projection)
            )
    })
  }
  const pending = readNativeCleavingPending(occurrence)
  if (
    !pending ||
    state.status !== 'ACTIVE' ||
    state.version !== response.expectedVersion ||
    occurrence.expectedEncounterVersion !== state.version ||
    occurrence.version !== response.expectedOccurrenceVersion ||
    occurrence.rootCommandId !== cleavingChildCommandIdentity(occurrence.id)
  )
    throw new Error('Cleaving choice is stale.')
  const context = pending.context
  const sourceActor = actors.find((actor) => actor.id === context.sourceActorId)
  if (
    !sourceActor ||
    (sourceActor.kind === 'CHARACTER' ? sourceActor.sourceId : null) !==
      context.sourceControllerCharacterId ||
    (membership.role !== 'OWNER' && context.sourceControllerCharacterId !== assigned?.id)
  )
    throw new Error('Cleaving choice is unavailable.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, response.commandId)
  const usedRoot = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', campaign.id).eq('rootCommandId', response.commandId)
    )
    .unique()
  if (usedRoot) throw new Error('Command ID was already used with different input.')
  await verifyNativeCleavingParentChain(ctx, state, context)
  const optionalSnapshot = encounterOptionalCombatSnapshotDtoSchema.parse(
    state.optionalCombatSnapshot
  )
  const definition = activeOptionalCombatDefinitions({
    automationMode: state.automationMode,
    snapshot: optionalSnapshot
  }).find(
    (entry) =>
      entry.document.kind === 'CLEAVING' &&
      entry.definitionId === context.optionalCombat.definitionId
  )
  if (
    state.optionalCombatSnapshotChecksum !== pending.snapshot.optionalCombatSnapshotChecksum ||
    checksumCanonicalJson(optionalSnapshot) !== state.optionalCombatSnapshotChecksum ||
    !definition ||
    definition.definitionChecksum !== context.optionalCombat.definitionChecksum ||
    definition.definitionVersion !== context.optionalCombat.definitionVersion
  )
    throw new Error('Cleaving rule definition is stale.')
  const sceneScope = membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
  const resolution = response.resolution
  const selected =
    resolution.kind === 'OPTION'
      ? context.options.find((option) => option.optionId === resolution.optionId)
      : null
  if (
    response.resolution.kind === 'OPTION' &&
    (!selected ||
      (membership.role !== 'OWNER' &&
        !actors.some((actor) => actor.id === selected.targetActorId && actor.public)))
  )
    throw new Error('Cleaving target is unavailable.')
  let target: MovementTarget | undefined
  if (selected) {
    const { candidates, targets } = await nativeCleavingCandidates(ctx, {
      state,
      ...context,
      sceneScope
    })
    const sourceFacts = targets.get(context.sourceActorId)
    if (!sourceFacts) throw new Error('Cleaving source is unavailable.')
    const source = await currentSource(ctx, state, sourceFacts, context.action.actionId)
    const range =
      source.kind === 'CREATURE'
        ? buildCompiledActionTargetPolicy(source.capability).range
        : source.entry.targetPolicy?.range
    if (
      checksumRuleDocument(nativeCleavingSourceCurrentness(sourceFacts, source)) !==
        checksumRuleDocument(context.sourceCurrentness) ||
      checksumRuleDocument(range) !== checksumRuleDocument(context.action.range)
    )
      throw new Error('Cleaving source is stale.')
    const rebuilt = createNativeCleavingChoice({
      ...state,
      ...context,
      optionalCombatSnapshotChecksum: pending.snapshot.optionalCombatSnapshotChecksum!,
      chainStep: context.chainStep - 1,
      candidates
    })
    if (!rebuilt || checksumCanonicalJson(rebuilt) !== checksumCanonicalJson(pending.snapshot))
      throw new Error('Cleaving policy, target, or Scene is stale.')
    target = targets.get(selected.targetActorId)
    if (!target) throw new Error('Cleaving target is unavailable.')
  }
  const now = new Date().toISOString()
  const remaining = context.damage.remainingAmount
  const temporaryLost = target ? Math.min(target.state.temporary, remaining) : 0
  const currentLost = target ? Math.min(target.state.current, remaining - temporaryLost) : 0
  const application = target
    ? {
        kind: 'DAMAGE' as const,
        targetActorId: target.actor.id,
        sourceNodeId: context.damage.sourceNodeId,
        sourceOperationKey: context.damage.sourceOperationKey,
        damageTypeId: context.damage.damageTypeId,
        requestedAmount: remaining,
        resolvedAmount: remaining,
        appliedAmount: temporaryLost + currentLost,
        beforeCurrentHitPoints: target.state.current,
        afterCurrentHitPoints: target.state.current - currentLost,
        beforeTemporaryHitPoints: target.state.temporary,
        afterTemporaryHitPoints: target.state.temporary - temporaryLost,
        maximumHitPoints: target.effectiveMaximumHitPoints,
        damageDisposition: 'NORMAL' as const,
        authoredPath: null,
        resolvedPath: null
      }
    : null
  const mechanics =
    target && application
      ? await applyEncounterMechanicsBatch(
          ctx,
          {
            encounterId: state.id,
            targetActorId: target.actor.id,
            expectedEncounterVersion: state.version,
            occurrenceId: occurrence.id,
            sourceCommandId: occurrence.rootCommandId,
            commandId: response.commandId,
            occurredAt: now,
            applications: [application],
            effectiveMaximumHitPoints: target.effectiveMaximumHitPoints,
            effectiveScalarValues: target.effectiveScalarValues,
            forceVersionAdvance: false
          },
          target.characterFacts?.sourceContext
        )
      : null
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: now
  })
  let nextActors = actors.map((actor) =>
    actor.id === mechanics?.updatedActor.id ? mechanics.updatedActor : actor
  )
  if (target && mechanics) {
    const concentration = await startNativeConcentrationChecks(ctx, {
      state: nextState,
      readVersion: state.version,
      actors: nextActors,
      parentOccurrenceId: occurrence.id,
      parentCommandFingerprint: fingerprint,
      applications: nativeConcentrationDamageApplications(
        [{ targetActorId: target.actor.id, applications: mechanics.receiptApplications }],
        true
      ),
      userId,
      occurredAt: now
    })
    nextActors = concentration.actors
  }
  const facts = buildEncounterActorRuleFacts({ actors: nextActors })
  const rules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
    facts
  )
  const projection = await projectNativeGm(ctx, nextState, nextActors, rules)
  const payload = storedRuleExecutionResultDtoSchema.parse({
    status: 'AGGREGATE_CHOICE_COMPLETE',
    schemaVersion: 1,
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version + 1,
    applicationOutputs: {
      kind: 'CLEAVING_DAMAGE',
      schemaVersion: 1,
      occurrenceId: occurrence.id,
      parentOccurrenceId: context.parentOccurrenceId,
      sourceActorId: context.sourceActorId,
      targetActorId: selected?.targetActorId ?? null,
      selectedOptionId: selected?.optionId ?? null,
      sealedContextChecksum: checksumRuleDocument(context),
      outcome: selected ? 'APPLIED' : 'DECLINED',
      damage: {
        sourceNodeId: context.damage.sourceNodeId,
        sourceOperationKey: context.damage.sourceOperationKey,
        damageTypeId: context.damage.damageTypeId,
        requestedAmount: remaining,
        resolvedAmount: remaining,
        appliedAmount: temporaryLost + currentLost
      },
      targetTransition: mechanics?.targetTransition ?? null
    }
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    resolution: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version + 1,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  })
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    projectionJson: JSON.stringify(projection),
    projectionChecksum: checksumCanonicalJson(projection),
    updatedAt: now
  })
  await ctx.db.patch(occurrence._id, {
    state: 'COMPLETED',
    version: occurrence.version + 1,
    expectedEncounterVersion: nextState.version,
    pendingSnapshotJson: null,
    pendingSnapshotChecksum: null,
    completedAt: now,
    updatedAt: now
  })
  const ruleResultChecksum = checksumRuleDocument(payload)
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
      actorUserId: userId,
      version: nextState.version,
      commandJson: JSON.stringify(response),
      resultJson: JSON.stringify(result),
      resultChecksum: checksumCanonicalJson(result),
      createdAt: now
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
      resultJson: JSON.stringify(payload),
      resultChecksum: ruleResultChecksum,
      actorUserId: userId,
      correlationId: response.correlationId ?? null,
      createdAt: now
    })
  )
  if (
    target &&
    application &&
    mechanics &&
    application.beforeCurrentHitPoints === application.maximumHitPoints &&
    application.beforeTemporaryHitPoints === 0 &&
    application.afterCurrentHitPoints === 0 &&
    application.resolvedAmount > application.appliedAmount
  ) {
    const visitedTargetActorIds = [...context.visitedTargetActorIds, target.actor.id]
    const current = await nativeCleavingCandidates(ctx, {
      state: nextState,
      ...context,
      visitedTargetActorIds,
      sceneScope
    })
    const sourceFacts = current.targets.get(context.sourceActorId)
    if (!sourceFacts) throw new Error('Cleaving source is unavailable after damage cleanup.')
    const source = await currentSource(ctx, nextState, sourceFacts, context.action.actionId)
    const child = createNativeCleavingChoice({
      ...nextState,
      ...context,
      sourceCurrentness: nativeCleavingSourceCurrentness(sourceFacts, source),
      optionalCombatSnapshotChecksum: pending.snapshot.optionalCombatSnapshotChecksum!,
      parentOccurrenceId: occurrence.id,
      parentResultChecksum: ruleResultChecksum,
      visitedTargetActorIds,
      damage: cleavingDamageEnvelope({ ...application, targetActorId: target.actor.id }),
      candidates: current.candidates
    })
    if (child) await insertNativeCleavingChoice(ctx, nextState, child, now)
  }
  return encounterCommandResultDtoSchema.parse({
    ...result,
    projection:
      membership.role === 'OWNER' ? projection : projectPlayerEncounterProjection(projection)
  })
}
