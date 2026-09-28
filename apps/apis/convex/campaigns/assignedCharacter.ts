import type { CampaignSummaryDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readCharacterRecord } from '../characters/stateDocuments'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { deriveOnce } from '@artificer-toolkit/encounter-persistence/transactionReads'

export async function readCampaignAssignedCharacter(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  member: Doc<'campaignMemberships'>
): Promise<CampaignSummaryDto['assignedCharacter']> {
  const assignment = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', campaign.id).eq('userId', member.userId)
    )
    .unique()
  if (!assignment) return null
  const [record, route, uniqueAssignment] = await Promise.all([
    ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', assignment.characterId))
      .unique(),
    readVisibleAuthoredRouteId(ctx, { subjectId: assignment.characterId }),
    ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', assignment.characterId))
      .unique()
  ])
  if (
    !record ||
    !route ||
    uniqueAssignment?._id !== assignment._id ||
    route.subjectKind !== 'CHARACTER' ||
    member.role !== 'PLAYER' ||
    record.userId !== member.userId ||
    route.ownerUserId !== member.userId ||
    record.systemId !== campaign.gameSystemId
  )
    throw new Error('Stored Campaign Character assignment mismatch.')
  const character = deriveOnce(record, readCharacterRecord)
  return {
    id: character.id,
    publicId: route.publicId,
    label: character.label,
    systemId: character.systemId
  }
}
