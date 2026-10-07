import { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { EncounterProjectionCharacterStates } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { terminalMovementChangedAggregates } from '@artificer-toolkit/rules-runtime/encounterMovementChangedAggregates'
import { readEncounterCharacterStates } from './characterStates.js'
import { readRunActors, readRunState } from './documents.js'
import { insertRunCommand, presentTimelineEntry } from './timelineEntries.js'
import {
  encounterReplayReceipt,
  readEncounterReplayReceipt,
  replayEncounterCommandResult
} from './replayReceipts.js'
import { readSpatialPreparation } from './sceneGeometryDocuments.js'
import type { EncounterPersistenceTransaction } from './ports.js'
import type { SceneStoredGeometrySave } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'

type SceneSpatialPrepareInput = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
type SpatialTerminalGeometry = {
  sceneTokens: readonly SceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
}

export type SpatialTerminalPublicationCallbacks = {
  readGeometrySave: (saveId: string) => Promise<{
    save: SceneStoredGeometrySave
    header: SceneLiveStateHeader
    userId: string
  }>
  settle: (
    saveId: string,
    geometry: SpatialTerminalGeometry,
    request?: SceneSpatialPrepareInput
  ) => Promise<{
    result: Extract<SceneSpatialPreparation['outcome'], { kind: 'TERMINAL' }>['result']
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

/** The parent must publish the prepared Scene/token/fog changes in this same mutation. */
export async function publishSpatialTerminal(
  ctx: EncounterPersistenceTransaction,
  saveId: string,
  geometry: SpatialTerminalGeometry,
  request: SceneSpatialPrepareInput | undefined,
  callbacks: SpatialTerminalPublicationCallbacks
) {
  const { save, header, userId } = await callbacks.readGeometrySave(saveId)
  const preparation = readSpatialPreparation(save)
  if (
    save.actorUserId !== userId ||
    save.input.type !== 'MOVE_SCENE_TOKEN' ||
    !save.sessionVision ||
    !preparation ||
    preparation.outcome.kind !== 'TERMINAL'
  )
    throw new Error('Spatial terminal publication is unavailable.')
  const input = save.input
  const outcome = preparation.outcome
  if (input.type !== 'MOVE_SCENE_TOKEN' || outcome.kind !== 'TERMINAL')
    throw new Error('Spatial terminal publication is unavailable.')
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', preparation.encounterId))
    .unique()
  if (!run) throw new Error('Spatial terminal Encounter is unavailable.')
  const state = readRunState(run)
  if (
    state.campaignId !== header.campaignId ||
    state.campaignId !== save.sessionVision?.campaignId ||
    state.gameSystemId !== save.sessionVision.systemId
  )
    throw new Error('Spatial terminal Encounter scope is inconsistent.')
  // Fog can advance the Scene even when the token returns to its origin. Frozen mechanics stay unchanged.
  const retained = {
    ...outcome.result,
    sceneVersion: Math.max(
      outcome.result.sceneVersion,
      save.snapshotVersion + (save.fogSaves.length > 0 ? 1 : 0)
    )
  }
  if (retained.occurrenceVersion !== 0)
    throw new Error('Initial spatial occurrence version is inconsistent.')
  const priorHeader = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', state.campaignId).eq('commandId', save.commandId)
    )
    .unique()
  if (
    priorHeader &&
    (priorHeader.commandType !== 'MOVE_SCENE_TOKEN' ||
      priorHeader.encounterId !== state.id ||
      priorHeader.commandFingerprint !== save.inputChecksum ||
      priorHeader.actorUserId !== userId ||
      priorHeader.version > state.version ||
      priorHeader.version !== retained.encounterVersion)
  )
    throw new Error('Spatial terminal command replay is inconsistent.')
  const prior = priorHeader
  if (prior && prior.commandType !== 'MOVE_SCENE_TOKEN')
    throw new Error('Spatial terminal command replay is inconsistent.')
  const metadataFor = (
    commandCharacterTransitions: readonly {
      characterId: string
      beforeStreamVersion: number
      afterStreamVersion: number
    }[]
  ) =>
    serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
      schemaVersion: 1,
      transition: 'SPATIAL_MOVEMENT',
      commandType: 'MOVE_SCENE_TOKEN',
      rootCommandId: save.commandId,
      rootCommandFingerprint: save.inputChecksum,
      rootInitiatorUserId: save.actorUserId,
      rootCorrelationId: input.correlationId,
      encounterId: state.id,
      sceneId: save.sceneId,
      tokenId: input.tokenId,
      movementKind: input.movementKind,
      expectedEncounterVersion: preparation.expectedEncounterVersion,
      expectedSceneVersion: input.expectedSceneVersion,
      rootExpectedEncounterVersion: preparation.expectedEncounterVersion,
      rootExpectedSceneVersion: input.expectedSceneVersion,
      encounterVersionTransition: 'ADVANCED',
      sceneVersionTransition:
        retained.sceneVersion === input.expectedSceneVersion ? 'UNCHANGED' : 'ADVANCED',
      currentnessChecksum: outcome.currentnessChecksum,
      selectionChecksum: outcome.selectionChecksum,
      optionalCombatSnapshotChecksum: prior
        ? prior.optionalCombatSnapshotChecksum
        : state.optionalCombatSnapshotChecksum,
      occurrenceVersion: retained.occurrenceVersion,
      changedAggregates: terminalMovementChangedAggregates({
        encounter: state,
        result: retained,
        expectedSceneVersion: input.expectedSceneVersion,
        expectedEncounterVersion: preparation.expectedEncounterVersion,
        sourceCommandId: save.commandId,
        commandCharacterTransitions
      }),
      resolutionCommands: []
    })

  if (prior) {
    presentTimelineEntry(prior)
    if (prior.ruleOccurrenceId !== preparation.occurrenceId)
      throw new Error('Spatial terminal command replay is inconsistent.')
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', preparation.occurrenceId))
      .unique()
    const receiptHeader = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', state.id).eq('commandId', save.commandId)
      )
      .unique()
    if (!occurrence || !receiptHeader)
      throw new Error('Spatial terminal replay receipt is unavailable.')
    const { _id: _occurrenceId, _creationTime: _occurrenceTime, ...storedOccurrence } = occurrence
    encounterStoredRuleOccurrenceSchema.parse(storedOccurrence)
    if (
      receiptHeader.campaignId !== state.campaignId ||
      receiptHeader.occurrenceId !== occurrence.id ||
      receiptHeader.commandType !== 'MOVE_SCENE_TOKEN' ||
      receiptHeader.commandFingerprint !== save.inputChecksum ||
      receiptHeader.encounterVersion !== retained.encounterVersion ||
      receiptHeader.actorUserId !== userId
    )
      throw new Error('Spatial terminal replay receipt is inconsistent.')
    const receipt = receiptHeader
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    const receiptMetadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    if (receiptMetadata.transition !== 'SPATIAL_MOVEMENT')
      throw new Error('Spatial terminal replay receipt is inconsistent.')
    const metadata = metadataFor(
      receiptMetadata.changedAggregates
        .filter((aggregate) => aggregate.aggregateKind === 'CHARACTER')
        .map((aggregate) => ({
          characterId: aggregate.aggregateId,
          beforeStreamVersion: aggregate.beforeVersion,
          afterStreamVersion: aggregate.version
        }))
    )
    if (
      occurrence.state !== 'COMPLETED' ||
      occurrence.encounterId !== state.id ||
      occurrence.campaignId !== state.campaignId ||
      occurrence.rootCommandId !== save.commandId ||
      occurrence.version !== retained.occurrenceVersion ||
      occurrence.expectedEncounterVersion !== retained.encounterVersion ||
      receipt.correlationId !== input.correlationId ||
      receipt.resultChecksum !== checksumCanonicalJson(payload) ||
      receipt.resultChecksum !== prior.ruleResultChecksum ||
      receipt.resultChecksum !== checksumCanonicalJson(retained) ||
      checksumCanonicalJson(receiptMetadata) !== checksumCanonicalJson(metadata)
    )
      throw new Error('Spatial terminal replay receipt is inconsistent.')
    const replayReceipt = readEncounterReplayReceipt(prior)
    if (
      replayReceipt.occurrence?.status !== 'COMPLETE' ||
      replayReceipt.occurrence.occurrenceId !== preparation.occurrenceId ||
      replayReceipt.occurrence.occurrenceVersion !== retained.occurrenceVersion ||
      replayReceipt.occurrence.pending !== null ||
      replayReceipt.roll !== null
    )
      throw new Error('Spatial terminal replay summary is inconsistent.')
    return replayEncounterCommandResult(ctx, state, prior)
  }
  const evaluated = await callbacks.settle(saveId, geometry, request)
  const metadata = metadataFor(evaluated.characterTransitions)
  const version = state.version + 1
  if (evaluated.result.encounterVersion !== version)
    throw new Error('Spatial terminal Run version is inconsistent.')
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version,
    updatedAt: preparation.occurredAt
  })
  const actors = await readRunActors(ctx, nextState)
  const projection = callbacks.project(
    nextState,
    actors,
    await readEncounterCharacterStates(ctx, nextState, actors)
  )
  const command = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: preparation.occurrenceId,
      occurrenceVersion: retained.occurrenceVersion,
      status: 'COMPLETE',
      pending: null
    }
  })
  const resultChecksum = checksumCanonicalJson(retained)
  await ctx.db.patch(run._id, {
    version,
    updatedAt: preparation.occurredAt,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  await ctx.db.insert(
    'encounterRuleOccurrences',
    encounterStoredRuleOccurrenceSchema.parse({
      id: preparation.occurrenceId,
      campaignId: state.campaignId,
      encounterId: state.id,
      rootCommandId: save.commandId,
      state: 'COMPLETED',
      version: retained.occurrenceVersion,
      expectedEncounterVersion: version,
      pendingSnapshotChecksum: null,
      createdAt: preparation.occurredAt,
      updatedAt: preparation.occurredAt,
      completedAt: preparation.occurredAt
    })
  )
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: state.campaignId,
      encounterId: state.id,
      occurrenceId: preparation.occurrenceId,
      commandId: save.commandId,
      commandType: 'MOVE_SCENE_TOKEN',
      commandFingerprint: save.inputChecksum,
      encounterVersion: version,
      commandMetadataJson: JSON.stringify(metadata),
      resultJson: JSON.stringify(retained),
      resultChecksum,
      actorUserId: userId,
      correlationId: input.correlationId,
      createdAt: preparation.occurredAt
    })
  )
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: state.campaignId,
      encounterId: state.id,
      commandId: save.commandId,
      commandType: 'MOVE_SCENE_TOKEN',
      commandFingerprint: save.inputChecksum,
      actorUserId: userId,
      version,
      commandJson: JSON.stringify(save.input),
      ...encounterReplayReceipt(command),
      ruleOccurrenceId: preparation.occurrenceId,
      ruleResultChecksum: resultChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      createdAt: preparation.occurredAt
    })
  )
  return command
}
