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
  loadCharacterBuilderContext,
  reconcileCharacterBuilderCharacter,
  resolveCharacterBuilder
} from '../character/builderService.js'
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

function toDto(version: CampaignContentVersion): CampaignContentBindingDto {
  return {
    id: version.id,
    subjectKind: version.subjectKind,
    subjectId: version.subjectId,
    version: version.revision,
    snapshot: version.snapshot as unknown as CampaignContentBindingDto['snapshot'],
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
  cursor: string
): Promise<void> {
  await broadcastCampaignInvalidation(db, campaignId, {
    scope: 'TABLE',
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
  return (await createCampaignContentRepository(db).listContentVersions(campaignId)).map(toDto)
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

  await broadcastContent(db, input.campaignId, version.id, 'CREATED', version.updatedAt)
  return toDto(version)
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

  await broadcastContent(db, input.campaignId, version.id, 'UPDATED', version.updatedAt)
  return toDto(version)
}
