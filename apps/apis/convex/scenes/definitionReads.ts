import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignLiveSceneListPageSchema,
  sceneDefinitionEntityPageInputSchema,
  sceneDefinitionEntityPageSchema,
  sceneDefinitionHeaderSchema,
  sceneDefinitionListInputSchema,
  sceneDefinitionListPageSchema,
  type SceneDefinitionEntityPage,
  type SceneDefinitionListPage
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import { getSceneDefinitionInputDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readLiveScene } from './liveDocuments'

function lower(id: string) {
  return id.toLowerCase()
}

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

async function ownedCampaign(
  ctx: Parameters<typeof requireCampaignAuthority>[0],
  campaignId: string
) {
  const { userId } = await requireIdentity(ctx)
  const { campaign, membership } = await requireCampaignAuthority(ctx, lower(campaignId), userId)
  if (membership.role !== 'OWNER')
    throw new Error('Scene definitions are only available to the Campaign owner.')
  return campaign
}

export const get = query({
  args: zodToConvexFields(getSceneDefinitionInputDtoSchema.shape),
  returns: zodToConvex(sceneDefinitionHeaderSchema),
  handler: async (ctx, args) => {
    const input = getSceneDefinitionInputDtoSchema.parse(args)
    const campaign = await ownedCampaign(ctx, input.campaignId)
    const row = await ctx.db
      .query('sceneDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', lower(input.sceneId)))
      .unique()
    if (!row || row.campaignId !== campaign.id) throw new Error('Scene definition is unavailable.')
    return sceneDefinitionHeaderSchema.parse(sceneStoredDefinitionSchema.parse(stored(row)))
  }
})

export const list = query({
  args: zodToConvexFields(sceneDefinitionListInputSchema.shape),
  returns: zodToConvex(sceneDefinitionListPageSchema),
  handler: async (ctx, args): Promise<SceneDefinitionListPage> => {
    const input = sceneDefinitionListInputSchema.parse(args)
    const campaign = await ownedCampaign(ctx, input.campaignId)
    const result = await ctx.db
      .query('sceneDefinitions')
      .withIndex('by_campaignId_updatedAt_id', (q) => q.eq('campaignId', campaign.id))
      .order('desc')
      .paginate({ ...input.paginationOpts, maximumRowsRead: 8, maximumBytesRead: 512 * 1024 })
    return sceneDefinitionListPageSchema.parse({
      ...result,
      page: result.page.map((row) =>
        sceneDefinitionHeaderSchema.parse(sceneStoredDefinitionSchema.parse(stored(row)))
      )
    })
  }
})

export const listLive = query({
  args: zodToConvexFields(sceneDefinitionListInputSchema.shape),
  returns: zodToConvex(campaignLiveSceneListPageSchema),
  handler: async (ctx, args) => {
    const input = sceneDefinitionListInputSchema.parse(args)
    const campaign = await ownedCampaign(ctx, input.campaignId)
    const result = await ctx.db
      .query('campaignScenes')
      .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaign.id))
      .paginate({ ...input.paginationOpts, maximumRowsRead: 8, maximumBytesRead: 512 * 1024 })
    return campaignLiveSceneListPageSchema.parse({
      ...result,
      page: await Promise.all(
        result.page.map(async (row) => {
          const { header } = await readLiveScene(ctx, row.id, 'OWNER')
          return {
            id: header.id,
            definitionId: header.definitionId,
            name: header.name,
            version: header.version
          }
        })
      )
    })
  }
})

export const entities = query({
  args: zodToConvexFields(sceneDefinitionEntityPageInputSchema.shape),
  returns: zodToConvex(sceneDefinitionEntityPageSchema),
  handler: async (ctx, args): Promise<SceneDefinitionEntityPage> => {
    const input = sceneDefinitionEntityPageInputSchema.parse(args)
    const campaign = await ownedCampaign(ctx, input.campaignId)
    const definition = await ctx.db
      .query('sceneDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', lower(input.sceneId)))
      .unique()
    if (
      !definition ||
      definition.campaignId !== campaign.id ||
      definition.saveId !== lower(input.saveId)
    )
      throw new Error('Scene definition version is unavailable.')
    const result = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q.eq('saveId', definition.saveId).eq('value.collection', input.collection)
      )
      .paginate({ ...input.paginationOpts, maximumRowsRead: 8, maximumBytesRead: 512 * 1024 })
    return sceneDefinitionEntityPageSchema.parse({
      ...result,
      page: result.page.map((row) => {
        const entity = sceneStoredDefinitionEntitySchema.parse(stored(row))
        if (
          entity.saveId !== definition.saveId ||
          entity.value.collection !== input.collection ||
          entity.entityId !== entity.value.entity.id ||
          entity.checksum !== checksumCanonicalJson(entity.value)
        )
          throw new Error('Stored Scene definition entity is inconsistent.')
        return { ordinal: entity.ordinal, value: entity.value }
      })
    })
  }
})
