import type { GenericDatabaseReader, GenericDatabaseWriter } from 'convex/server'
import {
  CAMPAIGN_CONTENT_SAFETY_CAPS,
  ENTITLEMENT_LIMITS
} from '@artificer-toolkit/shared/account/entitlements'
import type { CampaignContentUsageDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { DataModel } from '../_generated/dataModel'

type CampaignContentResource = keyof typeof CAMPAIGN_CONTENT_SAFETY_CAPS

const counterFields = {
  campaignEntriesPerCampaign: 'entries',
  scenesPerCampaign: 'scenes'
} as const

type CampaignHost = { id: string; ownerUserId: string }

/** The hosting owner's tier applies whoever creates the content. */
async function readHostedContent(db: GenericDatabaseReader<DataModel>, campaign: CampaignHost) {
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
  return {
    limits: ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'],
    used: { entries: usage?.entries ?? 0, scenes: usage?.scenes ?? 0 }
  }
}

/**
 * The refusal message for a create that would take the Campaign past its host's per-Campaign
 * limit, or null when it fits. Unlimited tiers use the hidden safety cap. Content already over a
 * limit after a downgrade stays readable; only new records are refused.
 */
export async function readCampaignContentRefusal(
  db: GenericDatabaseReader<DataModel>,
  campaign: CampaignHost,
  resource: CampaignContentResource,
  added = 1
) {
  const { limits, used } = await readHostedContent(db, campaign)
  const limit = limits[resource] ?? CAMPAIGN_CONTENT_SAFETY_CAPS[resource]
  return used[counterFields[resource]] + added > limit
    ? `This Campaign has reached its ${counterFields[resource]} limit.`
    : null
}

/** Usage against the host's plan limits. Unlimited plans report null, never the hidden safety cap. */
export async function readCampaignContentUsage(
  db: GenericDatabaseReader<DataModel>,
  campaign: CampaignHost
): Promise<CampaignContentUsageDto> {
  const { limits, used } = await readHostedContent(db, campaign)
  if (limits.campaignEntriesPerCampaign === null || limits.scenesPerCampaign === null) return null
  return {
    entries: { used: used.entries, limit: limits.campaignEntriesPerCampaign },
    scenes: { used: used.scenes, limit: limits.scenesPerCampaign }
  }
}

export async function assertCampaignContentAllowed(
  ...args: Parameters<typeof readCampaignContentRefusal>
) {
  const refusal = await readCampaignContentRefusal(...args)
  if (refusal) throw new Error(refusal)
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
