import {
  createAccountEntitlementsRepository,
  createCampaignAdjustmentsRepository,
  createCampaignCollaborationRepository,
  createInventoryRepository,
  createCampaignRepository,
  withTransaction,
  type CampaignHistoryEvent,
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

function copiedCampaignIdFromReceipt(
  event: CampaignHistoryEvent | null,
  input: CopyCampaignInput,
  userId: string
): string | null {
  if (!event) return null
  if (
    event.actorUserId !== userId ||
    event.kind !== 'CAMPAIGN_COPIED' ||
    typeof event.payload !== 'object' ||
    event.payload === null ||
    Array.isArray(event.payload) ||
    event.payload.expectedVersion !== input.expectedVersion ||
    typeof event.payload.copiedCampaignId !== 'string'
  ) {
    throw new CampaignConflictError('Command ID was already used.')
  }
  return event.payload.copiedCampaignId
}

export async function copyCampaign(
  db: DBLike,
  userId: string,
  input: CopyCampaignInput
): Promise<CampaignDetailDto> {
  const copiedCampaignId = await withTransaction(db, async (trx) => {
    const repository = createCampaignRepository(trx)
    const events = createInventoryRepository(trx)
    const preliminaryReceipt = copiedCampaignIdFromReceipt(
      await events.findCampaignEventByIdempotency(input.campaignId, input.commandId),
      input,
      userId
    )
    if (preliminaryReceipt) return preliminaryReceipt

    const preliminaryAuthority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(preliminaryAuthority)
    const tier = await createAccountEntitlementsRepository(trx).lockTier(userId)
    const source = await repository.lockCampaign(input.campaignId)
    if (!source) throw new CampaignNotFoundError()
    if (!source.gameSystemId || !source.primaryRulesCatalogueId) {
      throw new CampaignConflictError('Campaign is missing its Rules Catalogue binding.')
    }
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    const lockedReceipt = copiedCampaignIdFromReceipt(
      await events.findCampaignEventByIdempotency(input.campaignId, input.commandId),
      input,
      userId
    )
    if (lockedReceipt) return lockedReceipt
    if (source.version !== input.expectedVersion) throw new CampaignConflictError()

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
      game_system_id: source.gameSystemId,
      primary_rules_catalogue_id: source.primaryRulesCatalogueId,
      attunement_slot_override: source.attunementSlotOverride
    })
    await repository.insertAdditionalRulesCatalogues({
      campaignId: copied.id,
      gameSystemId: source.gameSystemId,
      primaryRulesCatalogueId: source.primaryRulesCatalogueId,
      additionalRulesCatalogueIds: source.additionalRulesCatalogueIds ?? []
    })
    await repository.insertOwnerMembership(copied.id, userId)
    await createCampaignCollaborationRepository(trx).copyCampaignNoteSections(
      source.id,
      copied.id,
      userId
    )
    await createCampaignAdjustmentsRepository(trx).insertCampaignEvent({
      campaignId: source.id,
      actorUserId: userId,
      kind: 'CAMPAIGN_COPIED',
      visibility: 'OWNER',
      payload: {
        copiedCampaignId: copied.id,
        expectedVersion: input.expectedVersion
      },
      idempotencyKey: input.commandId
    })
    return copied.id
  })

  return getCampaign(db, userId, copiedCampaignId)
}
