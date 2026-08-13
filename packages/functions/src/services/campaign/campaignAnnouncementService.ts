import {
  createCampaignAnnouncementRepository,
  createCampaignCollaborationRepository,
  createCampaignRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignAnnouncementDtoSchema,
  type CampaignAnnouncementDto,
  type CreateCampaignAnnouncementInput
} from '@artificer-toolkit/schema/api/campaigns'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import { enqueueCampaignAnnouncementNotification } from '../notifications/notificationService.js'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  CampaignAccessError,
  CampaignConflictError,
  CampaignNotFoundError,
  resolveCampaignAuthority
} from './campaignService.js'
import { campaignCommandFingerprint } from './campaignCommandService.js'

function mapAnnouncement(
  record: {
    id: string
    campaignId: string
    authorUserId: string
    scope: 'TABLE' | 'PARTY'
    partyId: string | null
    title: string
    body: string
    createdAt: string
  },
  maturity: 'STANDARD' | 'MATURE',
  privateOwnerView: boolean
): CampaignAnnouncementDto {
  return campaignAnnouncementDtoSchema.parse({
    announcementPublicId: record.id,
    campaignId: record.campaignId,
    authorUserId: record.authorUserId,
    scope: record.scope,
    partyId: record.partyId,
    title: privateOwnerView ? record.title : presentCampaignPlainText(record.title, maturity),
    body: privateOwnerView ? record.body : presentCampaignPlainText(record.body, maturity),
    createdAt: record.createdAt
  })
}

async function isPartyMember(db: DBLike, partyId: string, userId: string): Promise<boolean> {
  return (await createCampaignCollaborationRepository(db).listConversationMembers(partyId)).some(
    (member) => member.userId === userId
  )
}

async function canViewAnnouncement(
  db: DBLike,
  userId: string,
  announcement: { scope: 'TABLE' | 'PARTY'; partyId: string | null }
): Promise<boolean> {
  if (announcement.scope === 'TABLE') return true
  return Boolean(announcement.partyId && (await isPartyMember(db, announcement.partyId, userId)))
}

export async function listCampaignAnnouncements(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignAnnouncementDto[]> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const announcements = await createCampaignAnnouncementRepository(db).list(campaignId)
  const visible = await Promise.all(
    announcements.map(async (entry) =>
      (await canViewAnnouncement(db, userId, entry)) ? entry : null
    )
  )
  return visible
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .map((entry) =>
      mapAnnouncement(
        entry,
        authority.campaign.contentMaturity,
        authority.membership.role === 'OWNER'
      )
    )
}

export async function getCampaignAnnouncement(
  db: DBLike,
  userId: string,
  campaignId: string,
  announcementPublicId: string
): Promise<CampaignAnnouncementDto> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const announcement = await createCampaignAnnouncementRepository(db).find(
    campaignId,
    announcementPublicId
  )
  if (!announcement) throw new CampaignNotFoundError()
  if (!(await canViewAnnouncement(db, userId, announcement))) throw new CampaignAccessError()
  return mapAnnouncement(
    announcement,
    authority.campaign.contentMaturity,
    authority.membership.role === 'OWNER'
  )
}

export async function createCampaignAnnouncement(
  db: DBLike,
  userId: string,
  input: CreateCampaignAnnouncementInput
): Promise<CampaignAnnouncementDto> {
  return withTransaction(db, async (trx) => {
    await createCampaignRepository(trx).lockCampaign(input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const repository = createCampaignAnnouncementRepository(trx)
    const inputFingerprint = campaignCommandFingerprint(input)
    const prior = await repository.findByCommand(input.campaignId, input.commandId)
    if (prior) {
      if (prior.inputFingerprint !== inputFingerprint)
        throw new CampaignConflictError('This command ID was already used with different input.')
      return mapAnnouncement(prior, authority.campaign.contentMaturity, true)
    }
    if (input.scope === 'PARTY') {
      const room = await trx
        .selectFrom('campaign_conversations')
        .select('id')
        .where('campaign_id', '=', input.campaignId)
        .where('kind', '=', 'PARTY')
        .where('id', '=', input.partyId!)
        .executeTakeFirst()
      if (!room) throw new CampaignAccessError()
    }
    const announcement = await repository.insert({
      campaignId: input.campaignId,
      commandId: input.commandId,
      inputFingerprint,
      authorUserId: userId,
      scope: input.scope,
      partyId: input.partyId ?? null,
      title: input.title,
      body: input.body
    })
    const memberships = await createCampaignRepository(trx).listActiveMemberships(input.campaignId)
    const partyMemberIds =
      input.scope === 'PARTY'
        ? new Set(
            (
              await createCampaignCollaborationRepository(trx).listConversationMembers(
                input.partyId!
              )
            ).map((member) => member.userId)
          )
        : null
    const recipients = memberships.filter(
      (membership) =>
        membership.userId !== userId &&
        (partyMemberIds === null || partyMemberIds.has(membership.userId))
    )
    await Promise.all(
      recipients.map((recipient) =>
        enqueueCampaignAnnouncementNotification(trx, {
          announcementPublicId: announcement.id,
          campaignPublicId: authority.campaign.publicId,
          recipientUserId: recipient.userId,
          scope: input.scope,
          occurredAt: announcement.createdAt
        })
      )
    )
    return mapAnnouncement(announcement, authority.campaign.contentMaturity, true)
  })
}
