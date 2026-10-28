import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import {
  characterSheetNotesSliceDtoSchema,
  characterSheetSliceReadInputSchema,
  characterSheetSliceResponseDtoSchema,
  type CharacterSheetSliceResponseDto
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import { readCharacterCollectionValues } from '@artificer-toolkit/schema/projections/characterOperationalState'
import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import { projectCharacterSheetNotes } from '@artificer-toolkit/rules-runtime/character/sheetNotes'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import {
  readCampaignCharacterReader,
  requireCampaignCharacterAuthority
} from '../campaigns/characterState'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { resolveCharacterId } from './documents'
import { readCharacterCampaign } from './sourceReads'
import {
  readCharacterCollection,
  readCharacterHead,
  readCharacterPlay,
  readCharacterPlayRow,
  readVerifiedCharacterBuild
} from './stateDocuments'
import { loadCharacterSheet } from './sheetPreparation'
import { characterSheetSection, readStoredCharacterSheetSection } from './sheetSections'
import {
  characterConcentrationRoomRouteDtoSchema,
  characterSheetLiveAuthorityReadInputSchema,
  characterSheetLiveAuthorityDtoSchema
} from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { listCarriedActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import { planConcentrationCarriedGrantEnds } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { encounterReadTransaction } from '../encounters/encounterPorts'
import { readCharacterLiveHold, readLiveCampaignAuthority } from '../liveSessions/authorityGuard'

/** Private notes require current ownership, assignment and route authority, without source reads. */
export async function loadCharacterSheetNotes(
  ctx: QueryCtx,
  userId: string,
  lookupId: string,
  campaignId?: string
) {
  const id = await resolveCharacterId(ctx, lookupId)
  const head = id ? await readCharacterHead(ctx, id) : null
  if (!head) return null
  if (campaignId) {
    const authority = await requireCampaignCharacterAuthority(ctx, campaignId, head.id, userId)
    if (authority.assignment.userId !== head.userId)
      throw new Error('Stored Campaign Character assignment mismatch.')
  }
  if (head.userId !== userId) return null
  await readCharacterCampaign(ctx, head, userId)
  const route = await readVisibleAuthoredRouteId(ctx, { subjectId: head.id })
  if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== head.userId)
    throw new Error('Stored Character route identity mismatch.')
  if (head.status !== 'ACTIVE')
    throw new Error('Character requires Builder repair before the Sheet can be read.')
  const [{ play, fields }, notes, groups] = await Promise.all([
    readVerifiedCharacterBuild(ctx, head),
    readCharacterCollection(ctx, 'characterNotes', head.id),
    readCharacterCollection(ctx, 'characterNoteGroups', head.id)
  ])
  const noteValues = readCharacterCollectionValues(
    head.id,
    notes,
    fields.collectionCounts.characterNotes
  )
  const groupValues = readCharacterCollectionValues(
    head.id,
    groups,
    fields.collectionCounts.characterNoteGroups
  )
  if (
    (!fields.optionalStateKeys.includes('notes') && noteValues.length) ||
    (!fields.optionalStateKeys.includes('noteGroups') && groupValues.length)
  )
    throw new Error('Stored Character optional collection mismatch.')
  return characterSheetNotesSliceDtoSchema.parse({
    meta: { characterId: head.id, streamVersion: play.streamVersion },
    notes: projectCharacterSheetNotes({
      profile: fields.profile,
      state: { notes: noteValues, noteGroups: groupValues }
    })
  })
}

export const get = query({
  args: zodToConvexFields(characterSheetSliceReadInputSchema.shape),
  returns: v.union(v.null(), zodToConvex(characterSheetSliceResponseDtoSchema)),
  handler: async (ctx, args): Promise<CharacterSheetSliceResponseDto | null> => {
    const { userId } = await requireIdentity(ctx)
    const { id, campaignId, slice } = characterSheetSliceReadInputSchema.parse(args)
    if (slice === 'NOTES') {
      const notes = await loadCharacterSheetNotes(ctx, userId, id, campaignId)
      return notes ? { slice, data: notes } : null
    }
    const characterId = await resolveCharacterId(ctx, id)
    if (!characterId) return null
    const reader = campaignId
      ? await readCampaignCharacterReader(ctx, campaignId, characterId, userId)
      : { loadAsUserId: userId, party: false }
    const stored = await readStoredCharacterSheetSection(ctx, {
      userId: reader.loadAsUserId,
      lookupId: characterId,
      campaignId,
      party: reader.party,
      section: characterSheetSection.slice(slice)
    })
    if (stored !== undefined) return characterSheetSliceResponseDtoSchema.parse(stored)
    const current = await loadCharacterSheet(ctx, reader.loadAsUserId, characterId, campaignId)
    if (!current) return null
    if (reader.party && !current.sheetState.partyVisibility.sheet)
      throw new Error('Assigned Character not found.')
    const projected = projectCharacterSheetForViewer(
      current.sheet,
      reader.party
        ? { ...current.campaignContext, viewer: 'PARTY_MEMBER' }
        : current.campaignContext
    )
    return characterSheetSliceResponseDtoSchema.parse(projectCharacterSheetSlice(projected, slice))
  }
})

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
  args: zodToConvexFields(characterSheetLiveAuthorityReadInputSchema.shape),
  returns: v.union(v.null(), zodToConvex(characterConcentrationRoomRouteDtoSchema)),
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
  args: zodToConvexFields(characterSheetLiveAuthorityReadInputSchema.shape),
  returns: v.union(v.null(), zodToConvex(characterSheetLiveAuthorityDtoSchema)),
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
