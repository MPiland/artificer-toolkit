import type { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { EncounterProjectionCharacterStates } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import {
  serverRuleExecutionPendingSnapshotDtoSchema,
  storedRuleExecutionResultDtoSchema
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { serverRuleExecutionPendingOccurrenceId } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectEncounterSpatialOccurrenceSummary } from '@artificer-toolkit/rules-runtime/encounterSpatialOccurrenceSummary'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { movementPendingCharacterAggregateVersions } from '@artificer-toolkit/rules-runtime/encounterMovementChangedAggregates'
import { checksumSpatialCurrentness } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementCurrentness'
import {
  readPendingSnapshot,
  writePendingSnapshot
} from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readEncounterControlledActorIds } from '@artificer-toolkit/encounter-persistence/actorController'
import { readEncounterCharacterStates } from '@artificer-toolkit/encounter-persistence/characterStates'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  insertRunCommand,
  requireUnusedEvidenceCommandId
} from '@artificer-toolkit/encounter-persistence/timelineEntries'
import { encounterReplayReceipt } from '@artificer-toolkit/encounter-persistence/replayReceipts'
import { readGeometrySave, readSpatialPreparation } from './geometryDocuments'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import type { readSpatialSceneGeometry } from './spatialGeometry'
import { encounterReadTransaction } from '../encounters/encounterPorts'

type SceneSpatialPrepareInput = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
type SpatialPendingGeometry = Awaited<ReturnType<typeof readSpatialSceneGeometry>>

export type SpatialPendingPublicationCallbacks<TSettlement> = {
  evaluateInitial: (
    ctx: MutationCtx,
    request: SceneSpatialPrepareInput,
    identity: Pick<SceneSpatialPreparation, 'occurrenceId' | 'occurredAt'>,
    retained: Extract<SceneSpatialPreparation['outcome'], { kind: 'PENDING' }>,
    geometry: SpatialPendingGeometry
  ) => Promise<{ outcome: SceneSpatialPreparation['outcome']; settlements: readonly TSettlement[] }>
  settle: (
    ctx: MutationCtx,
    settlements: readonly TSettlement[]
  ) => Promise<{
    mechanicsChanged: boolean
    characterTransitions: readonly {
      characterId: string
      beforeStreamVersion: number
      afterStreamVersion: number
    }[]
  }>
  project: (
    state: EncounterRunState,
    actors: EncounterRunActorState[],
    characterStates: EncounterProjectionCharacterStates
  ) => EncounterCommandResultDto['projection']
}

function withCurrentSceneVersion(
  snapshot: ReturnType<typeof serverRuleExecutionPendingSnapshotDtoSchema.parse>,
  currentSceneVersion: number
) {
  const { context, root } = readEncounterMovementPendingContext(snapshot)
  const nextRoot = { ...root, currentSceneVersion }
  const applicationContext =
    context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
      ? { ...context, movement: { ...context.movement, root: nextRoot } }
      : context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST'
        ? {
            ...context,
            sceneContext: context.sceneContext
              ? { ...context.sceneContext, sceneVersion: currentSceneVersion }
              : context.sceneContext,
            movementContinuation: { ...context.movementContinuation, root: nextRoot },
            positionalDependencyChecksum: checksumCanonicalJson({
              ...context.movementContinuation,
              root: nextRoot
            })
          }
        : { ...context, root: nextRoot }
  return serverRuleExecutionPendingSnapshotDtoSchema.parse({ ...snapshot, applicationContext })
}

function pendingChecksums(
  snapshot: ReturnType<typeof serverRuleExecutionPendingSnapshotDtoSchema.parse>
) {
  const { context } = readEncounterMovementPendingContext(snapshot)
  if (context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT')
    return { selectionChecksum: context.selectionChecksum, currentnessChecksum: null }
  if (context.kind === 'ENCOUNTER_MOVEMENT_REACTION')
    return {
      selectionChecksum: context.spatialSelectionChecksum,
      currentnessChecksum: context.spatialCurrentnessChecksum
    }
  const movement =
    context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
      ? context.movement
      : context.movementContinuation
  return {
    selectionChecksum: movement.spatialSelectionChecksum,
    currentnessChecksum: movement.spatialCurrentnessChecksum
  }
}

function movementHistory(
  context: ReturnType<typeof readEncounterMovementPendingContext>['context']
) {
  if (context.kind === 'ENCOUNTER_MOVEMENT_REACTION') return context
  if (context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE') return context.movement
  if (context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST') return context.movementContinuation
  return null
}

/** The caller commits the matching token and clipped fog in this same mutation. */
export async function publishSpatialPending<TSettlement>(
  ctx: MutationCtx,
  request: ReturnType<typeof sceneGeometryFinishInputSchema.parse>,
  geometry: Awaited<ReturnType<typeof readSpatialSceneGeometry>> | null,
  callbacks: SpatialPendingPublicationCallbacks<TSettlement>
) {
  const { save, campaign, membership, userId } =
    geometry?.saveContext ?? (await readGeometrySave(ctx, request.saveId))
  if (save.id !== request.saveId.toLowerCase())
    throw new Error('Spatial pending save identity differs.')
  const preparation = readSpatialPreparation(save)
  if (
    save.actorUserId !== userId ||
    save.input.type !== 'MOVE_SCENE_TOKEN' ||
    !preparation ||
    preparation.outcome.kind !== 'PENDING'
  )
    throw new Error('Spatial pending publication is unavailable.')
  const tokenId = save.input.tokenId
  const prepared = preparation.outcome
  const { context } = readEncounterMovementPendingContext(prepared.pendingSnapshot)
  const sceneVersion =
    save.snapshotVersion + (prepared.movementIntent || save.fogSaves.length ? 1 : 0)
  let pendingSnapshot = prepared.pendingSnapshot
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', preparation.encounterId))
    .unique()
  if (!run) throw new Error('Spatial pending Encounter is unavailable.')
  const state = readRunState(run)
  if (
    !save.sessionVision ||
    state.campaignId !== campaign.id ||
    state.campaignId !== save.sessionVision.campaignId ||
    state.gameSystemId !== save.sessionVision.systemId
  )
    throw new Error('Spatial pending Encounter scope is stale.')
  const initialEvaluation =
    geometry && save.status !== 'PUBLISHED'
      ? await callbacks.evaluateInitial(
          ctx,
          request,
          { occurrenceId: preparation.occurrenceId, occurredAt: preparation.occurredAt },
          prepared,
          geometry
        )
      : null
  if (
    initialEvaluation &&
    (initialEvaluation.outcome.kind !== 'PENDING' ||
      checksumCanonicalJson(initialEvaluation.outcome) !== checksumCanonicalJson(prepared))
  )
    throw new Error('Initial movement evaluation does not match retained preparation.')
  const memberActorIds = await readEncounterControlledActorIds(encounterReadTransaction(ctx), {
    campaign,
    membership,
    actors: await readRunActors(ctx, state)
  })
  const ownerActorIds = new Set(state.actorIds)
  const projected = (
    occurrence: {
      id: string
      version: number
      state: Doc<'encounterRuleOccurrences'>['state']
      pendingSnapshot: ReturnType<typeof serverRuleExecutionPendingSnapshotDtoSchema.parse> | null
    },
    encounterVersion: number,
    viewer: 'MEMBER' | 'OWNER'
  ) =>
    projectEncounterSpatialOccurrenceSummary(occurrence, encounterVersion, {
      controlledActorIds: viewer === 'OWNER' ? ownerActorIds : memberActorIds
    })
  const initialMovement = movementHistory(context)
  const initialAppliedSpatialPrefix = initialMovement?.appliedSpatialPrefix ?? null
  if (
    initialAppliedSpatialPrefix &&
    (initialAppliedSpatialPrefix.status !== 'BATCH_COMPLETE' ||
      initialAppliedSpatialPrefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
    throw new Error('Initial movement spatial history is unavailable.')
  // Only spatial effects apply before the first pause; every reaction waits for its controller.
  const initialAutomaticMechanicsChanged = initialEvaluation
    ? initialEvaluation.settlements.length > 0
    : initialAppliedSpatialPrefix?.status === 'BATCH_COMPLETE' &&
      initialAppliedSpatialPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT' &&
      initialAppliedSpatialPrefix.executions.length > 0
  const expectedPublicationVersion =
    preparation.expectedEncounterVersion + (initialAutomaticMechanicsChanged ? 1 : 0)
  if (initialMovement && initialAutomaticMechanicsChanged)
    pendingSnapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse({
      ...pendingSnapshot,
      applicationContext: {
        ...pendingSnapshot.applicationContext,
        ...(context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
          ? {
              movement: {
                ...context.movement,
                spatialCurrentnessChecksum: checksumSpatialCurrentness({
                  encounter: { id: state.id, version: expectedPublicationVersion },
                  candidates: context.movement.remainingSpatialCandidates
                })
              }
            }
          : context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST'
            ? {
                movementContinuation: {
                  ...context.movementContinuation,
                  spatialCurrentnessChecksum: checksumSpatialCurrentness({
                    encounter: { id: state.id, version: expectedPublicationVersion },
                    candidates: context.movementContinuation.remainingSpatialCandidates
                  })
                }
              }
            : {
                spatialCurrentnessChecksum: checksumSpatialCurrentness({
                  encounter: { id: state.id, version: expectedPublicationVersion },
                  candidates: initialMovement.remainingSpatialCandidates
                })
              })
      }
    })
  pendingSnapshot = withCurrentSceneVersion(pendingSnapshot, sceneVersion)
  const preparedOccurrence = {
    id: preparation.occurrenceId,
    version: 0,
    state: 'PENDING' as const,
    pendingSnapshot
  }
  let occurrence = projected(preparedOccurrence, expectedPublicationVersion, 'MEMBER')
  const characterTransitions = movementPendingCharacterAggregateVersions(
    initialAppliedSpatialPrefix
  ).map(
    ({
      aggregateId: characterId,
      beforeVersion: beforeStreamVersion,
      version: afterStreamVersion
    }) => ({
      characterId,
      beforeStreamVersion,
      afterStreamVersion
    })
  )
  let ownerOccurrence = projected(preparedOccurrence, expectedPublicationVersion, 'OWNER')
  const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
    schemaVersion: 1,
    transition: 'SPATIAL_MOVEMENT',
    commandType: 'MOVE_SCENE_TOKEN',
    rootCommandId: save.commandId,
    rootCommandFingerprint: save.inputChecksum,
    rootInitiatorUserId: save.actorUserId,
    rootCorrelationId: save.input.correlationId,
    encounterId: state.id,
    sceneId: save.sceneId,
    tokenId,
    movementKind: save.input.movementKind,
    expectedEncounterVersion: preparation.expectedEncounterVersion,
    expectedSceneVersion: save.input.expectedSceneVersion,
    rootExpectedEncounterVersion: preparation.expectedEncounterVersion,
    rootExpectedSceneVersion: save.input.expectedSceneVersion,
    encounterVersionTransition: initialAutomaticMechanicsChanged ? 'ADVANCED' : 'UNCHANGED',
    sceneVersionTransition: sceneVersion === save.snapshotVersion ? 'UNCHANGED' : 'ADVANCED',
    currentnessChecksum: pendingChecksums(pendingSnapshot).currentnessChecksum,
    selectionChecksum: pendingChecksums(pendingSnapshot).selectionChecksum,
    optionalCombatSnapshotChecksum: pendingSnapshot.optionalCombatSnapshotChecksum ?? null,
    occurrenceVersion: 0,
    changedAggregates: [
      ...(initialAutomaticMechanicsChanged
        ? [
            {
              aggregateKind: 'ENCOUNTER' as const,
              aggregateId: state.id,
              beforeVersion: preparation.expectedEncounterVersion,
              version: expectedPublicationVersion
            }
          ]
        : []),
      ...movementPendingCharacterAggregateVersions(initialAppliedSpatialPrefix),
      ...(sceneVersion === save.snapshotVersion
        ? []
        : [
            {
              aggregateKind: 'SCENE' as const,
              aggregateId: save.sceneId,
              beforeVersion: save.snapshotVersion,
              version: sceneVersion
            }
          ])
    ].sort((left, right) =>
      `${left.aggregateKind}:${left.aggregateId}`.localeCompare(
        `${right.aggregateKind}:${right.aggregateId}`
      )
    ),
    resolutionCommands: []
  })
  const existing = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', campaign.id).eq('rootCommandId', save.commandId)
    )
    .unique()
  const receipt = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_commandId', (q) =>
      q.eq('encounterId', state.id).eq('commandId', save.commandId)
    )
    .unique()
  if (existing || receipt) {
    if (
      !existing ||
      !receipt ||
      save.status !== 'PUBLISHED' ||
      existing.id !== preparation.occurrenceId ||
      existing.encounterId !== state.id ||
      existing.campaignId !== campaign.id ||
      existing.expectedEncounterVersion > state.version ||
      state.version < expectedPublicationVersion ||
      receipt.campaignId !== campaign.id ||
      receipt.occurrenceId !== existing.id ||
      receipt.commandType !== 'MOVE_SCENE_TOKEN' ||
      receipt.commandFingerprint !== save.inputChecksum ||
      receipt.encounterVersion !== expectedPublicationVersion ||
      receipt.actorUserId !== userId ||
      receipt.correlationId !== save.input.correlationId
    )
      throw new Error('Spatial pending replay identity is inconsistent.')
    const {
      _id: _occurrenceRowId,
      _creationTime: _occurrenceCreationTime,
      ...storedOccurrence
    } = existing
    encounterStoredRuleOccurrenceSchema.parse(storedOccurrence)
    const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    const receiptMetadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    if (
      result.status !== 'ENCOUNTER_OCCURRENCE_PENDING' ||
      result.occurrenceId !== existing.id ||
      result.occurrenceVersion !== 0 ||
      result.encounterId !== state.id ||
      result.encounterVersion !== expectedPublicationVersion ||
      checksumCanonicalJson(result.characterTransitions) !==
        checksumCanonicalJson(characterTransitions) ||
      receipt.resultChecksum !== checksumCanonicalJson(result) ||
      checksumCanonicalJson(receiptMetadata) !== checksumCanonicalJson(metadata) ||
      checksumCanonicalJson({ ...result.occurrence, pending: null }) !==
        checksumCanonicalJson({ ...ownerOccurrence, pending: null }) ||
      (result.occurrence.pending !== null &&
        checksumCanonicalJson(result.occurrence.pending) !==
          checksumCanonicalJson(ownerOccurrence.pending)) ||
      (existing.version === 0 &&
        (existing.state !== 'PENDING' ||
          existing.expectedEncounterVersion !== expectedPublicationVersion ||
          existing.pendingSnapshotChecksum !== checksumCanonicalJson(pendingSnapshot)))
    )
      throw new Error('Spatial pending replay evidence is inconsistent.')
    const currentPendingSnapshot = await readPendingSnapshot(ctx, existing)
    if (
      (existing.state === 'PENDING' && !currentPendingSnapshot) ||
      (existing.state === 'COMPLETED' && currentPendingSnapshot !== null)
    )
      throw new Error('Spatial pending replay state is inconsistent.')
    if (currentPendingSnapshot) {
      const currentContext = currentPendingSnapshot.applicationContext
      const currentRoot =
        currentContext.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
          ? currentContext.movement.root
          : currentContext.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' &&
              currentContext.movementContinuation
            ? currentContext.movementContinuation.root
            : currentContext.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
                currentContext.kind === 'ENCOUNTER_MOVEMENT_REACTION'
              ? currentContext.root
              : null
      if (
        !currentRoot ||
        serverRuleExecutionPendingOccurrenceId(currentPendingSnapshot) !== existing.id ||
        currentRoot.commandId !== save.commandId ||
        currentRoot.encounterId !== state.id ||
        currentRoot.sceneId !== save.sceneId ||
        currentRoot.resolutionCommands.length !== existing.version ||
        currentRoot.resolutionCommands.some(
          (command, index) => command.expectedOccurrenceVersion !== index
        )
      )
        throw new Error('Spatial pending replay state is inconsistent.')
    }
    return {
      occurrence: projected(
        {
          id: existing.id,
          version: existing.version,
          state: existing.state,
          pendingSnapshot: currentPendingSnapshot
        },
        state.version,
        'MEMBER'
      ),
      retainedOccurrence: occurrence
    }
  }
  if (!initialEvaluation) throw new Error('Spatial pending initial evaluation is unavailable.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, save.commandId)
  // Geometry and initial evaluation already validated the frozen preparation in this transaction.
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  if (!binding || binding.sceneId !== save.sceneId || binding.campaignId !== state.campaignId)
    throw new Error('Spatial preparation Scene binding is stale.')
  if (
    (prepared.pendingSnapshot.optionalCombatSnapshotChecksum ?? null) !==
    state.optionalCombatSnapshotChecksum
  )
    throw new Error('Spatial pending optional combat context is stale.')
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', state.id).eq('state', 'PENDING'))
    .take(1)
  const command = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', save.commandId)
    )
    .unique()
  if (pending.length || command)
    throw new Error('Encounter command or pending occurrence already exists.')
  let publishedState = state
  let publishedProjection:
    | Awaited<ReturnType<typeof advanceInitialAutomaticRun>>['projection']
    | null = null
  if (initialEvaluation) {
    const settled = await callbacks.settle(ctx, initialEvaluation.settlements)
    if (settled.mechanicsChanged !== initialAutomaticMechanicsChanged)
      throw new Error('Initial movement settlement is inconsistent.')
    if (
      checksumCanonicalJson(settled.characterTransitions) !==
      checksumCanonicalJson(characterTransitions)
    )
      throw new Error('Initial movement character transitions are inconsistent.')
    if (settled.mechanicsChanged) {
      const advanced = await advanceInitialAutomaticRun(
        ctx,
        run,
        state,
        preparation.occurredAt,
        callbacks.project
      )
      publishedState = advanced.state
      publishedProjection = advanced.projection
      occurrence = projected(
        { id: preparation.occurrenceId, version: 0, state: 'PENDING', pendingSnapshot },
        publishedState.version,
        'MEMBER'
      )
      ownerOccurrence = projected(
        { id: preparation.occurrenceId, version: 0, state: 'PENDING', pendingSnapshot },
        publishedState.version,
        'OWNER'
      )
    }
  }
  const payload = storedRuleExecutionResultDtoSchema.parse({
    status: 'ENCOUNTER_OCCURRENCE_PENDING',
    schemaVersion: 1,
    occurrenceId: preparation.occurrenceId,
    occurrenceVersion: 0,
    encounterId: state.id,
    encounterVersion: publishedState.version,
    occurrence: ownerOccurrence,
    characterTransitions
  })
  await ctx.db.insert(
    'encounterRuleOccurrences',
    encounterStoredRuleOccurrenceSchema.parse({
      id: preparation.occurrenceId,
      campaignId: campaign.id,
      encounterId: publishedState.id,
      rootCommandId: save.commandId,
      state: 'PENDING',
      version: 0,
      expectedEncounterVersion: publishedState.version,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: preparation.occurrenceId, encounterId: publishedState.id },
        pendingSnapshot
      ),
      completedAt: null,
      createdAt: preparation.occurredAt,
      updatedAt: preparation.occurredAt
    })
  )
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: publishedState.id,
      occurrenceId: preparation.occurrenceId,
      commandId: save.commandId,
      commandType: 'MOVE_SCENE_TOKEN',
      commandFingerprint: save.inputChecksum,
      encounterVersion: publishedState.version,
      commandMetadataJson: JSON.stringify(metadata),
      resultJson: JSON.stringify(payload),
      resultChecksum: checksumCanonicalJson(payload),
      actorUserId: userId,
      correlationId: save.input.correlationId,
      createdAt: preparation.occurredAt
    })
  )
  if (publishedProjection) {
    const command = encounterCommandResultDtoSchema.parse({
      projection: publishedProjection,
      roll: null,
      occurrence: ownerOccurrence
    })
    await insertRunCommand(
      ctx,
      encounterStoredRunCommandSchema.parse({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        encounterId: publishedState.id,
        commandId: save.commandId,
        commandType: 'MOVE_SCENE_TOKEN',
        commandFingerprint: save.inputChecksum,
        actorUserId: userId,
        version: publishedState.version,
        commandJson: JSON.stringify(save.input),
        ...encounterReplayReceipt(command),
        ruleOccurrenceId: preparation.occurrenceId,
        ruleResultChecksum: checksumCanonicalJson(payload),
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
        createdAt: preparation.occurredAt
      })
    )
  }
  return { occurrence, retainedOccurrence: occurrence }
}

async function advanceInitialAutomaticRun(
  ctx: MutationCtx,
  run: Doc<'encounterRuns'>,
  state: ReturnType<typeof readRunState>,
  occurredAt: string,
  project: SpatialPendingPublicationCallbacks<unknown>['project']
) {
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: occurredAt
  })
  const actors = await readRunActors(ctx, nextState)
  const projection = project(
    nextState,
    actors,
    await readEncounterCharacterStates(encounterReadTransaction(ctx), nextState, actors)
  )
  await ctx.db.patch(run._id, {
    version: nextState.version,
    updatedAt: occurredAt,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  return { state: nextState, projection }
}
