import {
  campaignDetailDtoSchema,
  campaignSummaryDtoSchema,
  type CampaignSummaryDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { rollModeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { getCampaignCapabilities } from '@artificer-toolkit/shared/campaign/capabilities'
import {
  presentCampaignPlainText,
  presentCampaignRichText
} from '@artificer-toolkit/shared/campaign/textPolicy'
import type { Doc } from '../_generated/dataModel'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import type { QueryCtx } from '../_generated/server'
import { readAuthUsers } from '../lib/authUserReads'
import { readCampaignAssignedCharacter } from './assignedCharacter'
import { readActiveCampaignMembers, requireCampaignAuthority } from './authority'

export { readActiveCampaignMembers, requireCampaignAuthority } from './authority'
export { readCampaignAssignedCharacter } from './assignedCharacter'

export function presentCampaignSummary(
  campaign: Doc<'campaigns'>,
  membership: Doc<'campaignMemberships'>,
  members: Doc<'campaignMemberships'>[],
  assignedCharacter: CampaignSummaryDto['assignedCharacter'],
  privateOwnerView = false
): CampaignSummaryDto {
  const maturity = campaign.contentMaturity
  return campaignSummaryDtoSchema.parse({
    id: campaign.id,
    publicId: campaign.publicId,
    name: privateOwnerView ? campaign.name : presentCampaignPlainText(campaign.name, maturity),
    description:
      privateOwnerView || !campaign.description
        ? campaign.description
        : presentCampaignRichText(campaign.description, maturity),
    format: campaign.format,
    toneTags: campaign.toneTags,
    toneDetails:
      privateOwnerView || !campaign.toneDetails
        ? campaign.toneDetails
        : presentCampaignPlainText(campaign.toneDetails, maturity),
    contentMaturity: maturity,
    gameSystemId: campaign.gameSystemId,
    primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
    additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds,
    status: campaign.status,
    role: membership.role,
    version: campaign.version,
    memberCount: members.length,
    playerCount: members.filter((member) => member.role === 'PLAYER').length,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    capabilities: getCampaignCapabilities(campaign.status, membership.role),
    assignedCharacter
  })
}

export async function readCampaignDetail(
  ctx: QueryCtx,
  { campaign, membership }: Awaited<ReturnType<typeof requireCampaignAuthority>>,
  privateOwnerView = false
) {
  if (privateOwnerView && membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
  const members = await readActiveCampaignMembers(ctx, campaign)
  const grantsByUserId = new Map(
    (
      await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .collect()
    ).map(({ userId, controllerUserIds }) => [userId, controllerUserIds ?? []])
  )
  const memberDetails = await Promise.all(
    members.map(async (member) => {
      const [profile, assignedCharacter] = await Promise.all([
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', member.userId))
          .unique(),
        readCampaignAssignedCharacter(ctx, campaign, member)
      ])
      if (!profile) throw new Error('Campaign member profile is unavailable.')
      return { assignedCharacter, member, profile }
    })
  )
  const users = await readAuthUsers(
    ctx,
    memberDetails.map(({ profile }) => profile.authUserId)
  )
  const usersById = new Map(users.map((user) => [String(user._id), user]))
  const memberships = memberDetails.map(({ assignedCharacter, member, profile }) => {
    const user = usersById.get(profile.authUserId)
    if (!user) throw new Error('Campaign member account is unavailable.')
    return {
      userId: member.userId,
      username: user.displayUsername ?? user.username ?? 'unknown',
      role: member.role,
      accessStartedAt: member.accessStartedAt,
      acceptedAt: member.joinedAt,
      assignedCharacter,
      characterControllerUserIds: assignedCharacter ? (grantsByUserId.get(member.userId) ?? []) : []
    }
  })
  const own = memberships.find((member) => member.userId === membership.userId)
  if (!own) throw new Error('Stored Campaign membership authority mismatch.')
  return campaignDetailDtoSchema.parse({
    ...presentCampaignSummary(
      campaign,
      membership,
      members,
      own.assignedCharacter,
      privateOwnerView
    ),
    attunementSlotOverride: campaign.attunementSlotOverride,
    rollModes: rollModeCapabilityRegistry.offeredRollModes(campaign.gameSystemId),
    memberships
  })
}
