import * as zMini from 'zod/mini'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredDraftCommandInputSchema,
  authoredDraftLookupInputSchema,
  authoredDraftListInputSchema,
  authoredDraftListPageSchema,
  authoredDraftDtoSchema
} from '@artificer-toolkit/schema/api/authoredDrafts'
import { query } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { internal } from '../_generated/api'

export const list = query({
  args: zodToConvexFields(authoredDraftListInputSchema.shape),
  returns: zodToConvex(authoredDraftListPageSchema),
  handler: (ctx, args) =>
    ctx.runQuery(internal.content.draftPages.list, authoredDraftListInputSchema.parse(args))
})
export const get = query({
  args: zodToConvexFields(authoredDraftLookupInputSchema.shape),
  returns: zodToConvex(zMini.nullable(authoredDraftDtoSchema)),
  handler: (ctx, args) =>
    ctx.runQuery(internal.content.draftPages.get, authoredDraftLookupInputSchema.parse(args))
})
export const save = mutation({
  args: zodToConvexFields(authoredDraftCommandInputSchema.shape),
  returns: zodToConvex(authoredDraftDtoSchema),
  handler: (ctx, args) =>
    ctx.runMutation(
      internal.content.draftCommands.save,
      authoredDraftCommandInputSchema.parse(args)
    )
})
export const discard = mutation({
  args: zodToConvexFields(authoredDraftLookupInputSchema.shape),
  returns: v.null(),
  handler: (ctx, args) =>
    ctx.runMutation(
      internal.content.draftCommands.discard,
      authoredDraftLookupInputSchema.parse(args)
    )
})
export const duplicate = mutation({
  args: zodToConvexFields(authoredDraftLookupInputSchema.shape),
  returns: zodToConvex(authoredDraftDtoSchema),
  handler: (ctx, args) =>
    ctx.runMutation(
      internal.content.draftCommands.duplicate,
      authoredDraftLookupInputSchema.parse(args)
    )
})
