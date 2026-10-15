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
  const activeMembers = new Map<string, boolean>()
  const isActiveMember = async (userId: string) => {
    const known = activeMembers.get(userId)
    if (known !== undefined) return known
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (query) =>
        query.eq('campaignId', frame.campaignId).eq('userId', userId)
      )
      .unique()
    const memberProfile =
      membership?.status === 'ACTIVE'
        ? await ctx.db
            .query('userProfiles')
            .withIndex('by_userId', (query) => query.eq('userId', userId))
            .unique()
        : null
    activeMembers.set(userId, memberProfile !== null)
    return memberProfile !== null
  }
  const seen = new Set<string>()
  const pending = new Map<string, Array<Parameters<typeof retainUserRolls>[2][number]>>()
  for (const { userId, record, gmCampaignRoll } of rolls) {
    // The GM's copy carries the reveal binding; a member's own copy of a hidden creature they
    // control (D62) carries none.
    const belongs =
      userId === campaign.ownerUserId
        ? gmCampaignRoll?.campaignId === frame.campaignId
        : gmCampaignRoll === null && (await isActiveMember(userId))
    if (!belongs || record.ruleset.systemId !== campaign.gameSystemId)
      throw new Error('Checkpoint private roll belongs to another owner, Campaign or System.')
    const identity = checksumCanonicalJson([userId, record.id])
    if (seen.has(identity)) throw new Error('Checkpoint private roll identity is duplicated.')
    seen.add(identity)
    const current = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_id', (query) => query.eq('userId', userId).eq('id', record.id))
      .unique()
    if (!current) {
      const queued = pending.get(userId) ?? []
      queued.push({ record, gmCampaignRoll })
      pending.set(userId, queued)
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
      (binding?.campaignId ?? null) !== (gmCampaignRoll?.campaignId ?? null)
    )
      throw new Error('Checkpoint private roll identity is reused.')
    // A member's copy has no reveal marks to merge.
    if (!binding || !gmCampaignRoll) continue
    // A reveal is never undone: the room's binding adds marks, it cannot clear a recorded one.
    await ctx.db.patch(_id, {
      gmCampaignRoll: {
        ...gmCampaignRoll,
        revealedAt: binding.revealedAt ?? gmCampaignRoll.revealedAt,
        noticedAt: binding.noticedAt ?? gmCampaignRoll.noticedAt
      }
    })
  }
  for (const [userId, records] of pending) await retainUserRolls(ctx, userId, records)
}
