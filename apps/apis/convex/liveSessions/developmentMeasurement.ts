import { v, type Validator } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { z } from 'zod'
import {
  developmentDocumentSizesInputSchema,
  developmentDocumentSizesPageSchema,
  type DevelopmentDocumentSizesPage
} from '@artificer-toolkit/schema/api/developmentCheckpoint'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { requireIdentity } from '../lib/identity'
import { mutation } from '../lib/mutations'
import { query } from '../lib/queries'
import { PAGE, RUN_TABLES, type RunTableQuery } from './roomInputs'

/**
 * Development only, for the V15 load proof (`scripts/v15Budgets.mjs`). A marker is a mutation that
 * does nothing, so the native Convex log shows where the measured window opens and closes.
 */
const windowMarker = () =>
  mutation({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
      const { userId } = await requireIdentity(ctx)
      await requireFixtureAccount(ctx, userId)
      return null
    }
  })
export const openWindow = windowMarker()
export const closeWindow = windowMarker()

/** The documents a combat checkpoint writes, in the order the size read walks them. */
const sizedTables: ReadonlyArray<{ table: string; query: RunTableQuery }> = [
  {
    table: 'encounterRuns',
    query: (ctx, encounterId) =>
      ctx.db.query('encounterRuns').withIndex('by_publicId', (q) => q.eq('id', encounterId))
  },
  ...RUN_TABLES,
  {
    table: 'sceneLiveStates',
    query: (ctx, sceneId) =>
      ctx.db.query('sceneLiveStates').withIndex('by_sceneId', (q) => q.eq('sceneId', sceneId))
  },
  {
    table: 'sceneLiveEntities',
    query: (ctx, sceneId) =>
      ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_entityId', (q) => q.eq('sceneId', sceneId))
  },
  {
    table: 'sceneFogLayers',
    query: (ctx, sceneId) =>
      ctx.db
        .query('sceneFogLayers')
        .withIndex('by_sceneId_ordinal', (q) => q.eq('sceneId', sceneId))
  }
]
const firstSceneTable = sizedTables.findIndex(({ table }) => table === 'sceneLiveStates')
const utf8 = new TextEncoder()

/** One page of one table's document sizes; the caller follows `next` until it is null. */
export const checkpointDocumentSizes = query({
  args: zodToConvexFields(developmentDocumentSizesInputSchema.shape),
  get returns(): Validator<DevelopmentDocumentSizesPage, 'required', string> {
    return zodToConvex<z.core.$ZodType<DevelopmentDocumentSizesPage>>(
      developmentDocumentSizesPageSchema
    )
  },
  handler: async (ctx, args): Promise<DevelopmentDocumentSizesPage> => {
    const input = developmentDocumentSizesInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    await requireFixtureAccount(ctx, userId)
    const entry = sizedTables[input.position]
    if (!entry) throw new Error('Document size cursor is invalid.')
    const subjectId = input.position < firstSceneTable ? input.encounterId : input.sceneId
    const page = await entry.query(ctx, subjectId).paginate({ ...PAGE, cursor: input.cursor })
    if (!page.isDone && page.continueCursor === input.cursor)
      throw new Error('Document size page cannot advance.')
    const sizes = page.page.map((row) => utf8.encode(JSON.stringify(row)).byteLength)
    const nextPosition = input.position + 1
    return developmentDocumentSizesPageSchema.parse({
      table: entry.table,
      documents: sizes.length,
      totalBytes: sizes.reduce((total, size) => total + size, 0),
      maxBytes: Math.max(0, ...sizes),
      next: !page.isDone
        ? { position: input.position, cursor: page.continueCursor }
        : nextPosition < sizedTables.length
          ? { position: nextPosition, cursor: null }
          : null
    })
  }
})
