import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignChatEntryDtoSchema,
  executeCampaignPrivateRollInputSchema,
  executeCampaignRollInputSchema,
  revealCampaignRollInputSchema,
  type CampaignChatEntryDto,
  type ExecuteCampaignPrivateRollInput
} from '@artificer-toolkit/schema/api/campaignCommunication'
import {
  rollHistoryEntryDtoSchema,
  rollRecordDtoSchema,
  type RollHistoryEntryDto,
  type RollRecordDto
} from '@artificer-toolkit/schema/api/rolls'
import {
  campaignStoredEntryIdentitySchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'

import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { getAuthenticatedProfile } from '../lib/identity'
import {
  evaluateCharacterRoll,
  nextRollInt,
  presentRetainedRoll,
  retainUserRoll
} from '../rollDocuments'
import { requireSystem } from '../content/systemDocuments'
import { requireCampaignAuthorUsername } from './authorLabels'
import { requireCampaignAuthority } from './authority'
import { requireCampaignCharacterAuthority } from './characterState'
import {
  insertConversationEntry,
  openConversation,
  presentChatEntry,
  readEntryPayload,
  readCampaignAccessTime
} from './conversationDocuments'
import { consumeUserRateLimit } from '../lib/rateLimits'

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

async function evaluateCampaignRoll(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  userId: string,
  username: string,
  roll: ExecuteCampaignPrivateRollInput['roll']
) {
  if (roll.characterId === null)
    return {
      record: await evaluateOwnerRoll(ctx, campaign, userId, username, roll),
      maturity: null
    }
  return evaluateCharacterRoll(ctx, userId, { ...roll, characterId: roll.characterId }, campaign.id)
}

type CampaignAuthority = Awaited<ReturnType<typeof requireCampaignAuthority>>
type ConversationAccess = Awaited<ReturnType<typeof openConversation>>

/** Returns the caller's existing ROLL entry for this nonce so retries never roll or post twice. */
async function readRollReplay(
  ctx: QueryCtx,
  campaignId: string,
  userId: string,
  { conversation, member }: ConversationAccess,
  clientNonce: string
) {
  const header = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
      q.eq('campaignId', campaignId).eq('authorUserId', userId).eq('clientNonce', clientNonce)
    )
    .unique()
  if (!header) return null
  if (header.conversationId !== conversation.id)
    throw new Error('Chat nonce was used in another conversation.')
  if (header.createdAt < member.accessStartedAt) throw new Error('Chat entry not found.')
  const payload = await readEntryPayload(ctx, header.id)
  if (payload.kind !== 'ROLL') throw new Error('Chat nonce was used for a different entry kind.')
  return { header, payload }
}

async function insertRollEntry(
  ctx: MutationCtx,
  entry: {
    authority: CampaignAuthority
    access: ConversationAccess
    userId: string
    username: string
    clientNonce: string
    roll: RollRecordDto
    revealedByGm: boolean
  }
): Promise<CampaignChatEntryDto> {
  const { authority, access, roll } = entry
  const now = await readCampaignAccessTime(ctx, authority.campaign)
  await consumeUserRateLimit(ctx, 'campaignConversation', entry.userId)
  const header = campaignStoredEntryIdentitySchema.parse({
    id: crypto.randomUUID(),
    campaignId: authority.campaign.id,
    conversationId: access.conversation.id,
    authorUserId: entry.userId,
    clientNonce: entry.clientNonce,
    createdAt: new Date(now).toISOString()
  })
  const payload = campaignStoredEntryPayloadSchema.parse({
    entryId: header.id,
    kind: 'ROLL',
    mode: null,
    body: null,
    roll,
    revealedByGm: entry.revealedByGm,
    authorUsername: entry.username,
    characterId: roll.characterId,
    characterLabel: roll.characterId === null ? null : roll.characterLabel,
    editedAt: null,
    unsentAt: null,
    consumedAt: null
  })
  await insertConversationEntry(ctx, header, payload)
  return presentChatEntry(
    ctx,
    header,
    payload,
    access.conversation,
    authority.campaign.contentMaturity
  )
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
    // The GM has no one to send a GM roll to; their hidden rolls use executePrivate.
    if (input.destination === 'GM' && authority.membership.role === 'OWNER')
      throw new Error('The GM rolls privately instead of to the GM.')
    const access =
      input.destination === 'TABLE'
        ? await openConversation(ctx, authority, 'TABLE')
        : await openConversation(ctx, authority, 'DIRECT', authority.campaign.ownerUserId)
    const clientNonce = input.clientNonce.toLowerCase()
    const replay = await readRollReplay(ctx, authority.campaign.id, userId, access, clientNonce)
    if (replay)
      return presentChatEntry(
        ctx,
        replay.header,
        replay.payload,
        access.conversation,
        authority.campaign.contentMaturity
      )
    requireCampaignAuthorUsername(actor.username)
    const { record } = await evaluateCampaignRoll(
      ctx,
      authority.campaign,
      userId,
      actor.username,
      input.roll
    )
    return insertRollEntry(ctx, {
      authority,
      access,
      userId,
      username: actor.username,
      clientNonce,
      roll: record,
      revealedByGm: false
    })
  }
})

export const executePrivate = mutation({
  args: zodToConvexFields(executeCampaignPrivateRollInputSchema.shape),
  returns: zodToConvex(rollHistoryEntryDtoSchema),
  handler: async (ctx, args): Promise<RollHistoryEntryDto> => {
    const actor = await getAuthenticatedProfile(ctx)
    if (!actor) throw new Error('Unauthenticated')
    const { userId } = actor.identity
    const input = executeCampaignPrivateRollInputSchema.parse(args)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (membership.role !== 'OWNER') throw new Error('Only the Campaign owner may roll privately.')
    requireCampaignAuthorUsername(actor.username)
    const { record, maturity } = await evaluateCampaignRoll(
      ctx,
      campaign,
      userId,
      actor.username,
      input.roll
    )
    const gmCampaignRoll = { campaignId: campaign.id, blind: input.blind, revealedAt: null }
    await retainUserRoll(ctx, userId, record, gmCampaignRoll)
    return rollHistoryEntryDtoSchema.parse(
      presentRetainedRoll({ ...record, gmCampaignRoll }, maturity)
    )
  }
})

/** Posts a GM-retained roll to the TABLE once; the roll id is the idempotency nonce. */
export const reveal = mutation({
  args: zodToConvexFields(revealCampaignRollInputSchema.shape),
  returns: zodToConvex(campaignChatEntryDtoSchema),
  handler: async (ctx, args): Promise<CampaignChatEntryDto> => {
    const actor = await getAuthenticatedProfile(ctx)
    if (!actor) throw new Error('Unauthenticated')
    const { userId } = actor.identity
    const input = revealCampaignRollInputSchema.parse(args)
    const authority = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (authority.campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (authority.membership.role !== 'OWNER')
      throw new Error('Only the Campaign owner may reveal a roll.')
    const retained = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_id', (q) => q.eq('userId', userId).eq('id', input.rollId.toLowerCase()))
      .unique()
    if (!retained?.gmCampaignRoll || retained.gmCampaignRoll.campaignId !== authority.campaign.id)
      throw new Error('Roll not found.')
    const access = await openConversation(ctx, authority, 'TABLE')
    const replay = await readRollReplay(ctx, authority.campaign.id, userId, access, retained.id)
    if (replay) {
      if (!replay.payload.revealedByGm || replay.payload.roll?.id !== retained.id)
        throw new Error('Chat nonce was used with a different roll.')
      return presentChatEntry(
        ctx,
        replay.header,
        replay.payload,
        access.conversation,
        authority.campaign.contentMaturity
      )
    }
    if (retained.gmCampaignRoll.revealedAt !== null)
      throw new Error('This roll was already revealed.')
    requireCampaignAuthorUsername(actor.username)
    const entry = await insertRollEntry(ctx, {
      authority,
      access,
      userId,
      username: actor.username,
      clientNonce: retained.id,
      roll: rollRecordDtoSchema.parse(retained),
      revealedByGm: true
    })
    await ctx.db.patch(retained._id, {
      gmCampaignRoll: { ...retained.gmCampaignRoll, revealedAt: entry.createdAt }
    })
    return entry
  }
})
