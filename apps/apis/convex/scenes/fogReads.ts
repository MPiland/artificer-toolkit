import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneFogLayersPageInputSchema,
  sceneFogLayersPageSchema,
  sceneFogChunksPageInputSchema,
  sceneFogChunksPageSchema,
  sceneFogCommandChunksInputSchema,
  sceneFogCommandChunksPageSchema
} from '@artificer-toolkit/schema/api/sceneFog'
import { query } from '../lib/queries'
import { parseFogSave, parseFogCommand, readFogChunk } from './fogDocuments'
import { readFogChunks, readFogLayers } from './fogReadDocuments'
import { readLiveScene } from './liveDocuments'

export const layers = query({
  args: zodToConvexFields(sceneFogLayersPageInputSchema.shape),
  returns: zodToConvex(sceneFogLayersPageSchema),
  handler: async (ctx, args) => {
    return readFogLayers(ctx, sceneFogLayersPageInputSchema.parse(args), 'RECIPIENT')
  }
})

export const chunks = query({
  args: zodToConvexFields(sceneFogChunksPageInputSchema.shape),
  returns: zodToConvex(sceneFogChunksPageSchema),
  handler: async (ctx, args) => {
    return readFogChunks(ctx, sceneFogChunksPageInputSchema.parse(args), 'RECIPIENT')
  }
})

export const commandChunks = query({
  args: zodToConvexFields(sceneFogCommandChunksInputSchema.shape),
  returns: zodToConvex(sceneFogCommandChunksPageSchema),
  handler: async (ctx, args) => {
    const input = sceneFogCommandChunksInputSchema.parse(args)
    const { header } = await readLiveScene(ctx, input.sceneId, 'OWNER')
    const row = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', header.id).eq('commandId', input.commandId)
      )
      .unique()
    if (!row) throw new Error('Scene fog command is unavailable.')
    const command = parseFogCommand(row, header.version)
    const saveRow = await ctx.db
      .query('sceneFogSaves')
      .withIndex('by_publicId', (q) => q.eq('id', command.result.patch.saveId))
      .unique()
    if (!saveRow) throw new Error('Scene fog command source is unavailable.')
    const save = parseFogSave(saveRow)
    if (
      save.status !== 'PUBLISHED' ||
      save.inputChecksum !== command.inputChecksum ||
      save.sceneId !== header.id ||
      save.commandId !== input.commandId
    )
      throw new Error('Stored Scene fog command source is inconsistent.')
    if (input.offset > save.input.chunkManifest.length)
      throw new Error('Fog page offset is beyond the command.')
    const selected = save.input.chunkManifest.slice(input.offset, input.offset + input.numItems)
    const page = await Promise.all(
      selected.map((chunk, index) =>
        readFogChunk(
          ctx,
          {
            ...chunk,
            saveId: save.id,
            ordinal: input.offset + index
          },
          header.id,
          save.input.layer
        )
      )
    )
    const nextOffset = input.offset + selected.length
    return sceneFogCommandChunksPageSchema.parse({
      result: command.result,
      page,
      nextOffset,
      isDone: nextOffset === save.input.chunkManifest.length
    })
  }
})
