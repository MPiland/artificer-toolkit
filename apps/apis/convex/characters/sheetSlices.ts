import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import {
  characterSheetNotesSliceDtoSchema,
  characterSheetSliceReadInputSchema,
  characterSheetSliceResponseDtoSchema,
  type CharacterSheetSliceResponseDto
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import {
  readCharacterBuildFields,
  readCharacterCollectionValues
} from '@artificer-toolkit/schema/projections/characterOperationalState'
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
  readCharacterPlayRow
} from './stateDocuments'
import { loadCharacterSheet } from './sheetPreparation'
import {
  characterSheetLiveAuthorityReadInputSchema,
  characterSheetLiveAuthorityDtoSchema
} from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { readLiveCampaignAuthority } from '../liveSessions/authorityGuard'

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
  const [play, build, notes, groups] = await Promise.all([
    readCharacterPlayRow(ctx, head.id),
    ctx.db
      .query('characterBuildStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', head.id))
      .unique(),
    readCharacterCollection(ctx, 'characterNotes', head.id),
    readCharacterCollection(ctx, 'characterNoteGroups', head.id)
  ])
  if (play.userId !== head.userId || play.characterId !== head.id)
    throw new Error('Stored Character identity mismatch.')
  readCharacterPlay(play)
  if (!build) throw new Error('Stored Character build state is unavailable.')
  const { _id, _creationTime, ...buildFields } = build
  const fields = readCharacterBuildFields(head.id, buildFields)
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

/** The Character owner or Campaign GM can route play without loading mechanics or owned collections. */
export const liveAuthority = query({
  args: zodToConvexFields(characterSheetLiveAuthorityReadInputSchema.shape),
  returns: v.union(v.null(), zodToConvex(characterSheetLiveAuthorityDtoSchema)),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { id: lookupId, campaignId } = characterSheetLiveAuthorityReadInputSchema.parse(args)
    const id = await resolveCharacterId(ctx, lookupId)
    const head = id ? await readCharacterHead(ctx, id) : null
    if (!head) return null
    if (campaignId) {
      const reader = await readCampaignCharacterReader(ctx, campaignId, head.id, userId)
      if (reader.party) return null
      const authority = await requireCampaignCharacterAuthority(ctx, campaignId, head.id, userId)
      if (authority.assignment.userId !== head.userId)
        throw new Error('Stored Campaign Character assignment mismatch.')
    } else if (head.userId !== userId) return null
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
