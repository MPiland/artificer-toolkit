import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignDetailDtoSchema,
  campaignIdInputSchema,
  copyCampaignInputSchema,
  createCampaignInputSchema,
  type CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { createCampaignForOwner } from './create'
import { readCampaignDetail, requireCampaignAuthority } from './documents'

function copyReceiptDestinationId(payloadJson: string, expectedVersion: number) {
  let payload: unknown
  try {
    payload = JSON.parse(payloadJson)
  } catch {
    throw new Error('Stored Campaign copy receipt is invalid.')
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new Error('Stored Campaign copy receipt is invalid.')
  const receipt = payload as { copiedCampaignId?: unknown; expectedVersion?: unknown }
  if (receipt.expectedVersion !== expectedVersion)
    throw new Error('Stored Campaign copy receipt is invalid.')
  try {
    return campaignIdInputSchema.parse({ campaignId: receipt.copiedCampaignId }).campaignId
  } catch {
    throw new Error('Stored Campaign copy receipt is invalid.')
  }
}

export const copy = mutation({
  args: zodToConvexFields(copyCampaignInputSchema.shape),
  returns: zodToConvex(campaignDetailDtoSchema),
  handler: async (ctx, args): Promise<CampaignDetailDto> => {
    const input = copyCampaignInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const campaignId = input.campaignId.toLowerCase()
    const commandId = input.commandId.toLowerCase()
    const inputFingerprint = checksumCanonicalJson({
      operation: 'CAMPAIGN_COPIED',
      campaignId,
      actorUserId: userId,
      commandId,
      expectedVersion: input.expectedVersion
    })
    const pendingCopy = await ctx.db
      .query('campaignCopyJobs')
      .withIndex('by_sourceCampaignId_commandId', (q) =>
        q.eq('command.campaignId', campaignId).eq('command.commandId', commandId)
      )
      .unique()
    if (pendingCopy) throw new Error('This command ID was already used with different input.')
    const prior = await ctx.db
      .query('campaignEvents')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaignId).eq('commandId', commandId)
      )
      .unique()
    if (prior) {
      const { _id, _creationTime, ...storedEvent } = prior
      const stored = campaignStoredEventSchema.parse(storedEvent)
      if (
        stored.type !== 'CAMPAIGN_COPIED' ||
        stored.actorUserId !== userId ||
        stored.commandId !== commandId ||
        stored.inputFingerprint !== inputFingerprint
      )
        throw new Error('This command ID was already used with different input.')
      const copiedCampaignId = copyReceiptDestinationId(stored.payloadJson, input.expectedVersion)
      return readCampaignDetail(ctx, await requireCampaignAuthority(ctx, copiedCampaignId, userId))
    }

    const sourceAuthority = await requireCampaignAuthority(ctx, campaignId, userId)
    if (sourceAuthority.membership.role !== 'OWNER')
      throw new Error('Only the Campaign owner can copy a Campaign.')
    if (sourceAuthority.campaign.version !== input.expectedVersion)
      throw new Error('Campaign changed before this action completed.')
    const source = sourceAuthority.campaign
    const copied = await createCampaignForOwner(
      ctx,
      userId,
      createCampaignInputSchema.parse({
        name: source.name,
        description: source.description,
        format: source.format,
        toneTags: source.toneTags,
        toneDetails: source.toneDetails,
        contentMaturity: source.contentMaturity,
        gameSystemId: source.gameSystemId,
        primaryRulesCatalogueId: source.primaryRulesCatalogueId,
        additionalRulesCatalogueIds: source.additionalRulesCatalogueIds
      }),
      source.attunementSlotOverride
    )
    const now = new Date().toISOString()
    await ctx.db.insert(
      'campaignEvents',
      campaignStoredEventSchema.parse({
        id: crypto.randomUUID(),
        campaignId,
        actorUserId: userId,
        type: 'CAMPAIGN_COPIED',
        visibility: 'OWNER',
        subjectCharacterId: null,
        payloadJson: JSON.stringify({
          copiedCampaignId: copied.id,
          expectedVersion: input.expectedVersion
        }),
        visibleInHistory: false,
        commandId,
        inputFingerprint,
        createdAt: now
      })
    )
    return copied
  }
})
