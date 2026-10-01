import {
  liveSessionCheckpointRetainedRollSchema,
  type LiveSessionCheckpointRetainedRoll
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { LiveSessionCheckpointInput } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type { MutationCtx } from '../_generated/server'
import { retainUserRolls } from '../rollDocuments'

/** Merges private evidence into the current owner's global bounded history in the checkpoint. */
export async function applyCheckpointPrivateRolls(
  ctx: MutationCtx,
  frame: Pick<LiveSessionCheckpointInput, 'campaignId' | 'epoch' | 'checkpointId'>,
  retainedRolls: readonly LiveSessionCheckpointRetainedRoll[] = []
) {
  if (retainedRolls.length === 0) return
  const rolls = retainedRolls.map((entry) => liveSessionCheckpointRetainedRollSchema.parse(entry))
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (query) => query.eq('id', frame.campaignId))
    .unique()
  if (!campaign || campaign.id !== frame.campaignId || campaign.status !== 'ACTIVE')
    throw new Error('Checkpoint private roll Campaign is unavailable.')
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (query) => query.eq('userId', campaign.ownerUserId))
    .unique()
  if (!profile) throw new Error('Checkpoint private roll owner account is unavailable.')
  const seen = new Set<string>()
  const pending: Array<Parameters<typeof retainUserRolls>[2][number]> = []
  for (const { userId, record, gmCampaignRoll } of rolls) {
    if (
      userId !== campaign.ownerUserId ||
      record.ruleset.systemId !== campaign.gameSystemId ||
      gmCampaignRoll.campaignId !== frame.campaignId
    )
      throw new Error('Checkpoint private roll belongs to another owner, Campaign or System.')
    const identity = checksumCanonicalJson([userId, record.id])
    if (seen.has(identity)) throw new Error('Checkpoint private roll identity is duplicated.')
    seen.add(identity)
    const current = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_id', (query) => query.eq('userId', userId).eq('id', record.id))
      .unique()
    if (!current) {
      pending.push({ record, gmCampaignRoll })
      continue
    }
    const {
      _id,
      _creationTime,
      userId: _userId,
      consumedAt: _consumedAt,
      gmCampaignRoll: binding,
      ...existing
    } = current
    if (
      checksumCanonicalJson(existing) !== checksumCanonicalJson(record) ||
      binding?.campaignId !== gmCampaignRoll.campaignId ||
      binding?.blind !== gmCampaignRoll.blind
    )
      throw new Error('Checkpoint private roll identity is reused.')
  }
  await retainUserRolls(ctx, campaign.ownerUserId, pending)
}
