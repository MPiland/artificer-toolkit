import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredDraftLookupInputSchema,
  authoredDraftListInputSchema,
  authoredDraftListPageSchema,
  authoredDraftSummaryDtoSchema,
  authoredDraftDtoSchema,
  type AuthoredDraftListPage,
  type AuthoredDraftResult
} from '@artificer-toolkit/schema/api/authoredDrafts'
import { internalQuery } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { isImportRowVisible } from '../imports/visibility'
import { readDraft } from './documents'
import { contentStream } from './streams'

export const list = internalQuery({
  args: zodToConvexFields(authoredDraftListInputSchema.shape),
  returns: zodToConvex(authoredDraftListPageSchema),
  handler: async (ctx, args): Promise<AuthoredDraftListPage> => {
    const { userId } = await requireIdentity(ctx)
    const input = authoredDraftListInputSchema.parse(args)
    const result = await contentStream(ctx.db)
      .query('authoredDrafts')
      .withIndex('by_userId_subjectKind', (query) =>
        query.eq('userId', userId).eq('subjectKind', input.subjectKind)
      )
      .order('desc')
      .filterWith(async (draft) => isImportRowVisible(ctx, draft.importJobId))
      .map(async (draft) => authoredDraftSummaryDtoSchema.parse(draft))
      .paginate({
        ...input.paginationOpts,
        maximumRowsRead: 48,
        maximumBytesRead: 1024 * 1024
      })
    return authoredDraftListPageSchema.parse(result)
  }
})

export const get = internalQuery({
  args: zodToConvexFields(authoredDraftLookupInputSchema.shape),
  returns: zodToConvex(zMini.nullable(authoredDraftDtoSchema)),
  handler: async (ctx, args): Promise<AuthoredDraftResult | null> => {
    const { userId } = await requireIdentity(ctx)
    const { subjectId, subjectKind } = authoredDraftLookupInputSchema.parse(args)
    const draft = await ctx.db
      .query('authoredDrafts')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', subjectId))
      .unique()
    if (
      !draft ||
      draft.userId !== userId ||
      draft.subjectKind !== subjectKind ||
      !(await isImportRowVisible(ctx, draft.importJobId))
    )
      return null
    return readDraft(ctx, draft)
  }
})
