import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  rulesCatalogueListItemDtoSchema,
  systemListPageDtoSchema,
  systemListPageInputDtoSchema,
  systemListItemDtoSchema,
  systemLookupInputDtoSchema,
  systemResponseDtoSchema,
  type SystemListPageDto,
  type SystemListItemDto,
  type SystemResponseDto
} from '@artificer-toolkit/schema/api/systems'
import { gameSystemRuleCapabilityDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { findInstalledGameSystemRuleCapability } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { Doc } from '../_generated/dataModel'
import { query, type QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { readSystem } from './systemDocuments'

export const capability = query({
  args: zodToConvexFields(systemLookupInputDtoSchema.shape),
  returns: zodToConvex(zMini.nullable(gameSystemRuleCapabilityDtoSchema)),
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    const { id } = systemLookupInputDtoSchema.parse(args)
    return findInstalledGameSystemRuleCapability(id)
  }
})

async function readSystemSummary(
  ctx: QueryCtx,
  record: Doc<'systems'>
): Promise<SystemListItemDto> {
  const document = readSystem(record)
  // ponytail: platform catalogues/sources are bounded at 100 per System; add
  // catalogue pagination before exceeding this, never silently truncate.
  const catalogues = await ctx.db
    .query('rulesCatalogues')
    .withIndex('by_gameSystemId', (q) => q.eq('gameSystemId', record.id))
    .take(101)
  if (catalogues.length > 100) throw new Error('System catalogue limit exceeded.')
  const sourceIds = new Set<string>()
  for (const catalogue of catalogues) {
    if (
      catalogue.contentSourceIds.length === 0 ||
      catalogue.contentSourceIds.length > 100 ||
      new Set(catalogue.contentSourceIds).size !== catalogue.contentSourceIds.length
    ) {
      throw new Error('Invalid catalogue content sources.')
    }
    for (const id of catalogue.contentSourceIds) sourceIds.add(id)
  }
  if (sourceIds.size > 100) throw new Error('System content source limit exceeded.')
  await Promise.all(
    [...sourceIds].map(async (sourceId) => {
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', sourceId))
        .unique()
      if (
        !source ||
        source.gameSystemId !== record.id ||
        source.kind !== 'PLATFORM' ||
        source.ownerUserId !== null
      ) {
        throw new Error('Invalid catalogue content source binding.')
      }
    })
  )
  const rulesCatalogues = catalogues.map((catalogue) =>
    rulesCatalogueListItemDtoSchema.parse({
      id: catalogue.id,
      label: catalogue.label,
      description: catalogue.description
    })
  )
  rulesCatalogues.sort((left, right) =>
    left.label === right.label
      ? left.id.localeCompare(right.id)
      : left.label.localeCompare(right.label)
  )
  return systemListItemDtoSchema.parse({
    id: document.id,
    label: document.label,
    description: document.description ?? null,
    rulesetCode: document.rulesetCode,
    rulesetVersion: document.rulesetVersion,
    userId: document.userId,
    rulesCatalogues
  })
}

// This table contains only server-imported platform Systems. User-authored
// Systems are deferred; no user-controlled document is admitted by these reads.
export const get = query({
  args: zodToConvexFields(systemLookupInputDtoSchema.shape),
  returns: zodToConvex(systemResponseDtoSchema),
  handler: async (ctx, args): Promise<SystemResponseDto> => {
    const { id } = systemLookupInputDtoSchema.parse(args)
    const record = await ctx.db
      .query('systems')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
    return record ? readSystem(record) : null
  }
})

export const summary = query({
  args: zodToConvexFields(systemLookupInputDtoSchema.shape),
  returns: zodToConvex(zMini.nullable(systemListItemDtoSchema)),
  handler: async (ctx, args): Promise<SystemListItemDto | null> => {
    const { id } = systemLookupInputDtoSchema.parse(args)
    const record = await ctx.db
      .query('systems')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
    return record ? await readSystemSummary(ctx, record) : null
  }
})

export const list = query({
  args: zodToConvexFields(systemListPageInputDtoSchema.shape),
  returns: zodToConvex(systemListPageDtoSchema),
  handler: async (ctx, args): Promise<SystemListPageDto> => {
    const input = systemListPageInputDtoSchema.parse(args)
    const result = await ctx.db
      .query('systems')
      .withIndex('by_publicId')
      .paginate({ cursor: input.cursor, numItems: input.limit })
    const page = await Promise.all(result.page.map((record) => readSystemSummary(ctx, record)))
    return systemListPageDtoSchema.parse({
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor
    })
  }
})
