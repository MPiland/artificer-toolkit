import {
  createCampaignSettingsRepository,
  createCampaignRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignPlaySettingsDtoSchema,
  saveCampaignPlaySettingsInputSchema,
  type CampaignPlaySettingsDto,
  type SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaigns'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  CampaignConflictError,
  CampaignNotFoundError,
  resolveCampaignAuthority
} from './campaignService.js'

export async function getCampaignPlaySettings(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignPlaySettingsDto> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const settings = await createCampaignSettingsRepository(db).find(campaignId)
  if (!settings) throw new CampaignNotFoundError()
  return campaignPlaySettingsDtoSchema.parse(settings)
}

export async function saveCampaignPlaySettings(
  db: DBLike,
  userId: string,
  rawInput: SaveCampaignPlaySettingsInput
): Promise<CampaignPlaySettingsDto> {
  const input = saveCampaignPlaySettingsInputSchema.parse(rawInput)
  const settings = await withTransaction(db, async (trx) => {
    if (!(await createCampaignRepository(trx).lockCampaign(input.campaignId))) {
      throw new CampaignNotFoundError()
    }
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const saved = await createCampaignSettingsRepository(trx).save(input)
    if (!saved) throw new CampaignConflictError('Campaign play settings changed before saving.')
    return saved
  })
  return campaignPlaySettingsDtoSchema.parse(settings)
}
