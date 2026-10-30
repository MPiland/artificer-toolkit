import type { CharacterSheetNoteCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import { characterStoredHeadSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { readCharacterNoteState } from '@artificer-toolkit/schema/projections/characterOperationalState'
import { applyCharacterNoteCommand } from '@artificer-toolkit/rules-runtime/character/sheetNotes'
import { summarizeCharacterSheetCommand } from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import { assertCampaignGmSheetCommandAllowed } from '@artificer-toolkit/rules-runtime/character/sheetCommandValidation'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignCharacterAuthority } from '../campaigns/characterState'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { resolveCharacterId } from './documents'
import { readCharacterCollection, readCharacterHead, readCharacterPlayRow } from './stateDocuments'
import { writeCharacterNoteRecords } from './characterWrites'
import { readCharacterCampaign } from './sourceReads'
import { readCharacterCommandReplay, writeCharacterCommandReceipt } from './sheetCommandReceipts'

/**
 * Notes change structure and the Sheet stream, while leaving mechanical facts unchanged. A note edit
 * reads only the head, its notes and groups, the build counts, the play clock and its receipt.
 */
export async function executeCharacterNoteCommand(
  ctx: MutationCtx,
  userId: string,
  lookupId: string,
  command: CharacterSheetNoteCommandInputDto,
  campaignId?: string
) {
  const id = await resolveCharacterId(ctx, lookupId)
  const stored = id ? await readCharacterHead(ctx, id) : null
  if (!stored) throw new Error('Character Sheet is unavailable for the current user.')
  const { _id, _creationTime, ...headFields } = stored
  const active = characterStoredHeadSchema.parse(headFields)
  const authority = campaignId
    ? await requireCampaignCharacterAuthority(ctx, campaignId, active.id, userId)
    : null
  if (authority && authority.assignment.userId !== active.userId)
    throw new Error('Stored Campaign Character assignment mismatch.')
  if (authority && active.userId !== userId) {
    if (authority.campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    assertCampaignGmSheetCommandAllowed(command)
  }
  if (active.userId !== userId)
    throw new Error('Character Sheet is unavailable for the current user.')
  // Personal commands retain the implicit assignment and Campaign deletion fence too.
  const campaign = await readCharacterCampaign(ctx, active, userId)
  const [draft, route, play, build, notes, noteGroups] = await Promise.all([
    ctx.db
      .query('characterDrafts')
      .withIndex('by_characterId', (q) => q.eq('characterId', active.id))
      .unique(),
    readVisibleAuthoredRouteId(ctx, { subjectId: active.id }),
    readCharacterPlayRow(ctx, active.id),
    ctx.db
      .query('characterBuildStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', active.id))
      .unique(),
    readCharacterCollection(ctx, 'characterNotes', active.id),
    readCharacterCollection(ctx, 'characterNoteGroups', active.id)
  ])
  if (draft && draft.userId !== active.userId)
    throw new Error('Stored Character draft ownership mismatch.')
  if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== active.userId)
    throw new Error('Stored Character route identity mismatch.')
  if (active.status !== 'ACTIVE')
    throw new Error('Character requires Builder repair before the Sheet can be read.')
  if (play.characterId !== active.id || play.userId !== active.userId)
    throw new Error('Stored Character identity mismatch.')
  if (!build) throw new Error('Stored Character build state is unavailable.')
  const { _id: _buildId, _creationTime: _buildCreated, ...buildFields } = build
  const records = { characterNotes: notes, characterNoteGroups: noteGroups }
  const state = readCharacterNoteState(active.id, buildFields, records)
  const scope = {
    characterId: active.id,
    userId,
    command,
    streamVersion: play.streamVersion,
    contentMaturity: campaign?.contentMaturity ?? null,
    viewer: 'CHARACTER_OWNER' as const
  }
  const replay = await readCharacterCommandReplay(ctx, scope)
  if (replay) return replay
  if (command.expectedVersion !== play.streamVersion)
    throw new Error('Character Sheet changed; refresh before applying this command.')
  const occurredAt = new Date(
    Math.max(Date.now(), Date.parse(buildFields.updatedAt) + 1, Date.parse(play.updatedAt) + 1)
  ).toISOString()
  const next = applyCharacterNoteCommand({ state }, command, { now: () => occurredAt })
  const streamVersion = play.streamVersion + 1
  await writeCharacterNoteRecords(ctx, {
    head: stored,
    play,
    build: buildFields,
    records,
    next: next.state,
    streamVersion,
    updatedAt: occurredAt
  })
  return writeCharacterCommandReceipt(ctx, {
    ...scope,
    streamVersion,
    occurredAt,
    summary: summarizeCharacterSheetCommand(command)
  })
}
