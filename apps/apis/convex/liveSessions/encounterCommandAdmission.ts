import { v } from 'convex/values'
import type { LiveSessionBootstrapInput } from '@artificer-toolkit/schema/api/liveSessionState'
import { liveSessionEncounterCommandInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'

/** The room's forwarded user, role, active Campaign and DO_ACTIVE epoch must all match the Run. */
export async function requireLiveEncounterRun(
  ctx: QueryCtx,
  input: LiveSessionBootstrapInput & { encounterId: string }
) {
  const { userId } = await requireIdentity(ctx)
  if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
  const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
  if (membership.role !== input.expectedRole) throw new Error('Live Session role mismatch.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  await requireActiveCampaignLiveAuthority(ctx, {
    campaignId: campaign.id,
    epoch: input.authorityEpoch
  })
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId.toLowerCase()))
    .unique()
  if (!run || run.campaignId !== campaign.id)
    throw new Error('Live Session Encounter scope mismatch.')
  return { userId, campaign, membership, run }
}

/** Admits a forwarded command before `encounterCommand:execute` runs it natively. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const admit = internalQuery({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<null> => {
    const { command, ...scope } = liveSessionEncounterCommandInputSchema.parse(args)
    await requireLiveEncounterRun(ctx, { ...scope, encounterId: command.encounterId })
    return null
  }
})
