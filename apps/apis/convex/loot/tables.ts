import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  saveLootInputSchema,
  lootDocumentSchema,
  lootLookupInputSchema,
  liveLootInputSchema,
  liveLootSchema,
  type LiveLoot,
  type LootDocument,
  type LootOwner,
  type LootTable
} from '@artificer-toolkit/schema/api/lootTables'
import { storedLootSchema } from '@artificer-toolkit/schema/projections/lootPersistence'
import type { QueryCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { canReadAuthoredRoot } from '../content/documents'
import { readRootCatalogue } from '../content/catalogueMetadata'
import { requireSystem } from '../content/systemDocuments'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/api/encounterData'
import { findLootRow } from './ownerRows'

function lower(id: string) {
  return id.toLowerCase()
}

/** Loot tables are GM reference data: only the Campaign owner reads or writes them. */
async function requireCampaignOwner(ctx: QueryCtx, campaignId: string) {
  const { userId } = await requireIdentity(ctx)
  const { campaign, membership } = await requireCampaignAuthority(ctx, lower(campaignId), userId)
  if (membership.role !== 'OWNER')
    throw new Error('Loot tables are only available to the Campaign owner.')
  return { campaign, userId }
}

async function requireLootOwner(ctx: QueryCtx, owner: LootOwner) {
  const { campaign, userId } = await requireCampaignOwner(ctx, owner.campaignId)
  if (owner.kind === 'SCENE') {
    const definition = await ctx.db
      .query('sceneDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', lower(owner.sceneDefinitionId)))
      .unique()
    if (!definition || definition.campaignId !== campaign.id)
      throw new Error('Scene definition is unavailable.')
    return {
      campaign,
      userId,
      owner: { kind: 'SCENE', campaignId: campaign.id, sceneDefinitionId: definition.id } as const
    }
  }
  const encounter = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', lower(owner.encounterId)))
    .unique()
  if (!encounter || encounter.campaignId !== campaign.id)
    throw new Error('Encounter is unavailable.')
  const actor = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) =>
      q.eq('encounterId', encounter.id).eq('id', lower(owner.actorId))
    )
    .unique()
  if (!actor || readStoredRunActor(actor).kind === 'CHARACTER')
    throw new Error('Encounter creature is unavailable.')
  return {
    campaign,
    userId,
    owner: {
      kind: 'ENCOUNTER_ACTOR',
      campaignId: campaign.id,
      encounterId: encounter.id,
      actorId: actor.id
    } as const
  }
}

/** Every reference must name something this Campaign's System and the owner's catalogue offer. */
async function requireLootReferences(
  ctx: QueryCtx,
  campaign: { gameSystemId: string },
  userId: string,
  tables: readonly LootTable[]
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
  args: zodToConvexFields(lootLookupInputSchema.shape),
  returns: zodToConvex(lootDocumentSchema),
  handler: async (ctx, args): Promise<LootDocument> => {
    const input = lootLookupInputSchema.parse(args)
    const { owner } = await requireLootOwner(ctx, input.owner)
    const row = await findLootRow(ctx, owner)
    if (!row) return { owner, version: 0, tables: [] }
    const { _id, _creationTime, updatedAt: _updatedAt, ...document } = row
    return lootDocumentSchema.parse(document)
  }
})

/** Every table the live Loot panel lists, in one read: the Scene's and each Encounter creature's. */
export const live = query({
  args: zodToConvexFields(liveLootInputSchema.shape),
  returns: zodToConvex(liveLootSchema),
  handler: async (ctx, args): Promise<LiveLoot> => {
    const input = liveLootInputSchema.parse(args)
    const { campaign } = await requireCampaignOwner(ctx, input.campaignId)
    const scene = await findLootRow(ctx, {
      kind: 'SCENE',
      campaignId: campaign.id,
      sceneDefinitionId: lower(input.sceneDefinitionId)
    })
    const { encounterId } = input
    const creatures = encounterId
      ? await ctx.db
          .query('lootTables')
          .withIndex('by_actor', (q) =>
            q.eq('owner.kind', 'ENCOUNTER_ACTOR').eq('owner.encounterId', lower(encounterId))
          )
          .take(MAX_ENCOUNTER_ACTORS)
      : []
    const documents = [...(scene ? [scene] : []), ...creatures]
      .filter((row) => row.owner.campaignId === campaign.id && row.tables.length > 0)
      .map(({ _id, _creationTime, updatedAt: _updatedAt, ...document }) => document)
    return liveLootSchema.parse({ documents })
  }
})

export const save = mutation({
  args: zodToConvexFields(saveLootInputSchema.shape),
  returns: zodToConvex(lootDocumentSchema),
  handler: async (ctx, args): Promise<LootDocument> => {
    const input = saveLootInputSchema.parse(args)
    const { campaign, userId, owner } = await requireLootOwner(ctx, input.owner)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const row = await findLootRow(ctx, owner)
    if ((row?.version ?? 0) !== input.expectedVersion)
      throw new Error('Loot tables changed before this save.')
    await requireLootReferences(ctx, campaign, userId, input.tables)
    const document = storedLootSchema.parse({
      owner,
      version: input.expectedVersion + 1,
      tables: input.tables,
      updatedAt: new Date().toISOString()
    })
    if (row) await ctx.db.replace(row._id, document)
    else await ctx.db.insert('lootTables', document)
    const { updatedAt: _updatedAt, ...saved } = document
    return lootDocumentSchema.parse(saved)
  }
})
