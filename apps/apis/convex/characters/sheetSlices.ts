import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import {
  characterSheetNotesSliceDtoSchema,
  characterSheetSliceReadInputSchema,
  type CharacterSheetSliceReadInput,
  characterSheetSliceReadResultDtoSchema,
  characterSheetSliceResponseDtoSchema,
  type CharacterSheetSliceReadResultDto,
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
  readVerifiedCharacterBuild
} from './stateDocuments'
import { loadCharacterSheet } from './sheetPreparation'
import { characterSheetSection, readStoredCharacterSheetSections } from './sheetSections'
import { CharacterRequiresBuilderRepairError } from '@artificer-toolkit/rules-runtime/character/builderRepair'

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
  if (head.status !== 'ACTIVE') throw new CharacterRequiresBuilderRepairError()
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

async function readCharacterSheetSlice(
  ctx: QueryCtx,
  userId: string,
  { id, campaignId, slice }: CharacterSheetSliceReadInput
): Promise<CharacterSheetSliceResponseDto | null> {
  if (slice === 'NOTES') {
    const notes = await loadCharacterSheetNotes(ctx, userId, id, campaignId)
    return notes ? { slice, data: notes } : null
  }
  const characterId = await resolveCharacterId(ctx, id)
  if (!characterId) return null
  const reader = campaignId
    ? await readCampaignCharacterReader(ctx, campaignId, characterId, userId)
    : { loadAsUserId: userId, party: false }
  const [stored] =
    (await readStoredCharacterSheetSections(ctx, {
      userId: reader.loadAsUserId,
      lookupId: characterId,
      campaignId,
      party: reader.party,
      sections: [characterSheetSection.slice(slice)],
      whileQueued: true
    })) ?? []
  if (stored !== undefined) return characterSheetSliceResponseDtoSchema.parse(stored)
  const current = await loadCharacterSheet(ctx, reader.loadAsUserId, characterId, campaignId)
  if (!current) return null
  if (reader.party && !current.sheetState.partyVisibility.sheet)
    throw new Error('Assigned Character not found.')
  const projected = projectCharacterSheetForViewer(
    current.sheet,
    reader.party ? { ...current.campaignContext, viewer: 'PARTY_MEMBER' } : current.campaignContext
  )
  return characterSheetSliceResponseDtoSchema.parse(projectCharacterSheetSlice(projected, slice))
}

/**
 * The one home of the repair answer: every Sheet read refuses a Character needing Builder repair
 * with CharacterRequiresBuilderRepairError only after its authority passed, so the route can
 * offer the Builder from the head, whether the repair is settled to a draft or its step is queued.
 */
export const get = query({
  args: () => zodToConvexFields(characterSheetSliceReadInputSchema.shape),
  returns: () => v.union(v.null(), zodToConvex(characterSheetSliceReadResultDtoSchema)),
  handler: async (ctx, args): Promise<CharacterSheetSliceReadResultDto | null> => {
    const { userId } = await requireIdentity(ctx)
    const input = characterSheetSliceReadInputSchema.parse(args)
    try {
      return await readCharacterSheetSlice(ctx, userId, input)
    } catch (error) {
      if (!(error instanceof CharacterRequiresBuilderRepairError)) throw error
      const characterId = await resolveCharacterId(ctx, input.id)
      const head = characterId ? await readCharacterHead(ctx, characterId) : null
      const route = head ? await readVisibleAuthoredRouteId(ctx, { subjectId: head.id }) : null
      if (!head || !route) throw error
      return { slice: 'REPAIR_REQUIRED', data: { publicId: route.publicId, label: head.label } }
    }
  }
})
