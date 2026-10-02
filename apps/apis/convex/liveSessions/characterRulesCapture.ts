import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  readCampaignCharacterState,
  requireCampaignCharacterAuthority
} from '../campaigns/characterState'
import { readCampaignCurrencyOptions } from '../campaigns/currencySystemDocuments'
import { readCharacterSheetState } from '../characters/sheetStateDocuments'
import { loadCharacterState, type CharacterRow } from '../characters/stateDocuments'
import { readVisibleAuthoredRouteId } from '../content/routeIds'

/** The Campaign's assigned, ACTIVE Character in its System; every Character rules read starts here. */
export async function readAssignedActiveCharacter(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  characterId: string,
  authorityUserId: string
) {
  const { assignment } = await requireCampaignCharacterAuthority(
    ctx,
    campaign.id,
    characterId,
    authorityUserId
  )
  const { active, draft } = await loadCharacterState(ctx, characterId)
  if (!active || active.userId !== assignment.userId)
    throw new Error('Stored Campaign Character assignment mismatch.')
  if (draft && draft.userId !== active.userId)
    throw new Error('Stored Character draft ownership mismatch.')
  if (active.status !== 'ACTIVE')
    throw new Error('Character requires Builder repair before the Sheet can be read.')
  if (active.systemId !== campaign.gameSystemId)
    throw new Error('Stored Campaign Character System mismatch.')
  const route = await readVisibleAuthoredRouteId(ctx, { subjectId: active.id })
  if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== active.userId)
    throw new Error('Stored Character route identity mismatch.')
  return active
}

/**
 * An admitted Character's stored rules inputs; the room's Character read returns the same. Both
 * callers have already refused an archived Campaign, so the result states `ACTIVE`.
 */
export async function readStoredCharacterInputs(
  ctx: QueryCtx,
  active: CharacterRow,
  campaign: Doc<'campaigns'>
) {
  return {
    owner: active,
    sheetState: readCharacterSheetState(active),
    campaign: {
      id: campaign.id,
      status: 'ACTIVE' as const,
      contentMaturity: campaign.contentMaturity,
      attunementSlotOverride: campaign.attunementSlotOverride,
      state: (await readCampaignCharacterState(ctx, campaign.id, active.id)).state,
      currencyOptions: await readCampaignCurrencyOptions(ctx, campaign)
    }
  }
}
