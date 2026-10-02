import { readMovementResponseAuthority } from '@artificer-toolkit/encounter-persistence/movementResolutionDocuments'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { isEncounterMovementContext } from '@artificer-toolkit/encounter-persistence/occurrenceOwner'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { readRuleOccurrenceVoidDecline } from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import { requireUnusedEvidenceCommandId } from '@artificer-toolkit/encounter-persistence/timelineEntries'
import { requireBoundTokenMoveControl } from '@artificer-toolkit/encounter-persistence/actorController'
import {
  normalizeGeometryInput,
  geometryTarget
} from '@artificer-toolkit/encounter-persistence/sceneGeometryValues'
import {
  parseGeometryCommand,
  parseGeometrySave,
  readMovementResolution,
  assertStandaloneMovement
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { parseSceneLiveEntity } from '@artificer-toolkit/encounter-persistence/sceneLiveState'
import type { EncounterPersistenceTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import {
  sceneGeometryBeginResultSchema,
  type SceneGeometryBeginResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { ExternalSceneCommand, ExternalSceneContext } from './nativeExternalSceneCommit.js'
import type { RoomTransaction } from './roomEncounterStore.js'
import { readRoomScene } from './roomSceneRead.js'
import { readRoomSceneRow, writeRoomSceneRow } from './roomSceneRecords.js'
import { readRoomSessionVisionScope } from './roomSceneGeometryRead.js'

/** Receiving evidence exists only inside the command transaction; rollback discards the whole save. */
export async function stageRoomSceneGeometry(input: {
  ctx: EncounterPersistenceTransaction
  transaction: RoomTransaction
  command: ExternalSceneCommand
  context: ExternalSceneContext
  observed: LiveSessionRulesRevisions
}): Promise<SceneGeometryBeginResult> {
  const { ctx, transaction, context, observed } = input
  const { userId } = await ctx.ports.requireIdentity()
  const { header } = readRoomScene(transaction, context.scene.id)
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(
    header.campaignId,
    userId
  )
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  const sourceRecord = transaction.record('SCENE_CHECKPOINT_SOURCE', header.id)
  if (!sourceRecord) throw new Error('Room Scene source is unavailable.')
  const source = liveSessionCheckpointSceneSourceSchema.parse(JSON.parse(sourceRecord.json))
  if (
    source.presentationVersion !== context.presentation.expectedPresentationVersion ||
    context.scene.campaignId !== campaign.id ||
    context.scene.version !== header.version
  )
    throw new Error('Scene vision presentation is stale.')
  let resolution: ReturnType<typeof sceneStoredGeometrySaveSchema.parse>['movementResolution']
  let priorResponseSave: ReturnType<typeof parseGeometrySave> | null = null
  let command = input.command
  if (command.type === 'VOID_RULE_OCCURRENCE')
    command = await readRuleOccurrenceVoidDecline(ctx, command)
  if (command.type === 'RESOLVE_RULE_OCCURRENCE') {
    const responseCommand = command
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', responseCommand.encounterId))
      .unique()
    if (!run) throw new Error('Encounter is unavailable.')
    const { campaign: responseCampaign } = await ctx.ports.requireCampaignAuthority(
      run.campaignId,
      userId
    )
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', responseCommand.occurrenceId))
      .unique()
    if (
      !occurrence ||
      occurrence.encounterId !== run.id ||
      occurrence.campaignId !== responseCampaign.id
    )
      throw new Error('Rule occurrence is unavailable.')
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', run.id).eq('commandId', responseCommand.commandId)
      )
      .unique()
    // A fresh answer to a decision that already settled is stale (D78); its own retry replays.
    if (!receipt && occurrence.state !== 'PENDING') rejectDomain('VERSION_STALE')
    const metadata = receipt
      ? serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
          JSON.parse(receipt.commandMetadataJson)
        )
      : null
    const snapshot = await readPendingSnapshot(ctx, occurrence)
    const pending =
      snapshot && isEncounterMovementContext(snapshot.applicationContext)
        ? readEncounterMovementPendingContext(snapshot)
        : null
    const sceneId =
      metadata?.transition === 'SPATIAL_MOVEMENT'
        ? metadata.sceneId
        : (pending?.root.sceneId ?? null)
    if (sceneId !== header.id) throw new Error('Movement response Scene binding is stale.')
    const saves = transaction
      .records('SCENE_CHECKPOINT_ROW')
      .filter((record) => record.key.startsWith('["sceneGeometrySaves",'))
      .map((record) => parseGeometrySave(JSON.parse(record.json)))
      .filter((save) => save.sceneId === sceneId && save.commandId === responseCommand.commandId)
    if (saves.length > 1) throw new Error('Scene geometry command was already used.')
    priorResponseSave = saves[0] ?? null
    if (priorResponseSave) {
      const retained = readMovementResolution(priorResponseSave)
      if (
        !retained ||
        priorResponseSave.input.type !== 'MOVE_SCENE_TOKEN' ||
        priorResponseSave.actorUserId !== userId ||
        checksumCanonicalJson(responseCommand) !==
          priorResponseSave.movementResolution!.commandChecksum ||
        !priorResponseSave.sessionVision ||
        priorResponseSave.sessionVision.campaignId !== responseCampaign.id ||
        priorResponseSave.sessionVision.systemId !== responseCampaign.gameSystemId
      )
        throw new Error('Movement response command ID was already used.')
      if (priorResponseSave.status === 'PUBLISHED') {
        if (
          !receipt ||
          receipt.campaignId !== responseCampaign.id ||
          receipt.encounterId !== run.id ||
          receipt.occurrenceId !== occurrence.id ||
          receipt.actorUserId !== userId ||
          receipt.commandType !== responseCommand.type ||
          receipt.commandFingerprint !== checksumCanonicalJson(responseCommand) ||
          metadata?.transition !== 'SPATIAL_MOVEMENT' ||
          metadata.commandType !== responseCommand.type
        )
          throw new Error('Movement response receipt is inconsistent.')
      } else await readMovementResponseAuthority(ctx, responseCommand)
      resolution = priorResponseSave.movementResolution
      command = priorResponseSave.input
    } else {
      if (receipt) throw new Error('Movement response receipt has no Scene publication.')
      const current = await readMovementResponseAuthority(ctx, responseCommand)
      const root = current.root
      if (root.sceneId !== header.id) throw new Error('Movement response Scene binding is stale.')
      await requireUnusedEvidenceCommandId(
        ctx,
        campaign.id,
        responseCommand.commandId.toLowerCase()
      )
      resolution = {
        commandJson: JSON.stringify(command),
        commandChecksum: checksumCanonicalJson(responseCommand),
        pendingSnapshotJson: JSON.stringify(current.snapshot),
        pendingSnapshotChecksum: current.occurrence.pendingSnapshotChecksum!
      }
      command = {
        type: 'MOVE_SCENE_TOKEN',
        commandId: responseCommand.commandId,
        sceneId: root.sceneId,
        tokenId: root.tokenId,
        expectedSceneVersion: root.currentSceneVersion,
        expectedEncounterVersion: responseCommand.expectedVersion,
        correlationId: responseCommand.correlationId,
        movementKind: root.movementKind,
        path: root.originalPath
      }
    }
  }
  const normalized = normalizeGeometryInput(command)
  const target = geometryTarget(normalized)
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_sceneId', (q) => q.eq('sceneId', header.id))
    .first()
  if (normalized.sceneId !== header.id || normalized.expectedSceneVersion > header.version)
    throw new Error('Scene version is ahead of the authoritative state.')
  const inputChecksum = checksumCanonicalJson(normalized)
  const priorRow = readRoomSceneRow(transaction, 'sceneLiveCommands', [
    header.id,
    normalized.commandId
  ])
  if (priorRow) {
    const prior = parseGeometryCommand(priorRow, header.version)
    if (prior.inputChecksum !== inputChecksum || prior.actorUserId !== userId)
      throw new Error('Scene command ID was already used.')
    if (
      resolution &&
      (!priorResponseSave ||
        priorResponseSave.status !== 'PUBLISHED' ||
        priorResponseSave.inputChecksum !== inputChecksum)
    )
      throw new Error('Stored Scene geometry save is inconsistent.')
    return sceneGeometryBeginResultSchema.parse({
      kind: 'REPLAY',
      result: { ...prior.result, replayed: true }
    })
  }
  const priorSaves = transaction
    .records('SCENE_CHECKPOINT_ROW')
    .filter((record) => record.key.startsWith('["sceneGeometrySaves",'))
    .map((record) => parseGeometrySave(JSON.parse(record.json)))
    .filter((save) => save.sceneId === header.id && save.commandId === normalized.commandId)
  if (priorSaves.length) throw new Error('Scene geometry command was already used.')
  const bound =
    normalized.type === 'MOVE_SCENE_TOKEN' && normalized.expectedEncounterVersion !== null
  if (bound && !resolution) {
    if (!binding) throw new Error('Bound Scene movement requires an Encounter binding.')
    await requireBoundTokenMoveControl(ctx, {
      campaign,
      membership,
      encounterId: binding.encounterId,
      tokenId: normalized.tokenId
    })
  }
  await assertStandaloneMovement(ctx, campaign.id, normalized)
  const override = readRoomSceneRow(transaction, 'sceneLiveEntities', [
    header.id,
    target.collection,
    target.entityId
  ])
  if (
    override &&
    parseSceneLiveEntity(override, header.version).version > normalized.expectedSceneVersion
  )
    throw new Error('Scene target changed before this command completed.')
  const freshness = (scope: 'SYSTEM' | 'CAMPAIGN' | 'PLAY', id: string) => {
    const revisions = observed.filter((entry) => entry.scope === scope && entry.id === id)
    if (revisions.length !== 1) throw new Error('Room Scene vision revision is unavailable.')
    return revisions[0]!.revision
  }
  const sessionVision = {
    campaignId: campaign.id,
    systemId: campaign.gameSystemId,
    sceneId: header.id,
    expectedSceneVersion: header.version,
    expectedPresentationVersion: context.presentation.expectedPresentationVersion,
    freshness: {
      system: freshness('SYSTEM', campaign.gameSystemId),
      campaign: freshness('CAMPAIGN', campaign.id),
      play: freshness('PLAY', campaign.id)
    }
  }
  readRoomSessionVisionScope(
    sessionVision,
    {
      header,
      campaign,
      userId,
      presentation: {
        campaignId: campaign.id,
        sceneId: header.id,
        version: source.presentationVersion
      }
    },
    observed
  )
  if (
    new Set(context.characterRevisions.map((entry) => entry.characterId)).size !==
    context.characterRevisions.length
  )
    throw new Error('Scene geometry Character observations are duplicated.')
  for (const character of context.characterRevisions) {
    const revision = observed.find(
      (entry) => entry.scope === 'CHARACTER' && entry.id === character.characterId
    )
    if (!revision || revision.revision !== character.revision)
      throw new Error('Scene vision Character changed before geometry publication.')
  }
  const save = sceneStoredGeometrySaveSchema.parse({
    id: crypto.randomUUID(),
    sceneId: header.id,
    commandId: normalized.commandId,
    actorUserId: userId,
    input: normalized,
    inputChecksum,
    snapshotVersion: header.version,
    sessionVision,
    characterRevisions: [...context.characterRevisions].sort((a, b) =>
      a.characterId.localeCompare(b.characterId)
    ),
    ...(resolution ? { movementResolution: resolution } : {}),
    status: 'RECEIVING',
    expiresAt: Date.now() + 24 * 60 * 60_000,
    fogSaves: []
  })
  parseGeometrySave(save)
  writeRoomSceneRow(transaction, 'sceneGeometrySaves', save)
  return sceneGeometryBeginResultSchema.parse({
    kind: 'READY',
    saveId: save.id,
    input: save.input,
    header,
    encounterId: binding?.encounterId ?? null,
    ...(resolution
      ? { movementStartDistance: readMovementResolution(save)!.root.pathStartDistance }
      : {}),
    sessionVision
  })
}
