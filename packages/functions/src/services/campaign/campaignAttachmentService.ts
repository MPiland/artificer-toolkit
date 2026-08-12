import {
  createCampaignAttachmentRepository,
  createCampaignRepository,
  createMediaRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignAttachmentDtoSchema,
  campaignAttachmentsDtoSchema,
  type CampaignAttachmentDto,
  type CreateCampaignAttachmentInput
} from '@artificer-toolkit/schema/api/campaigns'
import type { SignedCampaignFileDeliveryDto } from '@artificer-toolkit/schema/api/media'
import { getCampaignFileDelivery } from '../media/mediaService.js'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  CampaignAccessError,
  CampaignNotFoundError,
  resolveCampaignAuthority
} from './campaignService.js'

async function assertAssociations(db: DBLike, input: CreateCampaignAttachmentInput) {
  if (input.sessionId) {
    const session = await db
      .selectFrom('campaign_sessions')
      .select('id')
      .where('campaign_id', '=', input.campaignId)
      .where('id', '=', input.sessionId)
      .executeTakeFirst()
    if (!session) throw new CampaignAccessError()
  }
  if (input.noteSectionId) {
    const note = await db
      .selectFrom('campaign_note_sections')
      .select('id')
      .where('campaign_id', '=', input.campaignId)
      .where('id', '=', input.noteSectionId)
      .executeTakeFirst()
    if (!note) throw new CampaignAccessError()
  }
}

export async function listCampaignAttachments(db: DBLike, userId: string, campaignId: string) {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  return campaignAttachmentsDtoSchema.parse(
    await createCampaignAttachmentRepository(db).list(campaignId)
  )
}

export async function createCampaignAttachment(
  db: DBLike,
  userId: string,
  input: CreateCampaignAttachmentInput
): Promise<CampaignAttachmentDto> {
  const attachment = await withTransaction(db, async (trx) => {
    await createCampaignRepository(trx).lockCampaign(input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    await assertAssociations(trx, input)
    const asset = await createMediaRepository(trx).findByIdForUpdate(input.assetId)
    if (!asset || asset.owner_user_id !== userId || asset.status !== 'READY')
      throw new CampaignAccessError()
    if (asset.profile !== 'CAMPAIGN_FILE' && asset.profile !== 'CAMPAIGN_HANDOUT_MAP')
      throw new CampaignAccessError()
    if (asset.target_key !== `${asset.profile}:${input.campaignId}`) throw new CampaignAccessError()
    return createCampaignAttachmentRepository(trx).insert({
      campaignId: input.campaignId,
      assetId: input.assetId,
      uploaderUserId: userId,
      displayName: input.displayName,
      description: input.description ?? null,
      profile: asset.profile,
      sessionId: input.sessionId ?? null,
      noteSectionId: input.noteSectionId ?? null
    })
  })
  return campaignAttachmentDtoSchema.parse(attachment)
}

export async function getCampaignAttachmentDelivery(
  db: DBLike,
  userId: string,
  campaignId: string,
  attachmentId: string
): Promise<SignedCampaignFileDeliveryDto> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const attachment = await createCampaignAttachmentRepository(db).find(campaignId, attachmentId)
  if (!attachment) throw new CampaignNotFoundError()
  return getCampaignFileDelivery(db, attachment.assetId)
}

export async function deleteCampaignAttachment(
  db: DBLike,
  userId: string,
  campaignId: string,
  attachmentId: string
): Promise<void> {
  await withTransaction(db, async (trx) => {
    await createCampaignRepository(trx).lockCampaign(campaignId)
    const authority = await resolveCampaignAuthority(trx, campaignId, userId)
    assertCampaignWritable(authority)
    const attachment = await createCampaignAttachmentRepository(trx).find(campaignId, attachmentId)
    if (!attachment) throw new CampaignNotFoundError()
    if (attachment.uploaderUserId !== userId) assertCampaignOwner(authority)
    if (!(await createCampaignAttachmentRepository(trx).delete(campaignId, attachmentId)))
      throw new CampaignNotFoundError()
  })
}
