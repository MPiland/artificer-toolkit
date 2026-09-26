import { v } from 'convex/values'
import type { LiveSessionBootstrapInput } from '@artificer-toolkit/schema/api/liveSessionState'
import {
  CONVEX_EVALUATED_ENCOUNTER_COMMAND_TYPES,
  CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES,
  liveSessionEncounterCommandInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { readNativeEncounterOccurrenceOwner } from '../encounters/occurrenceOwner'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { rejectDomain } from '../lib/domainRejections'

/** The room's forwarded user, role, active Campaign and DO_ACTIVE epoch must all match the Run. */
export async function requireLiveEncounterRun(
  ctx: QueryCtx,
  input: LiveSessionBootstrapInput & { encounterId: string }
) {
  const { userId } = await requireIdentity(ctx)
  if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
  const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
  if (membership.role !== input.expectedRole) throw new Error('Live Session role mismatch.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
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

const convexCommandTypes = new Set<string>([
  ...CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES,
  ...CONVEX_EVALUATED_ENCOUNTER_COMMAND_TYPES
])

/**
 * Admits a command the room sends to Convex before `encounterCommand:execute` runs it natively:
 * only the listed GM commands, or a movement decision on a Scene the room does not own (D29).
 * Everything else is planned in the room, so Convex never evaluates it here.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const admit = internalQuery({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<null> => {
    const { command, ...scope } = liveSessionEncounterCommandInputSchema.parse(args)
    const { run } = await requireLiveEncounterRun(ctx, {
      ...scope,
      encounterId: command.encounterId
    })
    const decision =
      command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE'
    if (
      decision
        ? (await readNativeEncounterOccurrenceOwner(
            ctx,
            run,
            command.occurrenceId.toLowerCase()
          )) !== 'MOVEMENT'
        : !convexCommandTypes.has(command.type)
    )
      throw new Error('The Encounter command is planned in the Session room.')
    return null
  }
})
