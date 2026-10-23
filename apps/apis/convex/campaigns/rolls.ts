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
  type RollHistoryEntryDto
} from '@artificer-toolkit/schema/api/rolls'
import { buildConversationEntryRecords } from '@artificer-toolkit/encounter-persistence/conversationEntryRecords'
import {
  readRollNoticeCreatureLabel,
  readRollRevealRefusal,
  rollNoticeNonce,
  withRollRevealed
} from '@artificer-toolkit/encounter-persistence/rollReveals'
import { createRollRecord } from '@artificer-toolkit/rules-runtime/character/rollRecord'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'

import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { getAuthenticatedProfile } from '../lib/identity'
import { presentRetainedRoll } from '@artificer-toolkit/rules-runtime/character/rollPresentation'
import { evaluateCharacterRoll, nextRollInt, retainUserRoll } from '../rollDocuments'
import { requireSystem } from '../content/systemDocuments'
import { requireCampaignAuthorUsername } from './authorLabels'
import { requireCampaignAuthority } from './authority'
import { resolveCharacterId } from '../characters/documents'
import { requireCampaignCharacterAuthority } from './characterState'
import {
  insertConversationEntry,
  openConversation,
  presentChatEntry,
  readConversationEntryReplay,
  readCampaignAccessTime
} from './conversationDocuments'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { consumeUserRateLimit } from '../lib/rateLimits'
import { assertConvexOwnsCampaignChat } from '../liveSessions/authorityGuard'

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
  return createRollRecord({
    characterId: null,
    label: username,
    system: {
      id: system.id,
      rulesetCode: system.rulesetCode,
      rulesetVersion: system.rulesetVersion
    },
    resolved: {
      expression: roll.expression,
      rollMode: roll.rollMode,
      source: roll.source
    },
    nextInt: nextRollInt
  })
}

async function evaluateCampaignRoll(
  ctx: MutationCtx,
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

async function insertRollEntry(
  ctx: MutationCtx,
  entry: {
    authority: CampaignAuthority
    access: ConversationAccess
    userId: string
    username: string
    clientNonce: string
    content: Extract<
      Parameters<typeof buildConversationEntryRecords>[0]['content'],
      { kind: 'ROLL' | 'ROLL_NOTICE' }
    >
  }
): Promise<CampaignChatEntryDto> {
  const { authority, access } = entry
  const now = await readCampaignAccessTime(ctx, authority.campaign)
  await consumeUserRateLimit(ctx, 'campaignConversation', entry.userId)
  const { identity: header, payload } = buildConversationEntryRecords({
    campaignId: authority.campaign.id,
    conversationId: access.conversation.id,
    authorUserId: entry.userId,
    clientNonce: entry.clientNonce,
    createdAt: new Date(now).toISOString(),
    username: entry.username,
    content: entry.content
  })
  const stored = await insertConversationEntry(ctx, header, payload)
  return presentChatEntry(
    ctx,
    stored,
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
    await assertConvexOwnsCampaignChat(ctx, authority.campaign.id)
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
    const replay = await readConversationEntryReplay(ctx, access, userId, clientNonce, 'ROLL')
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
      content: { kind: 'ROLL', roll: record, revealedByGm: false }
    })
  }
})

/**
 * The GM's private roll (Q14): retained in the owner's history, never posted. The client nonce is
 * the roll's id, so a retry finds the retained roll instead of rolling again.
 */
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
    await assertConvexOwnsCampaignChat(ctx, campaign.id)
    const rollId = input.clientNonce.toLowerCase()
    const existing = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_id', (q) => q.eq('userId', userId).eq('id', rollId))
      .unique()
    if (existing) {
      const { roll } = input
      // A retry replays only the roll it first made: the Character and source kind always define
      // it, and a manual roll's expression and mode do too (a Sheet roll's come from the Sheet).
      const sameRoll =
        existing.gmCampaignRoll?.campaignId === campaign.id &&
        existing.characterId ===
          (roll.characterId === null ? null : await resolveCharacterId(ctx, roll.characterId)) &&
        existing.source.kind === roll.source.kind &&
        (roll.source.kind !== 'MANUAL' ||
          (existing.normalizedExpression ===
            parseRollExpression(roll.expression).normalizedExpression &&
            existing.evidence.mode === roll.rollMode))
      if (!sameRoll) throw new Error('Roll nonce was used for a different roll.')
      return rollHistoryEntryDtoSchema.parse(
        presentRetainedRoll(existing, existing.characterId ? campaign.contentMaturity : null)
      )
    }
    requireCampaignAuthorUsername(actor.username)
    const { record, maturity } = await evaluateCampaignRoll(
      ctx,
      campaign,
      userId,
      actor.username,
      input.roll
    )
    const retained = { ...record, id: rollId }
    const gmCampaignRoll = {
      campaignId: campaign.id,
      creature: null,
      revealedAt: null,
      noticedAt: null
    }
    await retainUserRoll(ctx, userId, retained, gmCampaignRoll)
    return rollHistoryEntryDtoSchema.parse(
      presentRetainedRoll({ ...retained, gmCampaignRoll }, maturity)
    )
  }
})

/**
 * Posts a GM-retained roll to the TABLE: FULL as the roll's card, NOTICE as only the fact that the
 * GM rolled (D83). Neither can be undone; each posts once per roll, and the roll id (FULL) or its
 * derived notice nonce is the idempotency nonce.
 */
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
    await assertConvexOwnsCampaignChat(ctx, authority.campaign.id)
    const retained = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_id', (q) => q.eq('userId', userId).eq('id', input.rollId.toLowerCase()))
      .unique()
    const gmCampaignRoll = retained?.gmCampaignRoll
    if (!retained || !gmCampaignRoll || gmCampaignRoll.campaignId !== authority.campaign.id)
      throw new Error('Roll not found.')
    const access = await openConversation(ctx, authority, 'TABLE')
    const nonce = input.mode === 'FULL' ? retained.id : rollNoticeNonce(retained.id)
    const replay = await readConversationEntryReplay(
      ctx,
      access,
      userId,
      nonce,
      input.mode === 'FULL' ? 'ROLL' : 'ROLL_NOTICE'
    )
    if (replay) {
      if (
        input.mode === 'FULL' &&
        (!replay.payload.revealedByGm || replay.payload.roll?.id !== retained.id)
      )
        throw new Error('Chat nonce was used with a different roll.')
      return presentChatEntry(
        ctx,
        replay.header,
        replay.payload,
        access.conversation,
        authority.campaign.contentMaturity
      )
    }
    const refusal = readRollRevealRefusal(gmCampaignRoll, input.mode)
    if (refusal) throw new Error(refusal)
    requireCampaignAuthorUsername(actor.username)
    const entry = await insertRollEntry(ctx, {
      authority,
      access,
      userId,
      username: actor.username,
      clientNonce: nonce,
      content:
        input.mode === 'FULL'
          ? { kind: 'ROLL', roll: rollRecordDtoSchema.parse(retained), revealedByGm: true }
          : {
              kind: 'ROLL_NOTICE',
              creatureLabel: await readRollNoticeCreatureLabel(
                { db: createConvexEncounterStoreReader(ctx) },
                gmCampaignRoll.creature
              )
            }
    })
    await ctx.db.patch(retained._id, {
      gmCampaignRoll: withRollRevealed(gmCampaignRoll, input.mode, entry.createdAt)
    })
    return entry
  }
})
