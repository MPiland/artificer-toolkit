import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { internalMutation } from '../lib/mutations'

/**
 * Scene command receipts (`sceneLiveCommands`) and geometry saves back two readers only:
 * idempotent replay by command ID (client retries and Session outbox redelivery, which settle within
 * minutes of commit) and owner undo, which walks back through committed moves. Thirty days keeps
 * replay far beyond any retry horizon and bounds undo history to the last month of play.
 *
 * Receipts are removed oldest-first by creation time, together with their geometry save. An UNDO
 * receipt is always newer than the move it reverses, so a retained move never loses its undo marker.
 * Unpublished saves have already expired through `geometryStaging:cleanup`.
 */
export const SCENE_COMMAND_RETENTION_MS = 30 * 86_400_000
const PURGE_BATCH_SIZE = 64

const purgeReference = makeFunctionReference<'mutation', Record<string, never>, null>(
  'scenes/commandRetention:purge'
)

export const purge = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - SCENE_COMMAND_RETENTION_MS
    const commands = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', cutoff))
      .take(PURGE_BATCH_SIZE)
    for (const command of commands) {
      const save = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', command.sceneId).eq('commandId', command.commandId)
        )
        .unique()
      if (save) await ctx.db.delete(save._id)
      await ctx.db.delete(command._id)
    }

    // Saves without a receipt (expired staging, or orphaned) age out on their own. A save whose
    // receipt is still retained stops this pass; the receipt pass removes both once it ages out.
    const saves = await ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', cutoff))
      .take(PURGE_BATCH_SIZE)
    let savesDeleted = 0
    for (const save of saves) {
      if (save.status === 'RECEIVING') break
      const command = await ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', save.sceneId).eq('commandId', save.commandId)
        )
        .unique()
      if (command) break
      await ctx.db.delete(save._id)
      savesDeleted++
    }

    if (commands.length === PURGE_BATCH_SIZE || savesDeleted === PURGE_BATCH_SIZE)
      await ctx.scheduler.runAfter(0, purgeReference, {})
    return null
  }
})
