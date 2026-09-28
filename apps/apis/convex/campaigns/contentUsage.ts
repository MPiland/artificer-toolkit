import type { GenericDatabaseReader, GenericDatabaseWriter } from 'convex/server'
import {
  CAMPAIGN_CONTENT_SAFETY_CAPS,
  ENTITLEMENT_LIMITS
} from '@artificer-toolkit/shared/account/entitlements'
import type { DataModel } from '../_generated/dataModel'

type CampaignContentResource = keyof typeof CAMPAIGN_CONTENT_SAFETY_CAPS

const counterFields = {
  campaignEntriesPerCampaign: 'entries',
  scenesPerCampaign: 'scenes'
} as const

/**
 * Refuses a create that would take the Campaign past its host's per-Campaign limit. The hosting
 * owner's tier applies whoever creates the content; unlimited tiers use the hidden safety cap.
 * Content already over a limit after a downgrade stays readable; only new records are refused.
 */
export async function assertCampaignContentAllowed(
  db: GenericDatabaseReader<DataModel>,
  campaign: { id: string; ownerUserId: string },
  resource: CampaignContentResource,
  added = 1
) {
  const [entitlement, usage] = await Promise.all([
    db
      .query('accountEntitlements')
      .withIndex('by_userId', (q) => q.eq('userId', campaign.ownerUserId))
      .unique(),
    db
      .query('campaignContentUsage')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
  ])
  const limit =
    ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'][resource] ??
    CAMPAIGN_CONTENT_SAFETY_CAPS[resource]
  if ((usage?.[counterFields[resource]] ?? 0) + added > limit)
    throw new Error(`This Campaign has reached its ${resource} limit.`)
}

/** Maintained only by the table triggers in `lib/mutations.ts`. */
export async function changeCampaignContentUsage(
  db: GenericDatabaseWriter<DataModel>,
  campaignId: string,
  resource: CampaignContentResource,
  delta: 1 | -1
) {
  const field = counterFields[resource]
  const row = await db
    .query('campaignContentUsage')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
  // A missing row on delete means nothing was counted for this Campaign; there is nothing to release.
  if (!row) {
    if (delta > 0)
      await db.insert('campaignContentUsage', {
        campaignId,
        entries: 0,
        scenes: 0,
        [field]: 1
      })
    return
  }
  const next = { entries: row.entries, scenes: row.scenes, [field]: row[field] + delta }
  if (next.entries <= 0 && next.scenes <= 0) await db.delete(row._id)
  else await db.patch(row._id, next)
}
