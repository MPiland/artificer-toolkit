import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readAcquiredEquipmentRules } from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import { captureAcquiredEquipmentRules } from '../content/acquiredEquipmentRules'
import { readCampaignSharedRootPublication } from './contentAccess'
import { readPartyEquipmentSource } from './partyInventoryDocuments'

/** Retain acquired mechanics inside the caller's authorized custody/source-loss transaction. */
export async function retainPartyEquipmentRules(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  item: { equipmentId: string; retainedRulesJson?: string }
) {
  if (item.retainedRulesJson)
    readAcquiredEquipmentRules(item.retainedRulesJson, item.equipmentId, campaign.gameSystemId)
  const source = await readPartyEquipmentSource(ctx, campaign, item.equipmentId)
  if (!source) {
    if (!item.retainedRulesJson)
      throw new Error(
        'Acquired Campaign Equipment is unavailable without usable source or retained rules.'
      )
    return item.retainedRulesJson
  }
  return captureAcquiredEquipmentRules(ctx, {
    equipmentId: item.equipmentId,
    systemId: campaign.gameSystemId,
    userId: null,
    sourceIds: source.sourceIds,
    canReadSharedRoot: source.canReadSharedRoot,
    spellRoots: async () => {
      const roots = new Map<string, Doc<'authoredRoots'>>()
      for (const sourceId of source.sourceIds) {
        for await (const root of ctx.db
          .query('authoredRoots')
          .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
            q
              .eq('contentSourceId', sourceId)
              .eq('subjectKind', 'SPELL')
              .eq('ownerUserId', undefined)
          )) {
          if (root.systemId !== campaign.gameSystemId)
            throw new Error('Stored acquired Spell System mismatch.')
          roots.set(root.id, root)
          if (roots.size > 500)
            throw new Error('Acquired Equipment requires complete paginated Spell selection.')
        }
      }
      for await (const share of ctx.db
        .query('campaignContentShares')
        .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
          q.eq('campaignId', campaign.id).eq('subjectKind', 'SPELL')
        )) {
        if (!(await readCampaignSharedRootPublication(ctx, campaign, 'SPELL', share.subjectId)))
          continue
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', share.subjectId))
          .unique()
        if (!root) throw new Error('Stored acquired Spell source is missing.')
        roots.set(root.id, root)
        if (roots.size > 500)
          throw new Error('Acquired Equipment requires complete paginated Spell selection.')
      }
      return [...roots.values()]
    }
  })
}
