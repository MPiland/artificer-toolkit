import {
  campaignCharacterStateSchema,
  type CampaignCharacterState
} from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { getCharacterSheetAdjustmentSlotKey } from '@artificer-toolkit/rules-runtime/character/sheetAdjustmentIdentity'
import type { QueryCtx } from '../_generated/server'
import { readCampaignAssignedCharacter } from './assignedCharacter'
import { requireCampaignAuthority, type CampaignInternalScope } from './authority'

/** Exact assignment authority; this never grants access to a personal Character endpoint. */
export async function requireCampaignCharacterAuthority(
  ctx: QueryCtx,
  campaignId: string,
  lookupId: string,
  userId: string,
  authorityScope?: CampaignInternalScope
) {
  const characterId = lookupId.toLowerCase()
  const { campaign, membership } = await requireCampaignAuthority(
    ctx,
    campaignId,
    userId,
    authorityScope
  )
  const assignment = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
  if (
    !assignment ||
    assignment.campaignId !== campaign.id ||
    (membership.role !== 'OWNER' && assignment.userId !== userId)
  )
    throw new Error('Assigned Character not found.')
  const member = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', campaign.id).eq('userId', assignment.userId)
    )
    .unique()
  if (!member || member.status !== 'ACTIVE') throw new Error('Assigned Character not found.')
  const character = await readCampaignAssignedCharacter(ctx, campaign, member)
  if (character?.id !== characterId)
    throw new Error('Stored Campaign Character assignment mismatch.')
  return { campaign, membership, assignment }
}

/**
 * Who reads an assigned Character's Sheet, and as whom it loads. The GM and the Character's player
 * read it directly. Another active member reads the player's own view, which the caller still
 * projects for `PARTY_MEMBER` and allows only while "Party can view" is on (ADR 0034 decision 5).
 */
export async function readCampaignCharacterReader(
  ctx: QueryCtx,
  campaignId: string,
  lookupId: string,
  userId: string
): Promise<{ loadAsUserId: string; party: boolean }> {
  const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
  if (membership.role === 'OWNER') return { loadAsUserId: userId, party: false }
  const assignment = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_characterId', (q) => q.eq('characterId', lookupId.toLowerCase()))
    .unique()
  if (!assignment || assignment.campaignId !== campaign.id)
    throw new Error('Assigned Character not found.')
  return { loadAsUserId: assignment.userId, party: assignment.userId !== userId }
}

/** Caller supplies an already-authorized Campaign/Character binding. */
export async function readCampaignCharacterState(
  ctx: QueryCtx,
  campaignId: string,
  characterId: string
) {
  const stored = await ctx.db
    .query('campaignCharacterStates')
    .withIndex('by_campaignId_characterId', (q) =>
      q.eq('campaignId', campaignId).eq('characterId', characterId)
    )
    .unique()
  let state: CampaignCharacterState = { adjustments: [], conditions: [] }
  if (stored) {
    const raw: unknown = JSON.parse(stored.documentJson)
    if (checksumRuleDocument(raw) !== stored.checksum)
      throw new Error('Stored Campaign Character state checksum mismatch.')
    state = campaignCharacterStateSchema.parse(raw)
    const records = [...state.adjustments, ...state.conditions]
    if (
      records.some(
        (record) => record.campaignId !== campaignId || record.characterId !== characterId
      )
    )
      throw new Error('Stored Campaign Character state ownership mismatch.')
    if (
      new Set(records.map((record) => record.id)).size !== records.length ||
      new Set(
        state.adjustments.map((record) => getCharacterSheetAdjustmentSlotKey(record.adjustment))
      ).size !== state.adjustments.length ||
      new Set(state.conditions.map((record) => record.conditionTypeId)).size !==
        state.conditions.length
    )
      throw new Error('Stored Campaign Character state must have unique identities and slots.')
  }
  return { stored, state }
}
