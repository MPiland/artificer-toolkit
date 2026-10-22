import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  appendSceneDefinitionInputSchema,
  beginSceneDefinitionInputSchema,
  sceneDefinitionSaveLookupSchema,
  sceneDefinitionSaveProgressSchema,
  type AppendSceneDefinitionInput,
  type BeginSceneDefinitionInput,
  type SceneDefinitionSaveProgress
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import { deleteSceneDefinitionInputDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredDefinitionSchema,
  sceneStoredInitialStateSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internal } from '../_generated/api'
import { type MutationCtx } from '../_generated/server'
import { internalMutation, mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { assertCampaignContentAllowed } from '../campaigns/contentUsage'
import {
  refreshMapReferenceFlag,
  requireSceneMap,
  scheduleDetachedMapCleanup
} from '../media/vttMapDocuments'

const SAVE_WINDOW = 24 * 60 * 60_000

function lower(id: string) {
  return id.toLowerCase()
}

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

function progress(
  save: ReturnType<typeof sceneStoredDefinitionSaveSchema.parse>
): SceneDefinitionSaveProgress {
  return sceneDefinitionSaveProgressSchema.parse({
    saveId: save.id,
    sceneId: save.definitionId,
    version: (save.expectedVersion ?? 0) + 1,
    status: save.status,
    counts: save.counts,
    received: save.received,
    liveSceneId: save.liveSceneId
  })
}

async function ownedSave(ctx: MutationCtx, saveId: string, userId: string) {
  const row = await ctx.db
    .query('sceneDefinitionSaves')
    .withIndex('by_publicId', (q) => q.eq('id', lower(saveId)))
    .unique()
  if (!row || row.ownerUserId !== userId) throw new Error('Scene definition save is unavailable.')
  return { row, save: sceneStoredDefinitionSaveSchema.parse(stored(row)) }
}

async function writableCampaign(ctx: MutationCtx, campaignId: string) {
  const { userId } = await requireIdentity(ctx)
  const { campaign, membership } = await requireCampaignAuthority(ctx, lower(campaignId), userId)
  if (membership.role !== 'OWNER') throw new Error('Only the Campaign owner can author Scenes.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  return { campaign, userId }
}

async function currentDefinition(ctx: MutationCtx, campaignId: string, sceneId: string) {
  const row = await ctx.db
    .query('sceneDefinitions')
    .withIndex('by_publicId', (q) => q.eq('id', lower(sceneId)))
    .unique()
  if (!row || row.campaignId !== campaignId) throw new Error('Scene definition is unavailable.')
  return { row, definition: sceneStoredDefinitionSchema.parse(stored(row)) }
}

function normalizedBegin(input: BeginSceneDefinitionInput): BeginSceneDefinitionInput {
  return {
    ...input,
    commandId: lower(input.commandId),
    sceneId: input.sceneId === null ? null : lower(input.sceneId),
    settings: {
      ...input.settings,
      campaignId: lower(input.settings.campaignId),
      map: {
        ...input.settings.map,
        assetId: lower(input.settings.map.assetId)
      }
    }
  }
}

function replayMatches(
  save: ReturnType<typeof sceneStoredDefinitionSaveSchema.parse>,
  input: BeginSceneDefinitionInput
) {
  return save.commandFingerprint === checksumCanonicalJson(input)
}

export const begin = mutation({
  args: zodToConvexFields(beginSceneDefinitionInputSchema.shape),
  returns: zodToConvex(sceneDefinitionSaveProgressSchema),
  handler: async (ctx, args): Promise<SceneDefinitionSaveProgress> => {
    const input = normalizedBegin(beginSceneDefinitionInputSchema.parse(args))
    const { campaign, userId } = await writableCampaign(ctx, input.settings.campaignId)
    if (campaign.id !== input.settings.campaignId) throw new Error('Campaign identity mismatch.')
    const prior = await ctx.db
      .query('sceneDefinitionSaves')
      .withIndex('by_ownerUserId_commandId', (q) =>
        q.eq('ownerUserId', userId).eq('commandId', input.commandId)
      )
      .unique()
    if (prior) {
      const save = sceneStoredDefinitionSaveSchema.parse(stored(prior))
      if (!replayMatches(save, input)) throw new Error('Scene definition command was already used.')
      if (save.status === 'PUBLISHED') return progress(save)
      if (save.status === 'EXPIRED' || save.expiresAt <= Date.now())
        throw new Error('Scene definition save expired.')
      return progress(save)
    }
    if (input.sceneId === null)
      await assertCampaignContentAllowed(ctx.db, campaign, 'scenesPerCampaign')
    else {
      const { definition } = await currentDefinition(ctx, campaign.id, input.sceneId)
      if (definition.version !== input.expectedVersion)
        throw new Error('Scene definition changed before this save began.')
    }
    await requireSceneMap(ctx, campaign.id, input.settings.map, userId)
    const now = new Date().toISOString()
    const expiresAt = Date.now() + SAVE_WINDOW
    const save = sceneStoredDefinitionSaveSchema.parse({
      id: crypto.randomUUID(),
      commandId: input.commandId,
      commandFingerprint: checksumCanonicalJson(input),
      ownerUserId: userId,
      definitionId: input.sceneId ?? crypto.randomUUID(),
      expectedVersion: input.expectedVersion,
      settings: input.settings,
      counts: input.counts,
      received: {
        annotations: 0,
        barriers: 0,
        darknessZones: 0,
        lights: 0,
        tokens: 0
      },
      status: 'RECEIVING',
      liveSceneId: input.sceneId === null ? crypto.randomUUID() : null,
      entitiesRemoved: false,
      createdAt: now,
      expiresAt
    })
    await ctx.db.insert('sceneDefinitionSaves', save)
    await ctx.scheduler.runAt(expiresAt, internal.scenes.definitions.cleanup, {
      saveId: save.id
    })
    return progress(save)
  }
})

async function exactBatchReplay(
  ctx: MutationCtx,
  saveId: string,
  input: AppendSceneDefinitionInput
) {
  const rows = await ctx.db
    .query('sceneDefinitionEntities')
    .withIndex('by_saveId_collection_ordinal', (q) =>
      q
        .eq('saveId', saveId)
        .eq('value.collection', input.collection)
        .gte('ordinal', input.offset)
        .lt('ordinal', input.offset + input.entities.length)
    )
    .take(9)
  if (rows.length !== input.entities.length) return false
  return rows.every((row, index) => {
    const value = {
      collection: input.collection,
      entity: input.entities[index]!
    }
    return (
      row.ordinal === input.offset + index &&
      row.entityId === input.entities[index]!.id &&
      row.checksum === checksumCanonicalJson(value) &&
      checksumCanonicalJson(row.value) === row.checksum
    )
  })
}

export const append = mutation({
  args: { input: zodToConvex(appendSceneDefinitionInputSchema) },
  returns: zodToConvex(sceneDefinitionSaveProgressSchema),
  handler: async (ctx, args): Promise<SceneDefinitionSaveProgress> => {
    const parsed = appendSceneDefinitionInputSchema.parse(args.input)
    const input = { ...parsed, saveId: lower(parsed.saveId) }
    const { row, save } = await ownedSave(ctx, input.saveId, (await requireIdentity(ctx)).userId)
    await writableCampaign(ctx, save.settings.campaignId)
    if (
      save.status === 'EXPIRED' ||
      save.entitiesRemoved ||
      (save.status === 'RECEIVING' && save.expiresAt <= Date.now())
    )
      throw new Error('Scene definition save expired.')
    const exactReplay = await exactBatchReplay(ctx, save.id, input)
    if (save.status === 'PUBLISHED') {
      if (!exactReplay) throw new Error('Published Scene definition batches cannot change.')
      return progress(save)
    }
    if (input.offset < save.received[input.collection]) {
      if (!exactReplay) throw new Error('Scene definition batch replay does not match.')
      return progress(save)
    }
    if (
      input.offset !== save.received[input.collection] ||
      input.offset + input.entities.length > save.counts[input.collection]
    )
      throw new Error('Scene definition batch offset is invalid.')
    if (new Set(input.entities.map((entity) => entity.id)).size !== input.entities.length)
      throw new Error('Scene definition batch entity IDs must be unique.')
    for (const entity of input.entities) {
      const existing = await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId_collection_entityId', (q) =>
          q.eq('saveId', save.id).eq('value.collection', input.collection).eq('entityId', entity.id)
        )
        .unique()
      if (existing) throw new Error('Scene definition entity ID already exists in this collection.')
    }
    const rows = input.entities.map((entity, index) =>
      sceneStoredDefinitionEntitySchema.parse({
        saveId: save.id,
        entityId: entity.id,
        ordinal: input.offset + index,
        value: { collection: input.collection, entity },
        checksum: checksumCanonicalJson({
          collection: input.collection,
          entity
        })
      })
    )
    for (const entity of rows) await ctx.db.insert('sceneDefinitionEntities', entity)
    const received = {
      ...save.received,
      [input.collection]: save.received[input.collection] + rows.length
    }
    await ctx.db.patch(row._id, { received })
    return progress({ ...save, received })
  }
})

export const publish = mutation({
  args: zodToConvexFields(sceneDefinitionSaveLookupSchema.shape),
  returns: zodToConvex(sceneDefinitionSaveProgressSchema),
  handler: async (ctx, args): Promise<SceneDefinitionSaveProgress> => {
    const input = sceneDefinitionSaveLookupSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { row, save } = await ownedSave(ctx, lower(input.saveId), userId)
    const { campaign } = await writableCampaign(ctx, save.settings.campaignId)
    if (save.status === 'PUBLISHED') return progress(save)
    if (save.status !== 'RECEIVING' || save.entitiesRemoved || save.expiresAt <= Date.now())
      throw new Error('Scene definition save expired.')
    if (
      save.received.annotations !== save.counts.annotations ||
      save.received.barriers !== save.counts.barriers ||
      save.received.darknessZones !== save.counts.darknessZones ||
      save.received.lights !== save.counts.lights ||
      save.received.tokens !== save.counts.tokens
    )
      throw new Error('Scene definition is incomplete.')
    await requireSceneMap(ctx, campaign.id, save.settings.map, userId)
    const existing = await ctx.db
      .query('sceneDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', save.definitionId))
      .unique()
    if (save.expectedVersion === null) {
      if (existing) throw new Error('Scene definition already exists.')
      await assertCampaignContentAllowed(ctx.db, campaign, 'scenesPerCampaign')
    } else {
      if (
        !existing ||
        existing.campaignId !== campaign.id ||
        existing.version !== save.expectedVersion
      )
        throw new Error('Scene definition changed before publication.')
    }
    const now = new Date().toISOString()
    const definition = sceneStoredDefinitionSchema.parse({
      ...save.settings,
      id: save.definitionId,
      saveId: save.id,
      version: (save.expectedVersion ?? 0) + 1,
      counts: save.counts,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    })
    if (existing) await ctx.db.replace(existing._id, definition)
    else await ctx.db.insert('sceneDefinitions', definition)
    if (save.liveSceneId !== null) {
      await ctx.db.insert(
        'campaignScenes',
        sceneStoredInitialStateSchema.parse({
          ...save.settings,
          id: save.liveSceneId,
          definitionId: save.definitionId,
          definitionVersion: definition.version,
          definitionSaveId: save.id,
          version: 0,
          materializationCommandId: save.commandId,
          materializationCommandFingerprint: checksumCanonicalJson({
            definitionId: save.definitionId,
            kind: 'DEFAULT_CAMPAIGN_LIVE_SCENE'
          }),
          createdAt: now,
          updatedAt: now
        })
      )
    }
    await ctx.db.patch(row._id, { status: 'PUBLISHED' })
    if (existing)
      await ctx.scheduler.runAfter(0, internal.scenes.definitions.cleanup, {
        saveId: existing.saveId
      })
    if (existing && existing.map.assetId !== definition.map.assetId)
      await scheduleDetachedMapCleanup(ctx, existing.map.assetId)
    await refreshMapReferenceFlag(ctx, definition.map.assetId)
    if (existing && existing.map.assetId !== definition.map.assetId)
      await refreshMapReferenceFlag(ctx, existing.map.assetId)
    return progress({ ...save, status: 'PUBLISHED' })
  }
})

export const remove = mutation({
  args: zodToConvexFields(deleteSceneDefinitionInputDtoSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = deleteSceneDefinitionInputDtoSchema.parse(args)
    const { campaign } = await writableCampaign(ctx, lower(input.campaignId))
    const { row, definition } = await currentDefinition(ctx, campaign.id, lower(input.sceneId))
    if (definition.version !== input.expectedVersion)
      throw new Error('Scene definition changed before deletion.')
    await ctx.db.delete(row._id)
    const loot = await ctx.db
      .query('sceneLootTables')
      .withIndex('by_sceneId', (q) => q.eq('sceneId', definition.id))
      .unique()
    if (loot) await ctx.db.delete(loot._id)
    // D87: a Scene shown to players stops being shown when its definition is deleted.
    const showing = await ctx.db
      .query('campaignSceneShowings')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
    const shownScene =
      showing &&
      (await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', showing.sceneId))
        .unique())
    if (showing && shownScene?.definitionId === definition.id) await ctx.db.delete(showing._id)
    await refreshMapReferenceFlag(ctx, definition.map.assetId)
    await ctx.scheduler.runAfter(0, internal.scenes.definitions.cleanup, {
      saveId: definition.saveId
    })
    await scheduleDetachedMapCleanup(ctx, definition.map.assetId)
    return null
  }
})

export const cleanup = internalMutation({
  args: { saveId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('sceneDefinitionSaves')
      .withIndex('by_publicId', (q) => q.eq('id', lower(args.saveId)))
      .unique()
    if (!row) return null
    const save = sceneStoredDefinitionSaveSchema.parse(stored(row))
    if (save.status === 'RECEIVING' && save.expiresAt > Date.now()) {
      await ctx.scheduler.runAt(save.expiresAt, internal.scenes.definitions.cleanup, {
        saveId: save.id
      })
      return null
    }
    const [definition, liveScene] = await Promise.all([
      ctx.db
        .query('sceneDefinitions')
        .withIndex('by_saveId', (q) => q.eq('saveId', save.id))
        .first(),
      ctx.db
        .query('campaignScenes')
        .withIndex('by_definitionSaveId', (q) => q.eq('definitionSaveId', save.id))
        .first()
    ])
    if (definition || liveScene) return null
    if (save.status === 'RECEIVING') await ctx.db.patch(row._id, { status: 'EXPIRED' })
    const entities = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId', (q) => q.eq('saveId', save.id))
      .take(32)
    for (const entity of entities) await ctx.db.delete(entity._id)
    if (entities.length === 32) {
      await ctx.scheduler.runAfter(0, internal.scenes.definitions.cleanup, {
        saveId: save.id
      })
    } else if (!save.entitiesRemoved) {
      await ctx.db.patch(row._id, { entitiesRemoved: true })
    }
    return null
  }
})
