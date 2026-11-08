import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignCharacterBasicsDtoSchema,
  campaignCharacterBasicsInputSchema,
  type CampaignCharacterBasicsDto
} from '@artificer-toolkit/schema/api/campaignCharacterBasics'
import { CharacterRequiresBuilderRepairError } from '@artificer-toolkit/rules-runtime/character/builderRepair'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { readCharacterHead, readCharacterPlayRow } from '../characters/stateDocuments'
import { requireCampaignAuthority } from './authority'

/**
 * Public roster basics (name, level, class, "Party can view") for any active member (ADR 0034
 * decision 5). The party roster subscribes one per assigned Character, so this module stays out of
 * the Sheet graph and serves stored fields only: the head's label and the play record's class
 * summary, total level and party visibility (PERF-6.2). Membership departure removes the assignment
 * in the same transaction, so an assignment here always belongs to an active member.
 */
export const get = query({
  args: () => zodToConvexFields(campaignCharacterBasicsInputSchema.shape),
  returns: () => zodToConvex(campaignCharacterBasicsDtoSchema),
  handler: async (ctx, args): Promise<CampaignCharacterBasicsDto> => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, characterId } = campaignCharacterBasicsInputSchema.parse(args)
    const id = characterId.toLowerCase()
    const { campaign } = await requireCampaignAuthority(ctx, campaignId, userId)
    const assignment = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', id))
      .unique()
    if (!assignment || assignment.campaignId !== campaign.id)
      throw new Error('Assigned Character not found.')
    const [head, play] = await Promise.all([
      readCharacterHead(ctx, id),
      readCharacterPlayRow(ctx, id)
    ])
    if (
      !head ||
      head.userId !== assignment.userId ||
      head.systemId !== campaign.gameSystemId ||
      play.userId !== head.userId
    )
      throw new Error('Stored Campaign Character assignment mismatch.')
    if (head.status !== 'ACTIVE') throw new CharacterRequiresBuilderRepairError()
    return campaignCharacterBasicsDtoSchema.parse({
      characterId: head.id,
      label: head.label || 'Untitled Character',
      classSummary: play.classSummary,
      totalLevel: play.totalLevel,
      sheetVisible: play.state.partyVisibility.sheet
    })
  }
})
