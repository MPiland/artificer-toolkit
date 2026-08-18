import {
  createCampaignContentRepository,
  createCampaignRepository,
  createAuthoredVersionRepository,
  withTransaction,
  type CampaignContentVersion,
  type DBLike,
  type Json
} from '@artificer-toolkit/db'
import type {
  CampaignContentBindingDto,
  ReviewCampaignContentVersionInput,
  SubmitCampaignContentVersionInput
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
  CampaignConflictError,
  CampaignNotFoundError,
  CampaignValidationError,
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  resolveCampaignAuthority
} from './campaignService.js'
import { broadcastCampaignInvalidation } from './realtimeService.js'

function authoredNodeMap(
  subjectKind: CampaignContentVersion['subjectKind']
): NodeMap<Record<string, unknown>> {
  const nodeMap = {
    BACKGROUND: BACKGROUND_NODE_MAP,
    CLASS: CLASS_NODE_MAP,
    CREATURE: CREATURE_NODE_MAP,
    EQUIPMENT: EQUIPMENT_NODE_MAP,
    FEAT: FEAT_NODE_MAP,
    RACE: RACE_NODE_MAP,
    SPELL: SPELL_NODE_MAP,
    VEHICLE: VEHICLE_NODE_MAP
  }[subjectKind]
  return nodeMap as unknown as NodeMap<Record<string, unknown>>
}

async function toDto(
  db: DBLike,
  version: CampaignContentVersion,
  maturity: 'STANDARD' | 'MATURE',
  privateAuthoring = false
): Promise<CampaignContentBindingDto> {
  const authored = await createAuthoredVersionRepository(db).findVersion({
    subjectKind: version.subjectKind,
    subjectId: version.subjectId,
    versionId: version.authoredVersionId
  })
  if (
    !authored ||
    authored.authored.version !== version.authoredVersion ||
    authored.authored.checksum !== version.authoredChecksum ||
    authored.compiled.projectionChecksum !== version.compiledProjectionChecksum
  ) {
    throw new CampaignConflictError('Campaign content references an unavailable authored version.')
  }
  return {
    id: version.id,
    subjectKind: version.subjectKind,
    subjectId: version.subjectId,
    version: version.revision,
    authoredVersionId: version.authoredVersionId,
    authoredVersion: version.authoredVersion,
    authoredChecksum: version.authoredChecksum,
    compiledProjectionChecksum: version.compiledProjectionChecksum,
    document: (privateAuthoring
      ? authored.authored.document
      : presentAuthoredSnapshotText(
          authored.authored.document as unknown as Json,
          authoredNodeMap(version.subjectKind),
          maturity
        )) as CampaignContentBindingDto['document'],
    status: version.state,
    createdAt: version.createdAt,
    reviewedAt: version.approvedAt ?? version.rejectedAt
  }
}

async function lockCampaign(db: DBLike, campaignId: string): Promise<void> {
  if (!(await createCampaignRepository(db).lockCampaign(campaignId))) {
    throw new CampaignNotFoundError()
  }
}

async function resolveOwnedActiveVersion(
  db: DBLike,
  input: SubmitCampaignContentVersionInput,
  userId: string
) {
  const repository = createCampaignContentRepository(db)
  const active = await repository.findActiveRootOwner({
    subjectKind: input.subjectKind,
    subjectId: input.subjectId
  })
  if (!active || active.ownerUserId !== userId || active.isMaster) {
    throw new CampaignValidationError('Only owned homebrew can be submitted to a Campaign.')
  }
  const version = await createAuthoredVersionRepository(db).findActive({
    subjectKind: input.subjectKind,
    subjectId: input.subjectId
  })
  if (!version) {
    throw new CampaignValidationError('Owned homebrew has no active immutable version.')
  }
  if (
    version.authored.document.id !== input.subjectId ||
    version.authored.document.userId !== userId ||
    version.authored.document.systemId !== active.systemId
  ) {
    throw new CampaignValidationError('Authored version metadata does not match its root.')
  }
  return version
}

async function broadcastContent(
  db: DBLike,
  campaignId: string,
  versionId: string,
  event: 'CREATED' | 'UPDATED',
  cursor: string,
  routing: { scope: 'OWNER' | 'TABLE' } | { scope: 'USER'; recipientUserId: string }
): Promise<void> {
  await broadcastCampaignInvalidation(db, campaignId, {
    ...routing,
    entity: 'CONTENT',
    entityId: versionId,
    event,
    eventId: versionId,
    cursor
  })
}

export async function listCampaignContentVersions(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignContentBindingDto[]> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const versions = await createCampaignContentRepository(db).listContentVersions(campaignId)
  return Promise.all(
    versions
      .filter(
        (version) =>
          authority.membership.role === 'OWNER' ||
          version.state === 'APPROVED' ||
          version.authoredBy === userId
      )
      .map((version) => toDto(db, version, authority.campaign.contentMaturity))
  )
}

export async function submitCampaignContentVersion(
  db: DBLike,
  userId: string,
  input: SubmitCampaignContentVersionInput
): Promise<CampaignContentBindingDto> {
  const version = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    const authoredVersion = await resolveOwnedActiveVersion(trx, input, userId)
    const repository = createCampaignContentRepository(trx)
    const nextRevision = await repository.lockNextRevision({
      campaignId: input.campaignId,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId
    })
    if (nextRevision === null) throw new CampaignNotFoundError()
    if (input.expectedRevision !== nextRevision) {
      throw new CampaignConflictError('Campaign content version changed before submission.')
    }

    const approved = authority.membership.role === 'OWNER'
    const inserted = await repository.insertContentVersion({
      campaignId: input.campaignId,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      authoredBy: userId,
      revision: nextRevision,
      authoredVersionId: authoredVersion.authored.versionId,
      authoredVersion: authoredVersion.authored.version,
      authoredChecksum: authoredVersion.authored.checksum,
      compiledProjectionChecksum: authoredVersion.compiled.projectionChecksum,
      ...(approved
        ? { state: 'APPROVED' as const, approvedBy: userId, approvedAt: new Date().toISOString() }
        : { state: 'PENDING' as const })
    })
    return inserted
  })

  await broadcastContent(db, input.campaignId, version.id, 'CREATED', version.updatedAt, {
    scope: version.state === 'APPROVED' ? 'TABLE' : 'OWNER'
  })
  return toDto(db, version, 'MATURE', true)
}

export async function reviewCampaignContentVersion(
  db: DBLike,
  userId: string,
  input: ReviewCampaignContentVersionInput
): Promise<CampaignContentBindingDto> {
  const version = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    assertCampaignOwner(authority)
    const repository = createCampaignContentRepository(trx)
    const existing = await repository.findContentVersion({
      campaignId: input.campaignId,
      id: input.contentVersionId
    })
    if (!existing) throw new CampaignNotFoundError()
    if (existing.state !== 'PENDING') {
      throw new CampaignConflictError('Campaign content version has already been reviewed.')
    }
    const reviewedAt = new Date().toISOString()
    const reviewed =
      input.decision === 'APPROVE'
        ? await repository.approvePendingContentVersion({
            campaignId: input.campaignId,
            id: input.contentVersionId,
            reviewerUserId: userId,
            reviewedAt
          })
        : await repository.rejectPendingContentVersion({
            campaignId: input.campaignId,
            id: input.contentVersionId,
            reviewedAt
          })
    if (!reviewed) throw new CampaignConflictError()
    return reviewed
  })

  if (version.state === 'APPROVED') {
    await broadcastContent(db, input.campaignId, version.id, 'UPDATED', version.updatedAt, {
      scope: 'TABLE'
    })
  } else {
    await Promise.all([
      broadcastContent(db, input.campaignId, version.id, 'UPDATED', version.updatedAt, {
        scope: 'OWNER'
      }),
      broadcastContent(db, input.campaignId, version.id, 'UPDATED', version.updatedAt, {
        scope: 'USER',
        recipientUserId: version.authoredBy
      })
    ])
  }
  return toDto(
    db,
    version,
    (await resolveCampaignAuthority(db, input.campaignId, userId)).campaign.contentMaturity
  )
}
