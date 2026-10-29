import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { requireCampaignCharacterAuthority } from '../campaigns/characterState'
import {
  joinCharacterPlay,
  loadCharacterState,
  readCharacterHead,
  readVerifiedCharacterBuild
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
