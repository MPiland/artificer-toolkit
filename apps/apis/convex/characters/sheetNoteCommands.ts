import type { CharacterSheetNoteCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { applyCharacterNoteCommand } from '@artificer-toolkit/rules-runtime/character/sheetNotes'
import {
  clearEmptyStateArrays,
  summarizeCharacterSheetCommand
} from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import { assertCampaignGmSheetCommandAllowed } from '@artificer-toolkit/rules-runtime/character/sheetCommandValidation'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignCharacterAuthority } from '../campaigns/characterState'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { loadCharacterState, readCharacterRecord, resolveCharacterId } from './documents'
import { writeCharacterRecord } from './characterWrites'
import { readCharacterCampaign } from './sourceReads'
import { readCharacterCommandReplay, writeCharacterCommandReceipt } from './sheetCommandReceipts'

/** Notes change structure and the Sheet stream, while leaving mechanical facts unchanged. */
export async function executeCharacterNoteCommand(
  ctx: MutationCtx,
  userId: string,
  lookupId: string,
  command: CharacterSheetNoteCommandInputDto,
  campaignId?: string
) {
  const id = await resolveCharacterId(ctx, lookupId)
  const { active, draft } = id ? await loadCharacterState(ctx, id) : { active: null, draft: null }
  if (!active) throw new Error('Character Sheet is unavailable for the current user.')
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
  if (draft && draft.userId !== active.userId)
    throw new Error('Stored Character draft ownership mismatch.')
  const route = await readVisibleAuthoredRouteId(ctx, { subjectId: active.id })
  if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== active.userId)
    throw new Error('Stored Character route identity mismatch.')
  if (active.status !== 'ACTIVE')
    throw new Error('Character requires Builder repair before the Sheet can be read.')
  const scope = {
    characterId: active.id,
    userId,
    command,
    streamVersion: active.play.streamVersion,
    contentMaturity: campaign?.contentMaturity ?? null,
    viewer: 'CHARACTER_OWNER' as const
  }
  const replay = await readCharacterCommandReplay(ctx, scope)
  if (replay) return replay
  if (command.expectedVersion !== active.play.streamVersion)
    throw new Error('Character Sheet changed; refresh before applying this command.')
  const occurredAt = new Date(
    Math.max(Date.now(), Date.parse(active.updatedAt) + 1, Date.parse(active.play.updatedAt) + 1)
  ).toISOString()
  const document = characterAuthoredDtoSchema.parse(
    clearEmptyStateArrays(
      applyCharacterNoteCommand(readCharacterRecord(active), command, { now: () => occurredAt })
    )
  )
  const streamVersion = active.play.streamVersion + 1
  await writeCharacterRecord(ctx, {
    current: active,
    fields: { streamVersion, updatedAt: occurredAt },
    document,
    stats: {
      maximumHitPoints: active.play.maximumHitPoints,
      walkingSpeed: active.play.walkingSpeed
    }
  })
  return writeCharacterCommandReceipt(ctx, {
    ...scope,
    streamVersion,
    occurredAt,
    summary: summarizeCharacterSheetCommand(command)
  })
}
