import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import {
  characterConcentrationRoomRouteDtoSchema,
  characterSheetLiveAuthorityReadInputSchema,
  characterSheetLiveAuthorityDtoSchema
} from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { listCarriedActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectReads'
import { planConcentrationCarriedGrantEnds } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import {
  readCampaignCharacterReader,
  requireCampaignCharacterAuthority
} from '../campaigns/characterState'
import { encounterReadTransaction } from '../encounters/encounterReadPorts'
import { readCharacterLiveHold, readLiveCampaignAuthority } from '../liveSessions/authorityGuard'
import { resolveCharacterId } from './documents'
import { readCharacterHead, readCharacterPlay, readCharacterPlayRow } from './stateDocuments'

// Live routing reads stay apart from the Sheet slice read, so a slice read does not evaluate the
// Encounter grant machinery Concentration routing needs (RELIABILITY-21.T33).

/** The Character the caller may route live play for: its owner, or the Campaign GM in a Campaign. */
async function readLiveRoutedCharacterHead(
  ctx: QueryCtx,
  input: { id: string; campaignId?: string }
) {
  const { userId } = await requireIdentity(ctx)
  const id = await resolveCharacterId(ctx, input.id)
  const head = id ? await readCharacterHead(ctx, id) : null
  if (!head) return null
  const { campaignId } = input
  if (campaignId) {
    const reader = await readCampaignCharacterReader(ctx, campaignId, head.id, userId)
    if (reader.party) return null
    const authority = await requireCampaignCharacterAuthority(ctx, campaignId, head.id, userId)
    if (authority.assignment.userId !== head.userId)
      throw new Error('Stored Campaign Character assignment mismatch.')
  } else if (head.userId !== userId) return null
  return head
}

/**
 * SPELLS-5.11 (Q1): the live Encounter whose room ends this caster's Concentration, when a
 * Character that Encounter holds still carries a grant the caster's Concentration keeps alive.
 * Null otherwise: Convex settles the end itself.
 */
export const concentrationRoomRoute = query({
  args: () => zodToConvexFields(characterSheetLiveAuthorityReadInputSchema.shape),
  returns: () => v.union(v.null(), zodToConvex(characterConcentrationRoomRouteDtoSchema)),
  handler: async (ctx, args) => {
    const head = await readLiveRoutedCharacterHead(
      ctx,
      characterSheetLiveAuthorityReadInputSchema.parse(args)
    )
    if (!head) return null
    const carried = planConcentrationCarriedGrantEnds({
      casterCharacterId: head.id,
      effects: await listCarriedActiveRuleEffects(encounterReadTransaction(ctx), head.id)
    })
    for (const effect of carried) {
      if (effect.owner.kind !== 'CHARACTER') continue
      const hold = await readCharacterLiveHold(ctx, effect.owner.characterId)
      if (hold) return { campaignId: hold.campaignId, encounterId: hold.encounterId }
    }
    return null
  }
})

/** The Character owner or Campaign GM can route play without loading mechanics or owned collections. */
export const liveAuthority = query({
  args: () => zodToConvexFields(characterSheetLiveAuthorityReadInputSchema.shape),
  returns: () => v.union(v.null(), zodToConvex(characterSheetLiveAuthorityDtoSchema)),
  handler: async (ctx, args) => {
    const input = characterSheetLiveAuthorityReadInputSchema.parse(args)
    const head = await readLiveRoutedCharacterHead(ctx, input)
    if (!head) return null
    const { campaignId } = input
    const holds = await ctx.db
      .query('liveCharacterHolds')
      .withIndex('by_characterId', (query) => query.eq('characterId', head.id))
      .collect()
    for (const hold of holds) {
      if (campaignId && hold.campaignId !== campaignId) continue
      const live = await readLiveCampaignAuthority(ctx, hold.campaignId)
      if (!live || live.epoch !== hold.epoch) continue
      const play = await readCharacterPlayRow(ctx, head.id)
      if (play.userId !== head.userId) throw new Error('Stored Character play ownership mismatch.')
      readCharacterPlay(play)
      return characterSheetLiveAuthorityDtoSchema.parse({
        characterId: head.id,
        campaignId: live.campaignId,
        epoch: live.epoch,
        phase: live.phase,
        encounterIds: [
          ...new Set(
            holds
              .filter((row) => row.campaignId === live.campaignId && row.epoch === live.epoch)
              .map((row) => row.encounterId)
          )
        ].sort(),
        checkpointSequence: live.persistedSequence,
        checkpointedAt: live.checkpointedAt ?? null,
        checkpointStreamVersion: play.streamVersion
      })
    }
    return null
  }
})
