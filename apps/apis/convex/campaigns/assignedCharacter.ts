import type { CampaignSummaryDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readCharacterHead } from '../characters/stateDocuments'
import { readVisibleAuthoredRouteId } from '../content/routeIds'

type CampaignCharacterSummary = NonNullable<CampaignSummaryDto['activeCharacter']>

/**
 * Validates one stored assignment row against its Campaign, member, Character and route, and
 * returns the Character's summary. Every attached Character, benched or active, passes through here.
 */
export async function readCampaignAttachedCharacter(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  member: Doc<'campaignMemberships'>,
  assignment: Doc<'campaignCharacterAssignments'>
): Promise<CampaignCharacterSummary> {
  const [record, route, uniqueAssignment] = await Promise.all([
    readCharacterHead(ctx, assignment.characterId),
    readVisibleAuthoredRouteId(ctx, { subjectId: assignment.characterId }),
    ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', assignment.characterId))
      .unique()
  ])
  if (
    !record ||
    !route ||
    assignment.campaignId !== campaign.id ||
    assignment.userId !== member.userId ||
    uniqueAssignment?._id !== assignment._id ||
    route.subjectKind !== 'CHARACTER' ||
    // The GM's own Character is assigned like a player's (D92), but only to the Campaign's owner.
    (member.role === 'OWNER') !== (campaign.ownerUserId === member.userId) ||
    record.userId !== member.userId ||
    route.ownerUserId !== member.userId ||
    record.systemId !== campaign.gameSystemId
  )
    throw new Error('Stored Campaign Character assignment mismatch.')
  return {
    id: record.id,
    publicId: route.publicId,
    label: record.label,
    systemId: record.systemId
  }
}

/** The member's Active Character: the one attached Character that plays at the table, if any. */
export async function readCampaignActiveCharacter(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  member: Doc<'campaignMemberships'>
): Promise<CampaignCharacterSummary | null> {
  const assignment = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId_userId_active', (q) =>
      q.eq('campaignId', campaign.id).eq('userId', member.userId).eq('active', true)
    )
    .unique()
  return assignment ? readCampaignAttachedCharacter(ctx, campaign, member, assignment) : null
}

/** Every Character the member attached to the Campaign: the Active Character and the bench. */
export async function readCampaignAttachedCharacters(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  member: Doc<'campaignMemberships'>
): Promise<{
  activeCharacter: CampaignCharacterSummary | null
  benchedCharacters: CampaignCharacterSummary[]
}> {
  const assignments = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', campaign.id).eq('userId', member.userId)
    )
    .collect()
  if (assignments.filter((assignment) => assignment.active).length > 1)
    throw new Error('Stored Campaign Character assignment mismatch.')
  const summaries = await Promise.all(
    assignments.map(async (assignment) => ({
      active: assignment.active,
      character: await readCampaignAttachedCharacter(ctx, campaign, member, assignment)
    }))
  )
  return {
    activeCharacter: summaries.find((entry) => entry.active)?.character ?? null,
    benchedCharacters: summaries.filter((entry) => !entry.active).map((entry) => entry.character)
  }
}
