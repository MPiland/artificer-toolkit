import { ConvexError, v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  sceneRecipientCaptureInputSchema,
  sceneRecipientHeaderInputSchema
} from '@artificer-toolkit/schema/api/sceneRecipient'
import { sceneLiveCollectionSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import { action, type MutationCtx, type QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { internalMutation } from '../lib/mutations'
import { readLiveScene } from './liveDocuments'

const ROLLBACK_MARKER = 'Injected Scene geometry rollback'
const FIXTURE_CAMPAIGN_NAME = 'Encounter execution fixture'
const EMPTY_FOG_TILE = `${'A'.repeat(171)}=`

type CaptureInput = { sceneId: string; expectedVersion: number }
type SceneIdInput = { sceneId: string }

const inspectReference = makeFunctionReference<'query', SceneIdInput, string>(
  'scenes/developmentProof:inspect'
)
const forceRollbackReference = makeFunctionReference<'mutation', CaptureInput, null>(
  'scenes/developmentProof:forceRollback'
)

async function fixtureScene(ctx: QueryCtx | MutationCtx, sceneId: string) {
  const scene = await readLiveScene(ctx, sceneId, 'OWNER')
  await requireFixtureAccount(ctx, scene.userId)
  if (scene.campaign.name !== FIXTURE_CAMPAIGN_NAME)
    throw new Error('Fixture Scene Campaign is missing.')
  return scene
}

export const inspect = internalQuery({
  args: zodToConvex(sceneRecipientHeaderInputSchema),
  returns: v.string(),
  handler: async (ctx, args) => {
    const input = sceneRecipientHeaderInputSchema.parse(args)
    const { header, liveRow } = await fixtureScene(ctx, input.sceneId)
    const entities: Array<Doc<'sceneLiveEntities'>> = []
    for (const collection of sceneLiveCollectionSchema.options) {
      const rows = await ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_ordinal', (q) =>
          q.eq('sceneId', header.id).eq('collection', collection)
        )
        .take(17 - entities.length)
      entities.push(...rows)
      if (entities.length > 16) throw new Error('Fixture Scene entity bounds exceeded.')
    }
    const [commands, geometrySaves, fogSaves, fogLayers] = await Promise.all([
      ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', header.id))
        .take(17),
      ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', header.id))
        .take(17),
      ctx.db
        .query('sceneFogSaves')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', header.id))
        .take(17),
      ctx.db
        .query('sceneFogLayers')
        .withIndex('by_sceneId_ownerUserId', (q) => q.eq('sceneId', header.id))
        .take(17)
    ])
    if (
      commands.length > 16 ||
      geometrySaves.length > 16 ||
      fogSaves.length > 16 ||
      fogLayers.length > 16
    )
      throw new Error('Fixture Scene inspection exceeds its bounds.')
    const fogChunks: Array<Doc<'sceneFogChunks'>> = []
    for (const save of fogSaves) {
      const rows = await ctx.db
        .query('sceneFogChunks')
        .withIndex('by_saveId_ordinal', (q) => q.eq('saveId', save.id))
        .take(257 - fogChunks.length)
      fogChunks.push(...rows)
      if (fogChunks.length > 256) throw new Error('Fixture Scene fog chunk bounds exceeded.')
    }
    return JSON.stringify({
      head: liveRow,
      entities: entities.sort(
        (left, right) =>
          left.collection.localeCompare(right.collection) ||
          (left.ordinal ?? -1) - (right.ordinal ?? -1) ||
          left.entityId.localeCompare(right.entityId)
      ),
      commands: commands.sort((left, right) => left.commandId.localeCompare(right.commandId)),
      geometrySaves: geometrySaves.sort((left, right) =>
        left.commandId.localeCompare(right.commandId)
      ),
      fogSaves: fogSaves.sort((left, right) => left.commandId.localeCompare(right.commandId)),
      fogLayers: fogLayers.sort((left, right) =>
        (left.ownerUserId ?? '').localeCompare(right.ownerUserId ?? '')
      ),
      fogChunks: fogChunks.sort(
        (left, right) => left.saveId.localeCompare(right.saveId) || left.ordinal - right.ordinal
      )
    })
  }
})

export const forceRollback = internalMutation({
  args: zodToConvex(sceneRecipientCaptureInputSchema),
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = sceneRecipientCaptureInputSchema.parse(args)
    const { header, userId } = await fixtureScene(ctx, input.sceneId)
    if (header.version !== input.expectedVersion)
      throw new Error('Live Scene snapshot changed before rollback proof.')
    const before = await ctx.runQuery(inspectReference, { sceneId: header.id })
    const staged = await ctx.runMutation(internal.scenes.geometryStaging.begin, {
      input: {
        type: 'UPSERT_SCENE_TOKEN',
        sceneId: header.id,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: header.version,
        token: {
          id: crypto.randomUUID(),
          assetId: null,
          controlledByUserIds: [],
          height: 1,
          hidden: false,
          label: 'Rollback fixture token',
          locked: false,
          position: { x: 0, y: 0 },
          rotationDegrees: 0,
          vision: null,
          width: 1
        }
      }
    })
    if (staged.kind !== 'READY') throw new Error('Fixture Scene geometry staging replayed.')
    await ctx.runMutation(internal.scenes.geometryStaging.stageFog, {
      saveId: staged.saveId,
      layer: {
        ownerUserId: userId,
        width: 32,
        height: 32,
        chunks: [{ index: 0, x: 0, y: 0, width: 32, height: 32, data: EMPTY_FOG_TILE }]
      }
    })
    const result = await ctx.runMutation(internal.scenes.geometryCommands.finish, {
      saveId: staged.saveId,
      baseOrdinal: null
    })
    if (
      result.version !== header.version + 1 ||
      result.fogPatches.length !== 1 ||
      result.fogPatches[0]?.ownerUserId !== userId
    )
      throw new Error('Fixture Scene geometry write did not complete.')
    if (before === (await ctx.runQuery(inspectReference, { sceneId: header.id })))
      throw new Error('Fixture Scene geometry write did not change persisted state.')
    throw new ConvexError(ROLLBACK_MARKER)
  }
})

export const verifyRollback = action({
  args: zodToConvex(sceneRecipientCaptureInputSchema),
  returns: v.object({ rolledBack: v.literal(true) }),
  handler: async (ctx, args): Promise<{ rolledBack: true }> => {
    const input = sceneRecipientCaptureInputSchema.parse(args)
    const before = await ctx.runQuery(inspectReference, { sceneId: input.sceneId })
    let caughtMarker = false
    try {
      await ctx.runMutation(forceRollbackReference, input)
    } catch (error) {
      if (!(error instanceof ConvexError) || error.data !== ROLLBACK_MARKER) throw error
      caughtMarker = true
    }
    if (!caughtMarker) throw new Error('Fixture Scene rollback marker was not raised.')
    if (before !== (await ctx.runQuery(inspectReference, { sceneId: input.sceneId })))
      throw new Error('Fixture Scene rollback changed persisted state.')
    return { rolledBack: true }
  }
})
