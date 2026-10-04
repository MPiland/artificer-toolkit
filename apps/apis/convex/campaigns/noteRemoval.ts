import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'

const BATCH = 48

/**
 * Deletes a notebook entry together with the Session pins that reference it, preserving the former
 * note-reference FK cascade in the caller's transaction. Complete indexed batches; platform limits
 * must roll back, never leave partial cleanup.
 */
export async function deleteNotebookSection(
  ctx: MutationCtx,
  section: Doc<'campaignNotebookSections'>
) {
  while (true) {
    const pins = await ctx.db
      .query('campaignSessionReferences')
      .withIndex('by_campaignId_noteSectionId', (q) =>
        q.eq('campaignId', section.campaignId).eq('target.noteSectionId', section.id)
      )
      .take(BATCH)
    for (const pin of pins) await ctx.db.delete(pin._id)
    if (pins.length < BATCH) break
  }
  await ctx.db.delete(section._id)
}

/**
 * Account deletion removes the account's private entries and Session notes in a Campaign (D87);
 * shared ones stay, attributed to a deleted account. One bounded batch per run, rescheduling
 * itself while either table filled its page; each run re-reads the index, so reruns converge.
 */
export const purgeAuthorPrivateNotes = internalMutation({
  args: { campaignId: v.string(), authorUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const [sections, notes] = await Promise.all([
      ctx.db
        .query('campaignNotebookSections')
        .withIndex('by_campaignId_authorUserId_visibility', (q) =>
          q
            .eq('campaignId', args.campaignId)
            .eq('authorUserId', args.authorUserId)
            .eq('visibility', 'PRIVATE')
        )
        .take(BATCH),
      ctx.db
        .query('campaignSessionNotes')
        .withIndex('by_campaignId_authorUserId_visibility', (q) =>
          q
            .eq('campaignId', args.campaignId)
            .eq('authorUserId', args.authorUserId)
            .eq('visibility', 'PRIVATE')
        )
        .take(BATCH)
    ])
    for (const section of sections) await deleteNotebookSection(ctx, section)
    for (const note of notes) await ctx.db.delete(note._id)
    if (sections.length === BATCH || notes.length === BATCH)
      await ctx.scheduler.runAfter(0, internal.campaigns.noteRemoval.purgeAuthorPrivateNotes, args)
    return null
  }
})
