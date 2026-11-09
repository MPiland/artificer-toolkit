import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readAcquiredEquipmentRules } from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import { captureAcquiredEquipmentRules } from '../content/acquiredEquipmentRules'
import { readCampaignSharedActiveRoot } from './contentAccess'
import { readPartyEquipmentSource } from './partyInventoryDocuments'

/**
 * Retain acquired mechanics inside the caller's authorized custody/source-loss transaction. A caller
 * retaining many rows passes one `captures` map, so each Equipment's current rules are read once.
 */
export async function retainPartyEquipmentRules(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  item: { equipmentId: string; retainedRulesJson?: string },
  captures = new Map<string, Promise<string | null>>()
) {
  if (item.retainedRulesJson)
    readAcquiredEquipmentRules(item.retainedRulesJson, item.equipmentId, campaign.gameSystemId)
  let capture = captures.get(item.equipmentId)
  if (!capture) {
    capture = captureCurrentRules(ctx, campaign, item.equipmentId)
    captures.set(item.equipmentId, capture)
  }
  const current = await capture
  if (current !== null) return current
  if (!item.retainedRulesJson)
    throw new Error(
      'Acquired Campaign Equipment is unavailable without usable source or retained rules.'
    )
  return item.retainedRulesJson
}

/** The Equipment's rules from its currently readable Campaign source, or null when none is readable. */
async function captureCurrentRules(ctx: QueryCtx, campaign: Doc<'campaigns'>, equipmentId: string) {
  const source = await readPartyEquipmentSource(ctx, campaign, equipmentId)
  if (!source) return null
  return captureAcquiredEquipmentRules(ctx, {
    equipmentId,
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
        if (!(await readCampaignSharedActiveRoot(ctx, campaign, 'SPELL', share.subjectId))) continue
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
