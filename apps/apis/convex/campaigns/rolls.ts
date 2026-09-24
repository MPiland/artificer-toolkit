import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignChatEntryDtoSchema,
  executeCampaignPrivateRollInputSchema,
  executeCampaignRollInputSchema,
  type CampaignChatEntryDto,
  type ExecuteCampaignPrivateRollInput
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { rollRecordDtoSchema, type RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  campaignStoredEntryHeaderSchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'

import type { Doc } from '../_generated/dataModel'
import { type QueryCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { getAuthenticatedProfile } from '../lib/identity'
import { evaluateCharacterRoll, nextRollInt, retainUserRoll } from '../rollDocuments'
import { requireSystem } from '../content/systemDocuments'
import { requireCampaignAuthority } from './authority'
import { requireCampaignCharacterAuthority } from './characterState'
import {
  insertConversationEntry,
  openConversation,
  presentChatEntry,
  readEntryPayload,
  requireConversationSendCapacity,
  readCampaignAccessTime
} from './conversationDocuments'

async function evaluateOwnerRoll(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  userId: string,
  username: string,
  roll: ExecuteCampaignPrivateRollInput['roll']
) {
  if (roll.characterId !== null || roll.source.kind !== 'MANUAL')
    throw new Error('A manual Campaign roll is required without a Character.')
  const [assignment] = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .take(1)
  if (!assignment) throw new Error('Assign at least one Character before making a Campaign roll.')
  await requireCampaignCharacterAuthority(ctx, campaign.id, assignment.characterId, userId)
  const system = await requireSystem(ctx, campaign.gameSystemId)
  return rollRecordDtoSchema.parse({
    id: crypto.randomUUID(),
    characterId: null,
    characterLabel: username,
    source: roll.source,
    ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
    ...evaluateRollExpression(
      parseRollExpression(roll.expression),
      { nextInt: nextRollInt },
      roll.rollMode ?? 'NORMAL'
    ),
    createdAt: new Date().toISOString()
  })
}

export { insertPreEvaluatedCampaignTableRoll } from './tableRoll'

export const execute = mutation({
  args: zodToConvexFields(executeCampaignRollInputSchema.shape),
  returns: zodToConvex(campaignChatEntryDtoSchema),
  handler: async (ctx, args): Promise<CampaignChatEntryDto> => {
    const actor = await getAuthenticatedProfile(ctx)
    if (!actor) throw new Error('Unauthenticated')
    const { userId } = actor.identity
    const input = executeCampaignRollInputSchema.parse(args)
    const authority = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (authority.campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (input.roll.characterId !== null) {
      await requireCampaignCharacterAuthority(
        ctx,
        authority.campaign.id,
        input.roll.characterId,
        userId
      )
    } else if (authority.membership.role !== 'OWNER' || input.roll.source.kind !== 'MANUAL') {
      throw new Error('Only the Campaign owner may roll without an assigned Character.')
    }
    const { conversation, member } = await openConversation(ctx, authority, 'TABLE')
    const clientNonce = input.clientNonce.toLowerCase()
    const prior = await ctx.db
      .query('campaignConversationEntries')
      .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
        q
          .eq('campaignId', authority.campaign.id)
          .eq('authorUserId', userId)
          .eq('clientNonce', clientNonce)
      )
      .unique()
    if (prior) {
      if (prior.conversationId !== conversation.id)
        throw new Error('Chat nonce was used in another conversation.')
      if (prior.createdAt < member.accessStartedAt) throw new Error('Chat entry not found.')
      const payload = await readEntryPayload(ctx, prior.id)
      if (payload.kind !== 'ROLL')
        throw new Error('Chat nonce was used for a different entry kind.')
      return presentChatEntry(ctx, prior, payload, conversation, authority.campaign.contentMaturity)
    }
    const now = await readCampaignAccessTime(ctx, authority.campaign)
    await requireConversationSendCapacity(ctx, authority.campaign.id, userId, now)
    if (!actor.username) throw new Error('A username is required to participate in Campaign chat.')
    const roll =
      input.roll.characterId === null
        ? await evaluateOwnerRoll(ctx, authority.campaign, userId, actor.username, input.roll)
        : (
            await evaluateCharacterRoll(
              ctx,
              userId,
              { ...input.roll, characterId: input.roll.characterId },
              authority.campaign.id
            )
          ).record
    const header = campaignStoredEntryHeaderSchema.parse({
      id: crypto.randomUUID(),
      campaignId: authority.campaign.id,
      conversationId: conversation.id,
      authorUserId: userId,
      clientNonce,
      createdAt: new Date(now).toISOString()
    })
    const payload = campaignStoredEntryPayloadSchema.parse({
      entryId: header.id,
      kind: 'ROLL',
      mode: null,
      body: null,
      roll,
      authorUsername: actor.username,
      characterId: roll.characterId,
      characterLabel: roll.characterId === null ? null : roll.characterLabel,
      editedAt: null,
      unsentAt: null
    })
    await insertConversationEntry(ctx, header, payload)
    return presentChatEntry(ctx, header, payload, conversation, authority.campaign.contentMaturity)
  }
})

export const executePrivate = mutation({
  args: zodToConvexFields(executeCampaignPrivateRollInputSchema.shape),
  returns: zodToConvex(rollRecordDtoSchema),
  handler: async (ctx, args): Promise<RollRecordDto> => {
    const actor = await getAuthenticatedProfile(ctx)
    if (!actor) throw new Error('Unauthenticated')
    const { userId } = actor.identity
    const input = executeCampaignPrivateRollInputSchema.parse(args)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (membership.role !== 'OWNER') throw new Error('Only the Campaign owner may roll privately.')
    if (!actor.username) throw new Error('A username is required to participate in Campaign chat.')
    const roll = await evaluateOwnerRoll(ctx, campaign, userId, actor.username, input.roll)
    await retainUserRoll(ctx, userId, roll)
    return roll
  }
})
