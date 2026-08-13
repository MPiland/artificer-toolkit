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
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  CampaignConflictError,
  CampaignNotFoundError,
  resolveCampaignAuthority
} from './campaignService.js'

function presentSettings(
  settings: CampaignPlaySettingsDto,
  maturity: 'STANDARD' | 'MATURE',
  privateOwnerView: boolean
): CampaignPlaySettingsDto {
  if (privateOwnerView) return settings
  const present = (value: string | null) =>
    value === null ? null : presentCampaignPlainText(value, maturity)
  return {
    ...settings,
    absentCharacterPolicy: present(settings.absentCharacterPolicy),
    contentGuidance: present(settings.contentGuidance),
    allowedContentRules: present(settings.allowedContentRules),
    tableConduct: present(settings.tableConduct),
    contentBoundaries: present(settings.contentBoundaries),
    liveSafetyMethod: present(settings.liveSafetyMethod)
  }
}

export async function getCampaignPlaySettings(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignPlaySettingsDto> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const settings = await createCampaignSettingsRepository(db).find(campaignId)
  if (!settings) throw new CampaignNotFoundError()
  return presentSettings(
    campaignPlaySettingsDtoSchema.parse(settings),
    authority.campaign.contentMaturity,
    authority.membership.role === 'OWNER'
  )
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
