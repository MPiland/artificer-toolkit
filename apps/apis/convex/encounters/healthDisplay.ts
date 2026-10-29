import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignChatEntryDtoSchema,
  type CampaignChatEntryDto
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { shareEncounterActorHealthInputDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import type { HealthDescriptiveStateDto } from '@artificer-toolkit/schema/api/healthDisplay'
import { healthDescriptiveState } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import { mutation } from '../lib/mutations'
import { getAuthenticatedProfile } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { postCampaignChatEntry } from '../campaigns/chat'
import { presentEncounterRun } from '@artificer-toolkit/encounter-persistence/sessionReads'
import { encounterReadTransaction } from './encounterReadPorts'

const descriptiveStateLabels: Record<HealthDescriptiveStateDto, string> = {
  UNHURT: 'unhurt',
  HURT: 'hurt',
  BLOODIED: 'bloodied',
  NEAR_DEATH: 'near death'
}

/**
 * GM "Share health state": posts one visible enemy's or NPC's current descriptive state to the
 * table log once. The actor's display level does not change.
 */
export const share = mutation({
  args: zodToConvexFields(shareEncounterActorHealthInputDtoSchema.shape),
  returns: zodToConvex(campaignChatEntryDtoSchema),
  handler: async (ctx, args): Promise<CampaignChatEntryDto> => {
    const profile = await getAuthenticatedProfile(ctx)
    if (!profile) throw new Error('Unauthenticated')
    const input = shareEncounterActorHealthInputDtoSchema.parse(args)
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', input.encounterId.toLowerCase()))
      .unique()
    if (!row) throw new Error('Encounter is unavailable.')
    const authority = await requireCampaignAuthority(ctx, row.campaignId, profile.identity.userId)
    if (authority.membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
    const projection = encounterGmProjectionDtoSchema.parse(
      await presentEncounterRun(
        encounterReadTransaction(ctx),
        row,
        authority.campaign,
        authority.membership
      )
    )
    const actor = projection.actors.find(
      (candidate) => candidate.id === input.actorId.toLowerCase()
    )
    // Sharing a hidden actor would reveal it; a Character's player shares their own health.
    if (!actor || !actor.public || actor.kind === 'CHARACTER')
      throw new Error('Encounter actor was not found.')
    const state = healthDescriptiveState(actor.currentHitPoints, actor.maxHitPoints)
    return postCampaignChatEntry(ctx, authority, profile.username, {
      room: 'TABLE',
      mode: 'OOC',
      body: `${actor.label} looks ${descriptiveStateLabels[state]}.`,
      clientNonce: input.commandId
    })
  }
})
