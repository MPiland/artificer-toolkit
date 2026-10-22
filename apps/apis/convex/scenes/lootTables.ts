import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  saveSceneLootInputSchema,
  sceneLootDocumentSchema,
  sceneLootLookupInputSchema,
  type SceneLootDocument,
  type SceneLootTable
} from '@artificer-toolkit/schema/api/sceneLootTables'
import { sceneStoredLootSchema } from '@artificer-toolkit/schema/projections/sceneLootPersistence'
import type { QueryCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { canReadAuthoredRoot } from '../content/documents'
import { readRootCatalogue } from '../content/catalogueMetadata'
import { requireSystem } from '../content/systemDocuments'

function lower(id: string) {
  return id.toLowerCase()
}

/** Loot tables are GM reference data: only the Campaign owner reads or writes them. */
async function requireSceneOwner(ctx: QueryCtx, campaignId: string, sceneId: string) {
  const { userId } = await requireIdentity(ctx)
  const { campaign, membership } = await requireCampaignAuthority(ctx, lower(campaignId), userId)
  if (membership.role !== 'OWNER')
    throw new Error('Scene loot tables are only available to the Campaign owner.')
  const definition = await ctx.db
    .query('sceneDefinitions')
    .withIndex('by_publicId', (q) => q.eq('id', lower(sceneId)))
    .unique()
  if (!definition || definition.campaignId !== campaign.id)
    throw new Error('Scene definition is unavailable.')
  return { campaign, userId, sceneId: definition.id }
}

async function storedLoot(ctx: QueryCtx, sceneId: string) {
  return ctx.db
    .query('sceneLootTables')
    .withIndex('by_sceneId', (q) => q.eq('sceneId', sceneId))
    .unique()
}

/** Every reference must name something this Campaign's System and the owner's catalogue offer. */
async function requireLootReferences(
  ctx: QueryCtx,
  campaign: { gameSystemId: string },
  userId: string,
  tables: readonly SceneLootTable[]
) {
  const system = await requireSystem(ctx, campaign.gameSystemId)
  const skillIds = new Set(system.skills.map((skill) => skill.id))
  const denominationIds = new Set(system.currencies.map((currency) => currency.id))
  const itemIds = new Set<string>()
  for (const table of tables) {
    if (table.skillId !== undefined && !skillIds.has(table.skillId))
      throw new Error(`Loot table "${table.name}" names a check this System does not define.`)
    for (const range of table.ranges)
      for (const entry of range.entries) {
        if (entry.kind === 'ITEM') itemIds.add(entry.itemId)
        else if (!denominationIds.has(entry.denominationId))
          throw new Error(`Loot table "${table.name}" names a coin this System does not define.`)
      }
  }
  for (const itemId of itemIds) {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', itemId))
      .unique()
    if (
      !root ||
      root.subjectKind !== 'EQUIPMENT' ||
      root.systemId !== campaign.gameSystemId ||
      !(await canReadAuthoredRoot(ctx, root, userId)) ||
      !readRootCatalogue(root).publishedActive
    )
      throw new Error('A loot entry names an item that is unavailable.')
  }
}

export const get = query({
  args: zodToConvexFields(sceneLootLookupInputSchema.shape),
  returns: zodToConvex(sceneLootDocumentSchema),
  handler: async (ctx, args): Promise<SceneLootDocument> => {
    const input = sceneLootLookupInputSchema.parse(args)
    const { campaign, sceneId } = await requireSceneOwner(ctx, input.campaignId, input.sceneId)
    const row = await storedLoot(ctx, sceneId)
    if (!row) return { campaignId: campaign.id, sceneId, version: 0, tables: [] }
    const { _id, _creationTime, updatedAt: _updatedAt, ...document } = row
    return sceneLootDocumentSchema.parse(document)
  }
})

export const save = mutation({
  args: zodToConvexFields(saveSceneLootInputSchema.shape),
  returns: zodToConvex(sceneLootDocumentSchema),
  handler: async (ctx, args): Promise<SceneLootDocument> => {
    const input = saveSceneLootInputSchema.parse(args)
    const { campaign, userId, sceneId } = await requireSceneOwner(
      ctx,
      input.campaignId,
      input.sceneId
    )
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const row = await storedLoot(ctx, sceneId)
    if ((row?.version ?? 0) !== input.expectedVersion)
      throw new Error('Scene loot tables changed before this save.')
    await requireLootReferences(ctx, campaign, userId, input.tables)
    const document = sceneStoredLootSchema.parse({
      campaignId: campaign.id,
      sceneId,
      version: input.expectedVersion + 1,
      tables: input.tables,
      updatedAt: new Date().toISOString()
    })
    if (row) await ctx.db.replace(row._id, document)
    else await ctx.db.insert('sceneLootTables', document)
    const { updatedAt: _updatedAt, ...saved } = document
    return sceneLootDocumentSchema.parse(saved)
  }
})
