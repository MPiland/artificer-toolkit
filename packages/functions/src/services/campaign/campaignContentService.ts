import {
  createAuthoredVersionRepository,
  createCampaignContentShareRepository,
  createCampaignRepository,
  withTransaction,
  type AuthoredVersionRecord,
  type CampaignContentShare,
  type DBLike,
  type Json
} from '@artificer-toolkit/db'
import type {
  CampaignContentShareDto,
  CampaignContentRemovalReceiptDto,
  ShareCampaignContentInput,
  UnshareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaigns'
import {
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  VEHICLE_NODE_MAP,
  type NodeMap
} from '@artificer-toolkit/shared/maps'
import { presentAuthoredSnapshotText } from '@artificer-toolkit/shared/campaign/textPolicy'
import {
  CampaignAccessError,
  CampaignNotFoundError,
  CampaignValidationError,
  assertActiveCampaignMember,
  assertCampaignWritable,
  getCampaignCapabilities,
  resolveCampaignAuthority
} from './campaignService.js'
import { broadcastCampaignInvalidation } from './realtimeService.js'
import { randomUUID } from 'node:crypto'
import {
  findCampaignContentRemovalReceipt,
  removeCampaignContentSharesAndReconcileInTransaction
} from './campaignContentShareRemoval.js'

function authoredNodeMap(
  subjectKind: CampaignContentShare['subjectKind']
): NodeMap<Record<string, unknown>> {
  return {
    BACKGROUND: BACKGROUND_NODE_MAP,
    CLASS: CLASS_NODE_MAP,
    CREATURE: CREATURE_NODE_MAP,
    EQUIPMENT: EQUIPMENT_NODE_MAP,
    FEAT: FEAT_NODE_MAP,
    RACE: RACE_NODE_MAP,
    SPELL: SPELL_NODE_MAP,
    VEHICLE: VEHICLE_NODE_MAP
  }[subjectKind] as unknown as NodeMap<Record<string, unknown>>
}

function toDto(
  share: CampaignContentShare,
  source: AuthoredVersionRecord,
  maturity: 'STANDARD' | 'MATURE',
  privateAuthoring = false
): CampaignContentShareDto {
  return {
    subjectKind: share.subjectKind,
    subjectId: share.subjectId,
    document: (privateAuthoring
      ? source.authored.document
      : presentAuthoredSnapshotText(
          source.authored.document as unknown as Json,
          authoredNodeMap(share.subjectKind),
          maturity
        )) as CampaignContentShareDto['document'],
    sharedBy: share.sharedBy,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt
  }
}

async function lockCampaign(db: DBLike, campaignId: string): Promise<void> {
  if (!(await createCampaignRepository(db).lockCampaign(campaignId))) {
    throw new CampaignNotFoundError()
  }
}

export async function listCampaignContentShares(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignContentShareDto[]> {
  return withTransaction(db, async (trx) => {
    const shares = createCampaignContentShareRepository(trx)
    const access = await shares.lockCampaignMemberForContentRead({ campaignId, userId })
    if (!access.campaignExists) throw new CampaignNotFoundError()
    if (!access.memberActive) throw new CampaignAccessError()

    const authority = await resolveCampaignAuthority(trx, campaignId, userId)
    assertActiveCampaignMember(authority)
    const current = await shares.listCurrentSources(campaignId)
    return current.map(({ share, source }) =>
      toDto(share, source, authority.campaign.contentMaturity)
    )
  })
}

export async function shareCampaignContent(
  db: DBLike,
  userId: string,
  input: ShareCampaignContentInput
): Promise<CampaignContentShareDto> {
  const result = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    const capabilities = getCampaignCapabilities(
      authority.campaign.status,
      authority.membership.role
    )
    if (!capabilities.shareOwnedContent) {
      throw new CampaignValidationError('You cannot share content with this Campaign.')
    }

    const shares = createCampaignContentShareRepository(trx)
    const identity = await shares.lockOwnedCurrentRoot({
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      ownerUserId: userId
    })
    if (!identity) {
      throw new CampaignValidationError('Only active homebrew you own can be shared.')
    }
    const source = await createAuthoredVersionRepository(trx).findActive({
      subjectKind: input.subjectKind,
      subjectId: input.subjectId
    })
    if (
      !source ||
      source.authored.versionId !== identity.versionId ||
      source.authored.version !== identity.version ||
      source.authored.checksum !== identity.checksum ||
      source.authored.document.id !== input.subjectId ||
      source.authored.document.userId !== userId
    ) {
      throw new CampaignValidationError('Owned homebrew current identity is unavailable.')
    }
    const share = await shares.shareRoot({
      campaignId: input.campaignId,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      sharedBy: userId
    })
    return { share, dto: toDto(share, source, 'MATURE', true) }
  })

  await broadcastCampaignInvalidation(db, input.campaignId, {
    scope: 'TABLE',
    entity: 'CONTENT',
    entityId: result.share.subjectId,
    event: 'CREATED',
    eventId: randomUUID(),
    cursor: result.share.updatedAt
  })
  return result.dto
}

export async function unshareCampaignContent(
  db: DBLike,
  userId: string,
  input: UnshareCampaignContentInput
): Promise<CampaignContentRemovalReceiptDto> {
  return withTransaction(db, async (trx) => {
    const campaign = await createCampaignRepository(trx).lockCampaign(input.campaignId)
    if (!campaign) throw new CampaignNotFoundError()
    const replay = await findCampaignContentRemovalReceipt(
      trx,
      input.campaignId,
      input.commandId,
      userId,
      {
        operation: 'UNSHARE',
        shares: [
          {
            subjectKind: input.subjectKind,
            subjectId: input.subjectId,
            sharedBy: input.sharedBy
          }
        ]
      }
    )
    if (replay) return replay
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    return removeCampaignContentSharesAndReconcileInTransaction(trx, {
      actorUserId: userId,
      campaign,
      commandId: input.commandId,
      expectedCampaignVersion: input.expectedCampaignVersion,
      operation: 'UNSHARE',
      shares: [
        {
          subjectKind: input.subjectKind,
          subjectId: input.subjectId,
          sharedBy: input.sharedBy
        }
      ]
    })
  })
}
