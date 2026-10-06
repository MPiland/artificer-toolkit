import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

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
