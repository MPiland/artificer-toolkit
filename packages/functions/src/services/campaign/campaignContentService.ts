import { isDeepStrictEqual } from 'node:util'
import {
  createCampaignContentRepository,
  createCampaignRepository,
  createCharacterRepository,
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
  loadCharacterBuilderContext,
  resolveCharacterBuilder
} from '../character/builderService.js'
import { reconcileCharacterBuilderCharacter } from '../character/builderReconciliation.js'
import { parseCampaignAuthoredSnapshot } from '../character/campaignCharacterContent.js'
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

function toDto(
  version: CampaignContentVersion,
  maturity: 'STANDARD' | 'MATURE',
  privateAuthoring = false
): CampaignContentBindingDto {
  return {
    id: version.id,
    subjectKind: version.subjectKind,
    subjectId: version.subjectId,
    version: version.revision,
    snapshot: (privateAuthoring
      ? version.snapshot
      : presentAuthoredSnapshotText(
          version.snapshot,
          authoredNodeMap(version.subjectKind),
          maturity
        )) as CampaignContentBindingDto['snapshot'],
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

async function validateOwnedSnapshot(
  db: DBLike,
  input: SubmitCampaignContentVersionInput,
  userId: string
) {
  let parsed
  try {
    parsed = parseCampaignAuthoredSnapshot({
      id: input.subjectId,
      revision: input.version,
      snapshot: input.snapshot as Json,
      subjectId: input.subjectId,
      subjectKind: input.subjectKind
    })
  } catch {
    throw new CampaignValidationError('Campaign content snapshot is invalid.')
  }

  const repository = createCampaignContentRepository(db)
  const active = await repository.findActiveRootOwner({
    subjectKind: input.subjectKind,
    subjectId: input.subjectId
  })
  if (!active || active.ownerUserId !== userId || active.isMaster) {
    throw new CampaignValidationError('Only owned homebrew can be submitted to a Campaign.')
  }
  if (
    parsed.authored.id !== input.subjectId ||
    parsed.authored.userId !== userId ||
    parsed.authored.systemId !== active.systemId
  ) {
    throw new CampaignValidationError('Campaign content snapshot metadata does not match its root.')
  }
  return parsed
}

async function propagateApprovedVersion(
  db: DBLike,
  version: CampaignContentVersion
): Promise<void> {
  const repository = createCampaignContentRepository(db)
  const bindings = await repository.lockRootBindings({
    campaignId: version.campaignId,
    subjectKind: version.subjectKind,
    subjectId: version.subjectId
  })
  if (bindings.length === 0) return

  const snapshot = parseCampaignAuthoredSnapshot(version)
  const characters = createCharacterRepository(db)
  for (const binding of bindings) {
    await characters.findUpdatedAtByIdForUpdate(binding.characterId)
    const character = await characters.findAuthoredById(binding.characterId)
    if (!character) throw new CampaignConflictError('An affected Character no longer exists.')
    const context = await loadCharacterBuilderContext(db, character, [snapshot])
    const reconciled = await reconcileCharacterBuilderCharacter(db, character, character, context)
    const resolution = await resolveCharacterBuilder(db, reconciled, 'edit', context)
    if (!resolution.readiness.ready || !isDeepStrictEqual(reconciled, character)) {
      throw new CampaignConflictError(
        `Campaign content update conflicts with Character "${character.label}".`
      )
    }
  }

  await repository.replaceLockedRootBindings({
    campaignId: version.campaignId,
    subjectKind: version.subjectKind,
    subjectId: version.subjectId,
    contentVersionId: version.id,
    updatedAt: new Date().toISOString()
  })
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
  return versions
    .filter(
      (version) =>
        authority.membership.role === 'OWNER' ||
        version.state === 'APPROVED' ||
        version.authoredBy === userId
    )
    .map((version) => toDto(version, authority.campaign.contentMaturity))
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
    const parsed = await validateOwnedSnapshot(trx, input, userId)
    const repository = createCampaignContentRepository(trx)
    const nextRevision = await repository.lockNextRevision({
      campaignId: input.campaignId,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId
    })
    if (nextRevision === null) throw new CampaignNotFoundError()
    if (input.version !== nextRevision) {
      throw new CampaignConflictError('Campaign content version changed before submission.')
    }

    const approved = authority.membership.role === 'OWNER'
    const inserted = await repository.insertContentVersion({
      campaignId: input.campaignId,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      authoredBy: userId,
      revision: nextRevision,
      snapshot: parsed.authored as unknown as Json,
      ...(approved
        ? { state: 'APPROVED' as const, approvedBy: userId, approvedAt: new Date().toISOString() }
        : { state: 'PENDING' as const })
    })
    if (approved) await propagateApprovedVersion(trx, inserted)
    return inserted
  })

  await broadcastContent(db, input.campaignId, version.id, 'CREATED', version.updatedAt, {
    scope: version.state === 'APPROVED' ? 'TABLE' : 'OWNER'
  })
  return toDto(version, 'MATURE', true)
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
    if (reviewed.state === 'APPROVED') await propagateApprovedVersion(trx, reviewed)
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
    version,
    (await resolveCampaignAuthority(db, input.campaignId, userId)).campaign.contentMaturity
  )
}
