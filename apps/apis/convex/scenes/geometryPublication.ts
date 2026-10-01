import type { EncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import {
  sceneGeometryFinishInputSchema,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { publishSceneGeometry as publishSharedSceneGeometry } from '@artificer-toolkit/encounter-persistence/sceneGeometryPublication'
import { parseGeometryCommand } from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { parseFogSave } from './fogDocuments'
import { assertStandaloneMovement, readGeometrySave } from './geometryDocuments'
import { parseLiveEntity } from './liveDocuments'
import { publishFogLayer } from './fogPublication'
import { readSessionVisionScope } from './sessionVisionDocuments'
import { readSpatialSceneGeometry } from './spatialGeometry'
import { assertSceneVisionCharacters } from './visionFreshness'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

type SceneGeometryFinishInput = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
type SceneGeometrySaveRead = Awaited<ReturnType<typeof readGeometrySave>>
type SpatialSceneGeometry = Awaited<ReturnType<typeof readSpatialSceneGeometry>>
type SpatialTerminalGeometry = Pick<SpatialSceneGeometry, 'sceneTokens' | 'actorIdByTokenId'>

export type SceneGeometryPublication = {
  publishPreparedMovementResponse: (
    ctx: MutationCtx,
    request: SceneGeometryFinishInput,
    geometry: SpatialTerminalGeometry | null
  ) => Promise<{ occurrence: EncounterRuleOccurrenceSummaryDto }>
  publishPreparedSpatialPending: (
    ctx: MutationCtx,
    request: SceneGeometryFinishInput,
    geometry: SpatialSceneGeometry | null
  ) => Promise<{
    occurrence: SceneGeometryCommandResult['occurrence']
    retainedOccurrence: SceneGeometryCommandResult['occurrence']
  }>
  publishPreparedSpatialTerminal: (
    ctx: MutationCtx,
    saveId: string,
    geometry: SpatialTerminalGeometry,
    request?: SceneGeometryFinishInput
  ) => Promise<{ occurrence: SceneGeometryCommandResult['occurrence'] }>
  verifyPreparedUninterruptedMovement: (
    ctx: MutationCtx,
    request: SceneGeometryFinishInput,
    geometry: SpatialTerminalGeometry
  ) => Promise<void>
}

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

/** The Session room supplies the rules that publish Encounter-bound movement (D43). */
export async function publishSceneGeometry(
  ctx: MutationCtx,
  args: SceneGeometryFinishInput,
  rules: SceneGeometryPublication | null,
  previouslyRead?: SceneGeometrySaveRead
): Promise<SceneGeometryCommandResult> {
  const input = sceneGeometryFinishInputSchema.parse(args)
  const currentSave = previouslyRead ?? (await readGeometrySave(ctx, input.saveId.toLowerCase()))
  const liveRows = new Map<string, Doc<'sceneLiveEntities'>>()
  return publishSharedSceneGeometry<SpatialSceneGeometry>(
    encounterWriteTransaction(ctx),
    input,
    rules
      ? {
          publishPreparedMovementResponse: (request, geometry) =>
            rules.publishPreparedMovementResponse(ctx, request, geometry),
          publishPreparedSpatialPending: (request, geometry) =>
            rules.publishPreparedSpatialPending(ctx, request, geometry),
          publishPreparedSpatialTerminal: (saveId, geometry, request) =>
            rules.publishPreparedSpatialTerminal(ctx, saveId, geometry, request),
          verifyPreparedUninterruptedMovement: (request, geometry) =>
            rules.verifyPreparedUninterruptedMovement(ctx, request, geometry)
        }
      : null,
    {
      readGeometrySave: (saveId) => readGeometrySave(ctx, saveId),
      readSceneCommand: async (sceneId, commandId) => {
        const row = await ctx.db
          .query('sceneLiveCommands')
          .withIndex('by_sceneId_commandId', (q) =>
            q.eq('sceneId', sceneId).eq('commandId', commandId)
          )
          .unique()
        if (!row) return null
        if (row.encoding !== 'GEOMETRY') throw new Error('Scene command ID was already used.')
        return parseGeometryCommand(row, currentSave.header.version)
      },
      readLiveEntity: async (sceneId, collection, entityId) => {
        const row = await ctx.db
          .query('sceneLiveEntities')
          .withIndex('by_sceneId_collection_entityId', (q) =>
            q.eq('sceneId', sceneId).eq('collection', collection).eq('entityId', entityId)
          )
          .unique()
        if (!row) return null
        liveRows.set(sceneId + ':' + collection + ':' + entityId, row)
        return parseLiveEntity(row, currentSave.header.version)
      },
      readDefinitionEntity: async (saveId, collection, ordinal) => {
        const row = await ctx.db
          .query('sceneDefinitionEntities')
          .withIndex('by_saveId_collection_ordinal', (q) =>
            q.eq('saveId', saveId).eq('value.collection', collection).eq('ordinal', ordinal)
          )
          .unique()
        return row ? sceneStoredDefinitionEntitySchema.parse(stored(row)) : null
      },
      assertStandaloneMovement: (campaignId, command) =>
        assertStandaloneMovement(ctx, campaignId, command),
      readSessionVisionScope: (scope, current) => readSessionVisionScope(ctx, scope, current),
      assertSceneVisionCharacters: (revisions) => assertSceneVisionCharacters(ctx, revisions),
      readSpatialSceneGeometry: (saveId, hints) =>
        readSpatialSceneGeometry(ctx, saveId, hints, currentSave),
      writeLiveEntity: async (value) => {
        const row = liveRows.get(value.sceneId + ':' + value.collection + ':' + value.entityId)
        if (row) await ctx.db.replace(row._id, value)
        else await ctx.db.insert('sceneLiveEntities', value)
      },
      writeLiveState: async (value) => {
        if (currentSave.liveRow) await ctx.db.replace(currentSave.liveRow._id, value)
        else await ctx.db.insert('sceneLiveStates', value)
      },
      publishFog: async (reference, save, header, state) => {
        const childRow = await ctx.db
          .query('sceneFogSaves')
          .withIndex('by_publicId', (q) => q.eq('id', reference.saveId))
          .unique()
        if (!childRow) throw new Error('Stored geometry fog save is inconsistent.')
        const child = parseFogSave(childRow)
        if (
          child.geometrySaveId !== save.id ||
          child.sceneId !== save.sceneId ||
          child.actorUserId !== save.actorUserId ||
          child.input.layer.ownerUserId !== reference.ownerUserId ||
          child.status !== 'RECEIVING' ||
          child.chunksRemoved ||
          child.expiresAt <= Date.now() ||
          child.receivedChunks !== child.input.chunkManifest.length ||
          child.input.expectedSceneVersion !== save.snapshotVersion
        )
          throw new Error('Stored geometry fog save is inconsistent.')
        const publication = await publishFogLayer(ctx, child, header, state)
        await ctx.db.patch(childRow._id, {
          status: 'PUBLISHED',
          ...(save.input.type === 'MOVE_SCENE_TOKEN'
            ? { previousLayer: publication.previousLayer }
            : {})
        })
        return publication.patch
      },
      markGeometryPublished: async () => {
        await ctx.db.patch(currentSave.row._id, { status: 'PUBLISHED' })
      },
      insertSceneCommand: async (value) => {
        await ctx.db.insert('sceneLiveCommands', value)
      }
    },
    currentSave
  )
}
