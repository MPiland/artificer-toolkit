import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import {
  characterStoredHeadSchema,
  characterStoredPlayStateSchema
} from '@artificer-toolkit/schema/projections/characterPersistence'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { summarizeCharacterSheetCommand } from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import { assertCampaignGmSheetCommandAllowed } from '@artificer-toolkit/rules-runtime/character/sheetCommandValidation'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignCharacterAuthority } from '../campaigns/characterState'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { resolveCharacterId } from './documents'
import { readCharacterHead, readCharacterPlay, readCharacterPlayRow } from './stateDocuments'
import { readCharacterCampaign } from './sourceReads'
import { readCharacterCommandReplay, writeCharacterCommandReceipt } from './sheetCommandReceipts'
import { assertConvexOwnsCharacterPlay } from '../liveSessions/authorityGuard'
import { scheduleCharacterSheetSections } from './sheetSections'

/** Projection preferences replace only typed play state; current mechanical values stay intact. */
export async function executeCharacterPlayPreferenceCommand(
  ctx: MutationCtx,
  userId: string,
  lookupId: string,
  command: Extract<
    CharacterSheetCommandInputDto,
    { type: 'SET_INSPIRATION' | 'SET_PARTY_VISIBILITY' }
  >,
  campaignId?: string
) {
  const id = await resolveCharacterId(ctx, lookupId)
  const stored = id ? await readCharacterHead(ctx, id) : null
  if (!stored) throw new Error('Character Sheet is unavailable for the current user.')
  const { _id, _creationTime, ...headFields } = stored
  const head = characterStoredHeadSchema.parse(headFields)
  const authority = campaignId
    ? await requireCampaignCharacterAuthority(ctx, campaignId, head.id, userId)
    : null
  if (authority && authority.assignment.userId !== head.userId)
    throw new Error('Stored Campaign Character assignment mismatch.')
  if (head.userId !== userId) {
    if (!authority) throw new Error('Character Sheet is unavailable for the current user.')
    if (authority.campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    assertCampaignGmSheetCommandAllowed(command)
  }
  await assertConvexOwnsCharacterPlay(ctx, head.id)
  const campaign = await readCharacterCampaign(ctx, head, head.userId)
  const [draft, route, storedPlay] = await Promise.all([
    ctx.db
      .query('characterDrafts')
      .withIndex('by_characterId', (q) => q.eq('characterId', head.id))
      .unique(),
    readVisibleAuthoredRouteId(ctx, { subjectId: head.id }),
    readCharacterPlayRow(ctx, head.id)
  ])
  if (draft && draft.userId !== head.userId)
    throw new Error('Stored Character draft ownership mismatch.')
  if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== head.userId)
    throw new Error('Stored Character route identity mismatch.')
  if (head.status !== 'ACTIVE')
    throw new Error('Character requires Builder repair before the Sheet can be read.')
  const { _id: playId, _creationTime: _playCreationTime, ...playFields } = storedPlay
  const play = characterStoredPlayStateSchema.parse(playFields)
  if (play.characterId !== head.id || play.userId !== head.userId)
    throw new Error('Stored Character identity mismatch.')
  const state = readCharacterPlay(play)
  const scope = {
    characterId: head.id,
    userId,
    command,
    streamVersion: play.streamVersion,
    contentMaturity: campaign?.contentMaturity ?? null,
    viewer: head.userId === userId ? ('CHARACTER_OWNER' as const) : ('CAMPAIGN_OWNER' as const)
  }
  const replay = await readCharacterCommandReplay(ctx, scope)
  if (replay) return replay
  if (command.expectedVersion !== play.streamVersion)
    throw new Error('Character Sheet changed; refresh before applying this command.')
  if (command.type === 'SET_INSPIRATION') {
    if (command.inspired) state.inspiration = true
    else delete state.inspiration
  } else state.partyVisibility = command.visibility
  // A preference changes play only, so only the play clock orders it.
  const occurredAt = new Date(Math.max(Date.now(), Date.parse(play.updatedAt) + 1)).toISOString()
  const streamVersion = play.streamVersion + 1
  await ctx.db.replace(
    playId,
    characterStoredPlayStateSchema.parse({
      ...play,
      state,
      checksum: checksumRuleDocument(JSON.parse(JSON.stringify(state))),
      streamVersion,
      updatedAt: occurredAt
    })
  )
  await scheduleCharacterSheetSections(ctx, head.id)
  return writeCharacterCommandReceipt(ctx, {
    ...scope,
    streamVersion,
    occurredAt,
    summary: summarizeCharacterSheetCommand(command)
  })
}
