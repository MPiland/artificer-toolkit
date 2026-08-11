import {
  createAccountEntitlementsRepository,
  createCampaignCollaborationRepository,
  createCampaignContentRepository,
  createCampaignRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import type { CampaignDetailDto, CopyCampaignInput } from '@artificer-toolkit/schema/api/campaigns'
import { ENTITLEMENT_LIMITS, assertEntitlementLimit } from '../account/entitlementService.js'
import {
  CampaignConflictError,
  CampaignNotFoundError,
  assertCampaignOwner,
  getCampaign,
  resolveCampaignAuthority
} from './campaignService.js'

export async function copyCampaign(
  db: DBLike,
  userId: string,
  input: CopyCampaignInput
): Promise<CampaignDetailDto> {
  const copiedCampaignId = await withTransaction(db, async (trx) => {
    const repository = createCampaignRepository(trx)
    const source = await repository.lockCampaign(input.campaignId)
    if (!source) throw new CampaignNotFoundError()
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    if (source.version !== input.expectedVersion) throw new CampaignConflictError()

    const tier = await createAccountEntitlementsRepository(trx).lockTier(userId)
    assertEntitlementLimit(
      'activeHostedCampaigns',
      await repository.countActiveOwned(userId),
      ENTITLEMENT_LIMITS[tier].activeHostedCampaigns
    )

    const copied = await repository.createCampaign(userId, {
      name: source.name,
      description: source.description,
      format: source.format,
      tone_tags: source.toneTags,
      tone_details: source.toneDetails,
      content_maturity: source.contentMaturity,
      attunement_slot_override: source.attunementSlotOverride
    })
    await repository.insertOwnerMembership(copied.id, userId)
    await createCampaignCollaborationRepository(trx).copyCampaignNoteSections(
      source.id,
      copied.id,
      userId
    )
    await createCampaignContentRepository(trx).copyApprovedContentVersions(
      source.id,
      copied.id,
      userId
    )
    return copied.id
  })

  return getCampaign(db, userId, copiedCampaignId)
}
