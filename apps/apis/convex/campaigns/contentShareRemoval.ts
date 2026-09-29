import {
  campaignContentRemovalReceiptDtoSchema,
  unshareCampaignContentInputSchema,
  type CampaignContentRemovalReceiptDto,
  type UnshareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredContentShareSchema } from '@artificer-toolkit/schema/projections/campaignContentPersistence'
import type { AuthoredSubjectKind } from '@artificer-toolkit/schema/projections/identity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CharacterSourceLossTarget } from '@artificer-toolkit/rules-runtime/character/characterSourceLoss'
import type { MutationCtx } from '../_generated/server'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import type { Doc } from '../_generated/dataModel'
import { retainCampaignEquipmentRules } from './acquiredEquipment'
import { retainCharacterEquipmentRules } from '../characters/acquiredEquipment'
import { readCharacterRecord } from '../characters/documents'
import { readCharacterRow, type CharacterRow } from '../characters/stateDocuments'
import {
  reconcileAssignedCharacterSourceLoss,
  type CharacterSourceLossResult
} from '../characters/sourceLoss'
import { readOwnedCurrentPublication } from './contentAccess'
import { finalizeCampaignContentRemoval } from './contentRemovalFinalization'
import { readActiveCampaignMembers, requireCampaignAuthority } from './authority'
import { isImportRowVisible } from '../imports/visibility'

interface ShareSelection {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  sharedBy: string
}

const replayType = 'CAMPAIGN_CONTENT_SHARES_REMOVED'

function shareKey(share: ShareSelection): string {
  return `${share.subjectKind}:${share.subjectId}:${share.sharedBy}`
}

function presentShare(share: Doc<'campaignContentShares'>): ShareSelection {
  const {
    _id,
    _creationTime,
    campaignId: _campaignId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...selection
  } = share
  campaignStoredContentShareSchema.parse({
    campaignId: share.campaignId,
    subjectKind: share.subjectKind,
    subjectId: share.subjectId,
    sharedBy: share.sharedBy,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt
  })
  return selection
}

async function dependentShares(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  direct: Iterable<Doc<'campaignContentShares'>> | AsyncIterable<Doc<'campaignContentShares'>>
): Promise<Doc<'campaignContentShares'>[]> {
  const selected = new Map<string, Doc<'campaignContentShares'>>()
  const queue: Array<{ subjectKind: AuthoredSubjectKind; subjectId: string }> = []
  for await (const share of direct) {
    selected.set(shareKey(presentShare(share)), share)
    queue.push(share)
  }
  const visited = new Set<string>()
  while (queue.length > 0) {
    const current = queue.shift()!
    const rootKey = `${current.subjectKind}:${current.subjectId}`
    if (visited.has(rootKey)) continue
    visited.add(rootKey)
    let children: AsyncIterable<Doc<'authoredRoots'>> | Doc<'authoredRoots'>[] = []
    if (current.subjectKind === 'CLASS') {
      children = ctx.db
        .query('authoredRoots')
        .withIndex('by_system_kind_parentClassId', (q) =>
          q
            .eq('systemId', campaign.gameSystemId)
            .eq('subjectKind', 'CLASS')
            .eq('parentClassId', current.subjectId)
        )
    } else if (current.subjectKind === 'RACE') {
      children = ctx.db
        .query('authoredRoots')
        .withIndex('by_system_kind_parentRaceId', (q) =>
          q
            .eq('systemId', campaign.gameSystemId)
            .eq('subjectKind', 'RACE')
            .eq('parentRaceId', current.subjectId)
        )
    } else if (current.subjectKind === 'EQUIPMENT') {
      children = ctx.db
        .query('authoredRoots')
        .withIndex('by_system_kind_parentEquipmentId', (q) =>
          q
            .eq('systemId', campaign.gameSystemId)
            .eq('subjectKind', 'EQUIPMENT')
            .eq('parentEquipmentId', current.subjectId)
        )
    }
    for await (const child of children) {
      if (!(await isImportRowVisible(ctx, child.importJobId))) continue
      const share = await ctx.db
        .query('campaignContentShares')
        .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
          q
            .eq('campaignId', campaign.id)
            .eq('subjectKind', child.subjectKind)
            .eq('subjectId', child.id)
        )
        .unique()
      if (!share) continue
      const key = shareKey(presentShare(share))
      if (!selected.has(key)) {
        selected.set(key, share)
        queue.push({ subjectKind: share.subjectKind, subjectId: share.subjectId })
      }
    }
  }
  return [...selected.values()].sort((left, right) =>
    shareKey(presentShare(left)).localeCompare(shareKey(presentShare(right)))
  )
}

function eventPayload(event: Doc<'campaignEvents'>): CampaignContentRemovalReceiptDto {
  const raw: unknown = JSON.parse(event.payloadJson)
  if (!raw || typeof raw !== 'object' || !('receipt' in raw))
    throw new Error('Stored Campaign content-removal receipt is invalid.')
  return campaignContentRemovalReceiptDtoSchema.parse(raw.receipt)
}

/** Caller authenticates; exact prior results survive later loss of Campaign write authority. */
export async function unshareCampaignContentAndReconcile(input: {
  ctx: MutationCtx
  actorUserId: string
  request: UnshareCampaignContentInput
}): Promise<CampaignContentRemovalReceiptDto> {
  const { ctx, actorUserId, request } = input
  const campaignId = request.campaignId.toLowerCase()
  const sharedBy = request.sharedBy.toLowerCase()
  const commandId = request.commandId.toLowerCase()
  const fingerprint = checksumCanonicalJson({
    operation: 'UNSHARE',
    campaignId,
    subjectKind: request.subjectKind,
    subjectId: request.subjectId.toLowerCase(),
    sharedBy,
    expectedCampaignVersion: request.expectedCampaignVersion,
    commandId,
    actorUserId
  })
  const prior = await ctx.db
    .query('campaignEvents')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaignId).eq('commandId', commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.type !== replayType ||
      prior.actorUserId !== actorUserId ||
      prior.inputFingerprint !== fingerprint
    )
      throw new Error('This command ID was already used with different input.')
    return eventPayload(prior)
  }
  const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, actorUserId)
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (membership.role !== 'OWNER' && sharedBy !== actorUserId)
    throw new Error('You cannot remove this Campaign content share.')
  if (campaign.version !== request.expectedCampaignVersion)
    throw new Error('Campaign changed before this action completed.')
  const direct = await ctx.db
    .query('campaignContentShares')
    .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
      q
        .eq('campaignId', campaign.id)
        .eq('subjectKind', request.subjectKind)
        .eq('subjectId', request.subjectId.toLowerCase())
    )
    .unique()
  if (!direct || direct.sharedBy !== sharedBy)
    throw new Error('Campaign content share changed before removal completed.')
  return removeCampaignSharesAndReconcile({
    ctx,
    campaign,
    actorUserId,
    direct: [direct],
    reason: 'UNSHARE',
    commandId,
    inputFingerprint: fingerprint
  })
}

/** Caller authorizes the producer; this helper owns one atomic removal and Campaign version. */
export async function removeCampaignSharesAndReconcile(input: {
  ctx: MutationCtx
  campaign: Doc<'campaigns'>
  actorUserId: string
  direct: Iterable<Doc<'campaignContentShares'>> | AsyncIterable<Doc<'campaignContentShares'>>
  reason: 'UNSHARE' | 'MEMBER_LEFT' | 'MEMBER_REMOVED'
  departingMembership?: Pick<Doc<'campaignMemberships'>, 'userId' | 'accessStartedAt'>
  commandId: string
  inputFingerprint: string
}): Promise<CampaignContentRemovalReceiptDto> {
  const { ctx, campaign, actorUserId, reason, commandId, inputFingerprint } = input
  const shares = await dependentShares(ctx, campaign, input.direct)
  const removedShares = shares.map(presentShare)

  const members = await readActiveCampaignMembers(ctx, campaign)
  const membersById = new Map(members.map((member) => [member.userId, member]))
  const assignments = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .take(members.length + 1)
  if (assignments.length > members.length)
    throw new Error('Stored Campaign Character assignment capacity exceeded.')
  const characterRecords: CharacterRow[] = []
  for (const assignment of assignments.sort((left, right) =>
    left.characterId.localeCompare(right.characterId)
  )) {
    const member = membersById.get(assignment.userId)
    const record = await readCharacterRow(ctx, assignment.characterId)
    if (
      !member ||
      member.role !== 'PLAYER' ||
      !record ||
      record.userId !== assignment.userId ||
      record.systemId !== campaign.gameSystemId
    )
      throw new Error('Stored Campaign Character assignment mismatch.')
    readCharacterRecord(record)
    characterRecords.push(record)
  }
  const vehicleDefinitionIds = new Set(
    shares.filter((share) => share.subjectKind === 'VEHICLE').map((share) => share.subjectId)
  )
  const vehicles: Doc<'campaignVehicles'>[] = []
  for (const definitionId of [...vehicleDefinitionIds].sort()) {
    for await (const vehicle of ctx.db
      .query('campaignVehicles')
      .withIndex('by_campaignId_vehicleDefinitionId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('vehicleDefinitionId', definitionId)
      ))
      vehicles.push(vehicle)
  }

  const stateByCharacterId = new Map<
    string,
    Awaited<ReturnType<typeof retainCharacterEquipmentRules>>
  >()
  if (shares.length) {
    await retainCampaignEquipmentRules(ctx, campaign, shares)
    for (const record of characterRecords)
      stateByCharacterId.set(
        record.id,
        await retainCharacterEquipmentRules(
          ctx,
          readCharacterRecord(
            record
          ) as import('@artificer-toolkit/shared/subjects/authored').CharacterAuthored
        )
      )
  }
  for (const share of shares) await ctx.db.delete(share._id)
  const characterResults: CharacterSourceLossResult[] = []
  for (const record of characterRecords) {
    const targets: CharacterSourceLossTarget[] = []
    for (const share of removedShares) {
      if (
        !(await readOwnedCurrentPublication(ctx, share.subjectKind, share.subjectId, record.userId))
      )
        targets.push({ subjectKind: share.subjectKind, subjectId: share.subjectId })
    }
    if (targets.length === 0) continue
    const result = await reconcileAssignedCharacterSourceLoss({
      ctx,
      campaign,
      record,
      targets,
      stateAfterContextChange: stateByCharacterId.get(record.id)
    })
    if (!result) continue
    characterResults.push(result)
  }
  return finalizeCampaignContentRemoval({
    ctx,
    campaign,
    actorUserId,
    reason,
    departingMembership: input.departingMembership,
    removedShares,
    characterResults,
    vehicles,
    commandId,
    inputFingerprint
  })
}

/** Preserve the public unshare path while keeping source-loss code out of share-list reads. */
export const unshare = internalMutation({
  args: zodToConvexFields(unshareCampaignContentInputSchema.shape),
  returns: zodToConvex(campaignContentRemovalReceiptDtoSchema),
  handler: async (ctx, args): Promise<CampaignContentRemovalReceiptDto> => {
    const request = unshareCampaignContentInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return unshareCampaignContentAndReconcile({ ctx, actorUserId: userId, request })
  }
})
