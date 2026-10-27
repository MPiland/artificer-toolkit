import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  readCampaignCharacterState,
  requireCampaignCharacterAuthority
} from '../campaigns/characterState'
import { readCampaignCurrencyOptions } from '../campaigns/currencySystemDocuments'
import { readCharacterSheetState } from '../characters/sheetStateDocuments'
import {
  joinCharacterPlay,
  loadCharacterState,
  readCharacterHead,
  readVerifiedCharacterBuild,
  type CharacterRow
} from '../characters/stateDocuments'
import { readVisibleAuthoredRouteId } from '../content/routeIds'

/** The Campaign's assigned, ACTIVE Character in its System, checked from the Character head alone. */
async function requireAssignedActiveCharacterHead(
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
  const head = await readCharacterHead(ctx, characterId)
  if (!head || head.userId !== assignment.userId)
    throw new Error('Stored Campaign Character assignment mismatch.')
  if (head.status !== 'ACTIVE')
    throw new Error('Character requires Builder repair before the Sheet can be read.')
  if (head.systemId !== campaign.gameSystemId)
    throw new Error('Stored Campaign Character System mismatch.')
  const route = await readVisibleAuthoredRouteId(ctx, { subjectId: head.id })
  if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== head.userId)
    throw new Error('Stored Character route identity mismatch.')
  return head
}

/**
 * The assigned, ACTIVE Character's head, with its play record and build checksum verified but no
 * owned collection hydrated: a read that needs no rules inputs (an Encounter projection's Campaign
 * conditions) does not grow with the Character's inventory or spells.
 */
export async function requireIntactAssignedActiveCharacter(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  characterId: string,
  authorityUserId: string
) {
  const head = await requireAssignedActiveCharacterHead(ctx, campaign, characterId, authorityUserId)
  await readVerifiedCharacterBuild(ctx, head)
  return head
}

/** The Campaign's assigned, ACTIVE Character in its System; every Character rules read starts here. */
export async function readAssignedActiveCharacter(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  characterId: string,
  authorityUserId: string
) {
  const head = await requireAssignedActiveCharacterHead(ctx, campaign, characterId, authorityUserId)
  const [active, { draft }] = await Promise.all([
    joinCharacterPlay(ctx, head),
    loadCharacterState(ctx, characterId, false)
  ])
  if (draft && draft.userId !== active.userId)
    throw new Error('Stored Character draft ownership mismatch.')
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
