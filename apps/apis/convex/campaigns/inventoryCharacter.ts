import { campaignStoredAssignmentSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { requireCampaignAuthority } from './authority'
import { readCampaignAssignedCharacter } from './assignedCharacter'

/** Destination write fences permit giving; they grant no player-facing inventory read. */
export async function readAssignedInventoryCharacter(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  member: Doc<'campaignMemberships'>,
  id: string,
  access: 'READ' | 'SOURCE' | 'DESTINATION'
) {
  const characterId = id.toLowerCase()
  const row = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
  if (!row || row.campaignId !== campaign.id)
    throw new Error('Assigned Character is unavailable in this Campaign.')
  const { _id, _creationTime, ...stored } = row
  const assignment = campaignStoredAssignmentSchema.parse(stored)
  if (access !== 'DESTINATION' && member.role !== 'OWNER' && assignment.userId !== member.userId)
    throw new Error('Only the assigned player or Campaign owner can access this inventory.')
  const { membership: target } = await requireCampaignAuthority(ctx, campaign.id, assignment.userId)
  if ((await readCampaignAssignedCharacter(ctx, campaign, target))?.id !== characterId)
    throw new Error('Stored Campaign Character assignment mismatch.')
  const record = await readCharacterRow(ctx, characterId)
  if (!record) throw new Error('Assigned Character is unavailable in this Campaign.')
  const character = readCharacterRecord(record)
  return { record, character }
}
