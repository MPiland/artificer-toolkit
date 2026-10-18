import type { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { EncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { serverRuleExecutionPendingOccurrenceId } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import {
  serverRuleExecutionPendingSnapshotDtoSchema,
  type ServerRuleExecutionReceiptCommandMetadataDto,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { terminalMovementChangedAggregates } from '@artificer-toolkit/rules-runtime/encounterMovementChangedAggregates'
import { checksumSpatialCurrentness } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementCurrentness'
import { projectEncounterSpatialOccurrenceSummary } from '@artificer-toolkit/rules-runtime/encounterSpatialOccurrenceSummary'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterPersistenceTransaction } from './ports.js'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import type { SceneStoredGeometrySave } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import type { sceneStoredLiveCommandSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import type { EncounterDocument } from './store.js'
import { readEncounterControlledActorIds } from './actorController.js'
import { readEncounterCharacterStates } from './characterStates.js'
import { readRunActors, readRunState, runZoneApplicationsAfter } from './documents.js'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import {
  parseGeometryCommand,
  readMovementResolution,
  readSpatialPreparation
} from './sceneGeometryDocuments.js'
import type {
  readResponse,
  Geometry,
  assertMovementResolutionCurrent
} from './movementResolutionDocuments.js'
import type { SpatialPendingPublicationCallbacks } from './spatialPendingPublication.js'
import type { SpatialTerminalPublicationCallbacks } from './spatialTerminalPublication.js'
import {
  contestCheckMovementContinuation,
  readEncounterMovementPendingContext
} from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { rejectDomain } from './domainRejections.js'

type MovementSettlement = Awaited<ReturnType<SpatialPendingPublicationCallbacks<unknown>['settle']>>

/** The room's frozen response outcome, its decision history, and the settled mechanics. */
type MovementResponseCommit = MovementSettlement & {
  outcome: Exclude<
    NonNullable<ReturnType<typeof readSpatialPreparation>>['outcome'],
    { kind: 'UNINTERRUPTED' }
  >
  resolutionCommands: ReturnType<
    typeof readEncounterMovementPendingContext
  >['root']['resolutionCommands']
  commandCharacterTransitions: MovementSettlement['characterTransitions']
}

type MovementResponseSaveContext = {
  save: SceneStoredGeometrySave
  header: SceneLiveStateHeader
  campaign: EncounterDocument<'campaigns'>
  membership: EncounterDocument<'campaignMemberships'>
  userId: string
}

type MovementResponsePublicationCallbacks = {
  readGeometrySave: (saveId: string) => Promise<MovementResponseSaveContext>
  readSceneReceipt: (
    sceneId: string,
    commandId: string
  ) => Promise<ReturnType<typeof sceneStoredLiveCommandSchema.parse> | null>
  readResponse: (
    saveId: string,
    geometry: Geometry
  ) => Promise<Awaited<ReturnType<typeof readResponse>>>
  commit: (
    request: ReturnType<typeof sceneGeometryFinishInputSchema.parse>,
    response: Awaited<ReturnType<typeof readResponse>>
  ) => Promise<MovementResponseCommit>
  project: SpatialTerminalPublicationCallbacks['project']
}

type SpatialResponseMetadata = Extract<
  ServerRuleExecutionReceiptCommandMetadataDto,
  { transition: 'SPATIAL_MOVEMENT' }
>
type MovementResponsePayload = Extract<
  StoredRuleExecutionResultDto,
  | { status: 'ENCOUNTER_OCCURRENCE_PENDING' }
  | { status: 'MOVEMENT_COMPLETE' }
  | { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
>

function pendingChecksums(
  snapshot: ReturnType<typeof serverRuleExecutionPendingSnapshotDtoSchema.parse>
) {
  if (!snapshot) throw new Error('Movement response pending snapshot is unavailable.')
  const context = snapshot.applicationContext
  if (context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT')
    return { selectionChecksum: context.selectionChecksum, currentnessChecksum: null }
  if (context.kind === 'ENCOUNTER_MOVEMENT_REACTION')
    return {
      selectionChecksum: context.spatialSelectionChecksum,
      currentnessChecksum: context.spatialCurrentnessChecksum
    }
  if (context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
    return {
      selectionChecksum: context.movement.spatialSelectionChecksum,
      currentnessChecksum: context.movement.spatialCurrentnessChecksum
    }
  const continuation =
    context.kind === 'ENCOUNTER_CONTEST_CHECK' ? contestCheckMovementContinuation(context) : null
  if (continuation)
    return {
      selectionChecksum: continuation.spatialSelectionChecksum,
      currentnessChecksum: continuation.spatialCurrentnessChecksum
    }
  throw new Error('Movement response pending context is unavailable.')
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
      : context.kind === 'ENCOUNTER_CONTEST_CHECK'
        ? {
            ...context,
            sceneContext: context.sceneContext
              ? { ...context.sceneContext, sceneVersion: currentSceneVersion }
              : context.sceneContext,
            origin: {
              ...context.origin,
              movementContinuation: { ...context.origin.movementContinuation, root: nextRoot }
            },
            positionalDependencyChecksum: checksumCanonicalJson({
              ...context.origin.movementContinuation,
              root: nextRoot
            })
          }
        : { ...context, root: nextRoot }
  return serverRuleExecutionPendingSnapshotDtoSchema.parse({ ...snapshot, applicationContext })
}

function withSpatialCurrentness(
  snapshot: ReturnType<typeof serverRuleExecutionPendingSnapshotDtoSchema.parse>,
  spatialCurrentnessChecksum: string | undefined
) {
  if (!spatialCurrentnessChecksum) return snapshot
  const { context } = readEncounterMovementPendingContext(snapshot)
  const applicationContext =
    context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
      ? {
          ...context,
          movement: { ...context.movement, spatialCurrentnessChecksum }
        }
      : context.kind === 'ENCOUNTER_CONTEST_CHECK'
        ? {
            ...context,
            origin: {
              ...context.origin,
              movementContinuation: {
                ...context.origin.movementContinuation,
                spatialCurrentnessChecksum
              }
            }
          }
        : { ...context, spatialCurrentnessChecksum }
  return serverRuleExecutionPendingSnapshotDtoSchema.parse({ ...snapshot, applicationContext })
}

function responseMetadata(input: {
  save: SceneStoredGeometrySave
  response: ReturnType<typeof readMovementResolution>
  outcome: Exclude<
    NonNullable<ReturnType<typeof readSpatialPreparation>>['outcome'],
    { kind: 'UNINTERRUPTED' }
  >
  resolutionCommands: MovementResponseCommit['resolutionCommands']
  changedAggregates: ReturnType<typeof terminalMovementChangedAggregates>
  encounterVersionTransition: 'UNCHANGED' | 'ADVANCED'
  sceneVersionTransition: 'UNCHANGED' | 'ADVANCED'
}): SpatialResponseMetadata {
  const resolution = input.response
  if (!resolution) throw new Error('Movement response evidence is unavailable.')
  const checksums =
    input.outcome.kind === 'TERMINAL'
      ? {
          selectionChecksum: input.outcome.selectionChecksum,
          currentnessChecksum: input.outcome.currentnessChecksum
        }
      : pendingChecksums(input.outcome.pendingSnapshot)
  const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
    schemaVersion: 1,
    transition: 'SPATIAL_MOVEMENT',
    commandType: 'RESOLVE_RULE_OCCURRENCE',
    rootCommandId: resolution.root.commandId,
    rootCommandFingerprint: resolution.root.commandFingerprint,
    rootInitiatorUserId: resolution.root.initiatorUserId,
    rootCorrelationId: resolution.root.correlationId,
    encounterId: resolution.root.encounterId,
    sceneId: resolution.root.sceneId,
    tokenId: resolution.root.tokenId,
    movementKind: resolution.root.movementKind,
    expectedEncounterVersion: resolution.command.expectedVersion,
    expectedSceneVersion: input.save.snapshotVersion,
    rootExpectedEncounterVersion: resolution.root.expectedEncounterVersion,
    rootExpectedSceneVersion: resolution.root.expectedSceneVersion,
    encounterVersionTransition: input.encounterVersionTransition,
    sceneVersionTransition: input.sceneVersionTransition,
    currentnessChecksum: checksums.currentnessChecksum,
    selectionChecksum: checksums.selectionChecksum,
    optionalCombatSnapshotChecksum: resolution.snapshot.optionalCombatSnapshotChecksum ?? null,
    occurrenceVersion: resolution.command.expectedOccurrenceVersion + 1,
    changedAggregates: input.changedAggregates,
    resolutionCommands: input.resolutionCommands
  })
  if (
    metadata.transition !== 'SPATIAL_MOVEMENT' ||
    metadata.commandType !== 'RESOLVE_RULE_OCCURRENCE'
  )
    throw new Error('Movement response receipt metadata is inconsistent.')
  return metadata
}

function isMovementResponsePayload(
  payload: StoredRuleExecutionResultDto
): payload is MovementResponsePayload {
  return (
    payload.status === 'ENCOUNTER_OCCURRENCE_PENDING' ||
    payload.status === 'MOVEMENT_COMPLETE' ||
    (payload.status === 'BATCH_COMPLETE' && payload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
}

async function projectCurrentOccurrence(
  ctx: EncounterPersistenceTransaction,
  input: MovementResponseSaveContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
): Promise<EncounterRuleOccurrenceSummaryDto> {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', occurrence.encounterId))
    .unique()
  if (!run || occurrence.campaignId !== input.campaign.id || run.campaignId !== input.campaign.id)
    throw new Error('Movement response Encounter scope is inconsistent.')
  const state = readRunState(run)
  const pendingSnapshot = await readPendingSnapshot(ctx, occurrence)

  return projectEncounterSpatialOccurrenceSummary(
    {
      id: occurrence.id,
      version: occurrence.version,
      state: occurrence.state,
      pendingSnapshot
    },
    state.version,
    {
      controlledActorIds: await readEncounterControlledActorIds(ctx, {
        campaign: input.campaign,
        membership: input.membership,
        actors: await readRunActors(ctx, state)
      }),
      isOwner: input.membership.role === 'OWNER'
    }
  )
}

/** Publishes one response receipt, occurrence update, Run update, and the caller's Scene writes atomically. */
export async function publishMovementResponse(
  ctx: EncounterPersistenceTransaction,
  request: ReturnType<typeof sceneGeometryFinishInputSchema.parse>,
  geometry: Geometry | null,
  callbacks: MovementResponsePublicationCallbacks
): Promise<{ occurrence: EncounterRuleOccurrenceSummaryDto }> {
  const saveId = request.saveId
  const input = await callbacks.readGeometrySave(saveId)
  const { save } = input
  const resolution = readMovementResolution(save)
  const preparation = readSpatialPreparation(save)
  if (
    !resolution ||
    !preparation ||
    preparation.outcome.kind === 'UNINTERRUPTED' ||
    save.input.type !== 'MOVE_SCENE_TOKEN'
  )
    throw new Error('Movement response publication is unavailable.')
  const receiptHeader = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', input.campaign.id).eq('commandId', resolution.command.commandId)
    )
    .unique()
  if (receiptHeader) {
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', resolution.command.occurrenceId))
      .unique()
    const sceneReceipt = await callbacks.readSceneReceipt(save.sceneId, save.commandId)
    if (!occurrence || !sceneReceipt || sceneReceipt.actorUserId !== save.actorUserId)
      throw new Error('Movement response replay evidence is unavailable.')
    const {
      _id: _occurrenceId,
      _creationTime: _occurrenceCreatedAt,
      ...storedOccurrence
    } = occurrence
    encounterStoredRuleOccurrenceSchema.parse(storedOccurrence)
    const sceneCommand = parseGeometryCommand(sceneReceipt, input.header.version)
    const responseCommandChecksum = checksumCanonicalJson(resolution.command)
    if (
      receiptHeader.campaignId !== input.campaign.id ||
      receiptHeader.encounterId !== resolution.command.encounterId ||
      receiptHeader.occurrenceId !== occurrence.id ||
      receiptHeader.commandType !== resolution.command.type ||
      receiptHeader.commandFingerprint !== responseCommandChecksum ||
      receiptHeader.actorUserId !== save.actorUserId
    )
      throw new Error('Movement response replay evidence is inconsistent.')
    const receipt = receiptHeader
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (!isMovementResponsePayload(payload))
      throw new Error('Movement response replay payload is inconsistent.')
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    if (
      metadata.transition !== 'SPATIAL_MOVEMENT' ||
      metadata.commandType !== 'RESOLVE_RULE_OCCURRENCE'
    )
      throw new Error('Movement response replay metadata is inconsistent.')
    const responseHistory = metadata.resolutionCommands
    const responseEntry = responseHistory.at(-1)
    const sceneOccurrence = sceneCommand.result.occurrence
    const terminal =
      payload.status === 'MOVEMENT_COMPLETE' ||
      (payload.status === 'BATCH_COMPLETE' && payload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
    if (
      metadata.transition !== 'SPATIAL_MOVEMENT' ||
      metadata.commandType !== 'RESOLVE_RULE_OCCURRENCE' ||
      metadata.rootCommandId !== resolution.root.commandId ||
      metadata.rootCommandFingerprint !== resolution.root.commandFingerprint ||
      metadata.rootInitiatorUserId !== resolution.root.initiatorUserId ||
      metadata.rootCorrelationId !== resolution.root.correlationId ||
      metadata.encounterId !== resolution.root.encounterId ||
      metadata.sceneId !== save.sceneId ||
      metadata.tokenId !== save.input.tokenId ||
      metadata.movementKind !== save.input.movementKind ||
      metadata.expectedEncounterVersion !== resolution.command.expectedVersion ||
      metadata.expectedSceneVersion !== save.snapshotVersion ||
      metadata.rootExpectedEncounterVersion !== resolution.root.expectedEncounterVersion ||
      metadata.rootExpectedSceneVersion !== resolution.root.expectedSceneVersion ||
      metadata.optionalCombatSnapshotChecksum !==
        (resolution.snapshot.optionalCombatSnapshotChecksum ?? null) ||
      metadata.occurrenceVersion !== resolution.command.expectedOccurrenceVersion + 1 ||
      responseHistory.length !== metadata.occurrenceVersion ||
      !responseEntry ||
      responseEntry.commandId !== resolution.command.commandId ||
      responseEntry.commandFingerprint !== responseCommandChecksum ||
      responseEntry.actorUserId !== save.actorUserId ||
      responseEntry.correlationId !== resolution.command.correlationId ||
      responseEntry.expectedOccurrenceVersion !== resolution.command.expectedOccurrenceVersion ||
      receipt.correlationId !== resolution.command.correlationId ||
      receipt.resultChecksum !== checksumCanonicalJson(payload) ||
      receipt.encounterVersion !==
        resolution.command.expectedVersion +
          (metadata.encounterVersionTransition === 'ADVANCED' ? 1 : 0) ||
      occurrence.campaignId !== input.campaign.id ||
      occurrence.encounterId !== resolution.command.encounterId ||
      occurrence.rootCommandId !== resolution.root.commandId ||
      occurrence.version < metadata.occurrenceVersion ||
      payload.occurrenceId !== occurrence.id ||
      payload.occurrenceVersion !== metadata.occurrenceVersion ||
      payload.encounterId !== resolution.command.encounterId ||
      (terminal &&
        (occurrence.state !== 'COMPLETED' ||
          occurrence.version !== metadata.occurrenceVersion ||
          occurrence.pendingSnapshotChecksum !== null)) ||
      sceneCommand.inputChecksum !== save.inputChecksum ||
      sceneOccurrence?.occurrenceId !== occurrence.id ||
      sceneOccurrence?.occurrenceVersion !== metadata.occurrenceVersion
    )
      throw new Error('Movement response replay evidence is inconsistent.')
    return { occurrence: await projectCurrentOccurrence(ctx, input, occurrence) }
  }
  if (!geometry) throw new Error('Movement response geometry is unavailable.')

  const response = await callbacks.readResponse(saveId, geometry)
  const { current } = response
  if (
    preparation.encounterId !== current.state.id ||
    preparation.occurrenceId !== current.occurrence.id ||
    preparation.expectedEncounterVersion !== current.state.version ||
    current.command.commandId !== resolution.command.commandId
  )
    throw new Error('Movement response preparation is stale.')
  await requireUnusedEvidenceCommandId(ctx, input.campaign.id, resolution.command.commandId)
  const priorCommand = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', input.campaign.id).eq('commandId', resolution.command.commandId)
    )
    .unique()
  if (priorCommand) rejectDomain('COMMAND_ID_REUSED')
  const committed = await callbacks.commit(request, response)
  const outcome = committed.outcome
  if (outcome.kind === 'PENDING') {
    const version = current.state.version + (committed.mechanicsChanged ? 1 : 0)
    const advancedProjection = committed.mechanicsChanged
      ? await advanceMovementResponseRun(ctx, current, preparation.occurredAt, callbacks.project)
      : null
    const preparedContext = outcome.pendingSnapshot.applicationContext
    let spatialCurrentnessChecksum: string | undefined
    const movementContext =
      preparedContext.kind === 'ENCOUNTER_MOVEMENT_REACTION'
        ? preparedContext
        : preparedContext.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
          ? preparedContext.movement
          : preparedContext.kind === 'ENCOUNTER_CONTEST_CHECK'
            ? preparedContext.origin.movementContinuation
            : null
    if (committed.mechanicsChanged && movementContext) {
      const candidates = [
        ...movementContext.completedSpatialExecutions
          .slice(
            movementContext.appliedSpatialPrefix?.status === 'BATCH_COMPLETE'
              ? movementContext.appliedSpatialPrefix.executions.length
              : 0
          )
          .map((execution) => execution.candidate),
        ...(preparedContext.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
        preparedContext.phase.kind === 'SPATIAL_EVIDENCE'
          ? [preparedContext.phase.currentCandidate]
          : []),
        ...movementContext.remainingSpatialCandidates
      ]
      const baselineTargets = new Map<string, (typeof candidates)[number]['target']>()
      spatialCurrentnessChecksum = checksumSpatialCurrentness({
        encounter: { id: current.state.id, version },
        candidates: candidates.map((candidate) => {
          const actorId = candidate.candidate.targetActorId
          const target = baselineTargets.get(actorId) ?? candidate.target
          if (
            checksumCanonicalJson({ ...target, targetStateChecksum: null }) !==
            checksumCanonicalJson({ ...candidate.target, targetStateChecksum: null })
          )
            throw new Error('Pending spatial target currentness is inconsistent.')
          baselineTargets.set(actorId, target)
          // Neutral currentness hashes loaded baseline state, before staged contacts or dice.
          return { ...candidate, target, d20Policy: null, diceStage: null }
        })
      })
    }
    const snapshotWithCurrentness = withSpatialCurrentness(
      outcome.pendingSnapshot,
      spatialCurrentnessChecksum
    )
    const sceneVersion =
      save.snapshotVersion + (outcome.movementIntent || save.fogSaves.length ? 1 : 0)
    const snapshot = withCurrentSceneVersion(snapshotWithCurrentness, sceneVersion)
    const { root: pendingRoot } = readEncounterMovementPendingContext(snapshot)
    const checksums = pendingChecksums(snapshot)
    if (
      serverRuleExecutionPendingOccurrenceId(snapshot) !== current.occurrence.id ||
      pendingRoot.resolutionCommands.length !== current.occurrence.version + 1 ||
      pendingRoot.currentSceneVersion !== sceneVersion ||
      (outcome.movementIntent !== null && outcome.movementIntent.tokenId !== save.input.tokenId) ||
      (snapshot.optionalCombatSnapshotChecksum ?? null) !==
        current.state.optionalCombatSnapshotChecksum
    )
      throw new Error('Movement response pending outcome is inconsistent.')
    const occurrence = projectEncounterSpatialOccurrenceSummary(
      {
        id: current.occurrence.id,
        version: current.occurrence.version + 1,
        state: 'PENDING',
        pendingSnapshot: snapshot
      },
      version,
      {
        controlledActorIds: await readEncounterControlledActorIds(ctx, {
          campaign: input.campaign,
          membership: input.membership,
          actors: await readRunActors(ctx, current.state)
        }),
        isOwner: input.membership.role === 'OWNER'
      }
    )
    const ownerOccurrence = projectEncounterSpatialOccurrenceSummary(
      {
        id: current.occurrence.id,
        version: current.occurrence.version + 1,
        state: 'PENDING',
        pendingSnapshot: snapshot
      },
      version,
      { controlledActorIds: new Set(current.state.actorIds), isOwner: true }
    )
    const payload = storedRuleExecutionResultDtoSchema.parse({
      status: 'ENCOUNTER_OCCURRENCE_PENDING',
      schemaVersion: 1,
      occurrenceId: current.occurrence.id,
      occurrenceVersion: current.occurrence.version + 1,
      encounterId: current.state.id,
      encounterVersion: version,
      occurrence: ownerOccurrence,
      characterTransitions: committed.characterTransitions
    })
    const changedAggregates = [
      ...committed.characterTransitions.map((transition) => ({
        aggregateKind: 'CHARACTER' as const,
        aggregateId: transition.characterId,
        beforeVersion: transition.beforeStreamVersion,
        version: transition.afterStreamVersion
      })),
      ...(committed.mechanicsChanged
        ? [
            {
              aggregateKind: 'ENCOUNTER' as const,
              aggregateId: current.state.id,
              beforeVersion: current.state.version,
              version
            }
          ]
        : []),
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
    )
    const metadata = responseMetadata({
      save,
      response: resolution,
      outcome: { ...outcome, pendingSnapshot: snapshot },
      resolutionCommands: committed.resolutionCommands,
      changedAggregates,
      encounterVersionTransition: committed.mechanicsChanged ? 'ADVANCED' : 'UNCHANGED',
      sceneVersionTransition: sceneVersion === save.snapshotVersion ? 'UNCHANGED' : 'ADVANCED'
    })
    if (
      metadata.selectionChecksum !== checksums.selectionChecksum ||
      metadata.currentnessChecksum !== checksums.currentnessChecksum ||
      metadata.resolutionCommands.length !== current.occurrence.version + 1
    )
      throw new Error('Movement response pending receipt is inconsistent.')
    await ctx.db.patch(current.occurrence._id, {
      version: current.occurrence.version + 1,
      expectedEncounterVersion: version,
      pendingSnapshotChecksum: await writePendingSnapshot(ctx, current.occurrence, snapshot),
      updatedAt: preparation.occurredAt
    })
    if (advancedProjection)
      await insertMovementResponseCommand(
        ctx,
        current,
        advancedProjection,
        ownerOccurrence,
        checksumCanonicalJson(payload),
        preparation.occurredAt
      )
    await ctx.db.insert(
      'encounterRuleReceipts',
      encounterStoredRuleReceiptSchema.parse({
        id: crypto.randomUUID(),
        campaignId: input.campaign.id,
        encounterId: current.state.id,
        occurrenceId: current.occurrence.id,
        commandId: resolution.command.commandId,
        commandType: resolution.command.type,
        commandFingerprint: checksumCanonicalJson(resolution.command),
        encounterVersion: version,
        commandMetadataJson: JSON.stringify(metadata),
        resultJson: JSON.stringify(payload),
        resultChecksum: checksumCanonicalJson(payload),
        actorUserId: current.userId,
        correlationId: resolution.command.correlationId,
        createdAt: preparation.occurredAt
      })
    )
    return { occurrence }
  }

  const retained = {
    ...outcome.result,
    sceneVersion: Math.max(
      outcome.result.sceneVersion,
      save.snapshotVersion + (save.fogSaves.length > 0 ? 1 : 0)
    )
  }
  const version = current.state.version + 1
  if (
    retained.encounterVersion !== version ||
    retained.occurrenceVersion !== current.occurrence.version + 1
  )
    throw new Error('Movement response terminal outcome is inconsistent.')
  const changedAggregates = terminalMovementChangedAggregates({
    encounter: current.state,
    result: retained,
    expectedSceneVersion: save.snapshotVersion,
    expectedEncounterVersion: current.state.version,
    sourceCommandId: resolution.command.commandId,
    commandCharacterTransitions: committed.commandCharacterTransitions
  })
  const metadata = responseMetadata({
    save,
    response: resolution,
    outcome,
    resolutionCommands: committed.resolutionCommands,
    changedAggregates,
    encounterVersionTransition: 'ADVANCED',
    sceneVersionTransition:
      retained.sceneVersion === save.snapshotVersion ? 'UNCHANGED' : 'ADVANCED'
  })
  const projection = await advanceMovementResponseRun(
    ctx,
    current,
    preparation.occurredAt,
    callbacks.project,
    retained
  )
  const occurrence = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: current.occurrence.id,
      occurrenceVersion: retained.occurrenceVersion,
      status: 'COMPLETE',
      pending: null
    }
  }).occurrence!
  const resultChecksum = checksumCanonicalJson(retained)
  await ctx.db.patch(current.occurrence._id, {
    state: 'COMPLETED',
    version: retained.occurrenceVersion,
    expectedEncounterVersion: version,
    pendingSnapshotChecksum: await writePendingSnapshot(ctx, current.occurrence, null),
    completedAt: preparation.occurredAt,
    updatedAt: preparation.occurredAt
  })
  await insertMovementResponseCommand(
    ctx,
    current,
    projection,
    occurrence,
    resultChecksum,
    preparation.occurredAt
  )
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: input.campaign.id,
      encounterId: current.state.id,
      occurrenceId: current.occurrence.id,
      commandId: resolution.command.commandId,
      commandType: resolution.command.type,
      commandFingerprint: checksumCanonicalJson(resolution.command),
      encounterVersion: version,
      commandMetadataJson: JSON.stringify(metadata),
      resultJson: JSON.stringify(retained),
      resultChecksum,
      actorUserId: current.userId,
      correlationId: resolution.command.correlationId,
      createdAt: preparation.occurredAt
    })
  )
  return { occurrence }
}

async function advanceMovementResponseRun(
  ctx: EncounterPersistenceTransaction,
  current: Awaited<ReturnType<typeof assertMovementResolutionCurrent>>,
  occurredAt: string,
  project: SpatialTerminalPublicationCallbacks['project'],
  /** The terminal result whose zone triggers the Run counts; absent while the movement is pending. */
  settled?: Parameters<typeof runZoneApplicationsAfter>[1]
) {
  const version = current.state.version + 1
  const nextState = encounterRunStateSchema.parse({
    ...current.state,
    version,
    zoneApplications: settled
      ? runZoneApplicationsAfter(current.state, settled)
      : current.state.zoneApplications,
    updatedAt: occurredAt
  })
  const actors = await readRunActors(ctx, nextState)
  const projection = project(
    nextState,
    actors,
    await readEncounterCharacterStates(ctx, nextState, actors)
  )
  await ctx.db.patch(current.run._id, {
    version,
    updatedAt: occurredAt,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  return projection
}

async function insertMovementResponseCommand(
  ctx: EncounterPersistenceTransaction,
  current: Awaited<ReturnType<typeof assertMovementResolutionCurrent>>,
  projection: Awaited<ReturnType<typeof advanceMovementResponseRun>>,
  occurrence: EncounterRuleOccurrenceSummaryDto,
  resultChecksum: string,
  occurredAt: string
) {
  const version = current.state.version + 1
  const result = encounterCommandResultDtoSchema.parse({ projection, roll: null, occurrence })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: current.state.campaignId,
      encounterId: current.state.id,
      commandId: current.command.commandId,
      commandType: current.command.type,
      commandFingerprint: checksumCanonicalJson(current.command),
      actorUserId: current.userId,
      version,
      commandJson: JSON.stringify(current.command),
      ...encounterReplayReceipt(result),
      ruleOccurrenceId: current.occurrence.id,
      ruleResultChecksum: resultChecksum,
      optionalCombatSnapshotChecksum: current.state.optionalCombatSnapshotChecksum,
      createdAt: occurredAt
    })
  )
}
