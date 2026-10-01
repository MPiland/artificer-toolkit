import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneGeometryPageInputSchema,
  sceneGeometryPageSchema,
  sceneGeometryCommandChunksInputSchema,
  sceneGeometryCommandChunksPageSchema,
  type SceneGeometryPage
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { internalQuery, query } from '../lib/queries'
import { readLiveScene } from './liveDocuments'
import { readCurrentEntities } from './currentEntities'
import {
  parseGeometryCommand,
  parseGeometrySave
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { parseFogSave, readFogChunk } from './fogDocuments'

export const commandChunks = query({
  args: zodToConvexFields(sceneGeometryCommandChunksInputSchema.shape),
  returns: zodToConvex(sceneGeometryCommandChunksPageSchema),
  handler: async (ctx, args) => {
    const input = sceneGeometryCommandChunksInputSchema.parse(args)
    const { header } = await readLiveScene(ctx, input.sceneId, 'OWNER')
    const row = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', header.id).eq('commandId', input.commandId)
      )
      .unique()
    if (!row) throw new Error('Scene geometry command is unavailable.')
    const command = parseGeometryCommand(row, header.version)
    const patch = command.result.fogPatches.find((entry) => entry.ownerUserId === input.ownerUserId)
    if (!patch) throw new Error('Scene geometry fog patch is unavailable.')
    const childRow = await ctx.db
      .query('sceneFogSaves')
      .withIndex('by_publicId', (q) => q.eq('id', patch.saveId))
      .unique()
    if (!childRow) throw new Error('Scene geometry fog source is unavailable.')
    const child = parseFogSave(childRow)
    if (!child.geometrySaveId) throw new Error('Stored Scene geometry fog source is inconsistent.')
    const parentRow = await ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_publicId', (q) => q.eq('id', child.geometrySaveId!))
      .unique()
    if (!parentRow) throw new Error('Scene geometry command source is unavailable.')
    const parent = parseGeometrySave(parentRow)
    if (
      parent.status !== 'PUBLISHED' ||
      child.status !== 'PUBLISHED' ||
      parent.sceneId !== header.id ||
      child.sceneId !== header.id ||
      parent.commandId !== command.commandId ||
      parent.inputChecksum !== command.inputChecksum ||
      parent.actorUserId !== command.actorUserId ||
      child.actorUserId !== command.actorUserId ||
      parent.snapshotVersion + 1 !== command.result.version ||
      child.input.expectedSceneVersion !== parent.snapshotVersion ||
      child.commandId !== child.id ||
      child.input.layer.ownerUserId !== patch.ownerUserId ||
      child.input.layer.width !== patch.width ||
      child.input.layer.height !== patch.height ||
      child.input.chunkManifest.length !== patch.chunkCount ||
      !parent.fogSaves.some(
        (entry) => entry.saveId === child.id && entry.ownerUserId === patch.ownerUserId
      )
    )
      throw new Error('Stored Scene geometry fog source is inconsistent.')
    if (input.offset > patch.chunkCount) throw new Error('Fog page offset is beyond the command.')
    const selected = child.input.chunkManifest.slice(input.offset, input.offset + input.numItems)
    const page = await Promise.all(
      selected.map((chunk, index) =>
        readFogChunk(
          ctx,
          {
            ...chunk,
            saveId: child.id,
            ordinal: input.offset + index
          },
          header.id,
          child.input.layer
        )
      )
    )
    const nextOffset = input.offset + selected.length
    return sceneGeometryCommandChunksPageSchema.parse({
      result: command.result,
      patch,
      page,
      nextOffset,
      isDone: nextOffset === patch.chunkCount
    })
  }
})

export const entities = internalQuery({
  args: zodToConvexFields(sceneGeometryPageInputSchema.shape),
  returns: zodToConvex(sceneGeometryPageSchema),
  handler: async (ctx, args): Promise<SceneGeometryPage> => {
    const input = sceneGeometryPageInputSchema.parse(args)
    return sceneGeometryPageSchema.parse(await readCurrentEntities(ctx, input, 'MEMBER'))
  }
})
