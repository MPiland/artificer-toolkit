import {
  createCampaignAdjustmentsRepository,
  createCampaignCharacterMechanicsProjectionRepository,
  createCampaignContentShareRepository,
  createCampaignRepository,
  createCampaignVehicleEvacuationRepository,
  createCampaignVehicleRepository,
  createCharacterBuilderDraftRepository,
  createCharacterRepository,
  createInventoryRepository,
  type CampaignContentShare,
  type CampaignRecord,
  type DBLike,
  type Json
} from '@artificer-toolkit/db'
import {
  campaignContentRemovalReceiptDtoSchema,
  type CampaignContentRemovalReceiptDto
} from '@artificer-toolkit/schema/api/campaigns'
import { characterBuilderDraftPayloadDtoSchema } from '@artificer-toolkit/schema/api/characters'
import {
  authoredSubjectKindSchema,
  type AuthoredSubjectKind
} from '@artificer-toolkit/schema/projections/identity'
import { z } from 'zod'

import {
  characterReferencesAuthoredRoot,
  type CharacterSourceLossTarget
} from '../character/builderReconciliation.js'
import {
  commitCharacterDraftOnlySourceLoss,
  commitCharacterDraftSourceLoss,
  commitCharacterStructuralReconciliation
} from '../character/characterStructuralReconciliationCommit.js'
import { resolveCharacterLiveSessionRuleContext } from '../character/campaignCharacterSheet.js'
import { prepareCampaignCharacterMechanicsProjection } from './campaignCharacterMechanicsProjection.js'

export class CampaignContentShareRemovalConflictError extends Error {
  constructor(message = 'Campaign content changed before removal completed.') {
    super(message)
    this.name = 'CampaignContentShareRemovalConflictError'
  }
}

type StoredReceipt = Omit<CampaignContentRemovalReceiptDto, 'eventId'>
const storedReceiptSchema = campaignContentRemovalReceiptDtoSchema.omit({ eventId: true })
const storedRemovalRequestSchema = z.object({
  operation: z.enum(['UNSHARE', 'MEMBER_LEFT', 'MEMBER_REMOVED', 'AUTHORED_DELETED']),
  shares: z.array(
    z.object({
      subjectKind: authoredSubjectKindSchema,
      subjectId: z.string().uuid(),
      sharedBy: z.string().uuid()
    })
  ),
  departingMembership: z
    .object({ userId: z.string().uuid(), expectedAccessStartedAt: z.string().datetime() })
    .nullable()
})
const storedRemovalEventSchema = z.object({
  request: storedRemovalRequestSchema,
  receipt: storedReceiptSchema
})

export interface CampaignContentShareRemovalSelection {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  sharedBy: string
}

export interface CampaignContentShareRemovalInput {
  actorUserId: string
  campaign: CampaignRecord
  commandId: string
  expectedCampaignVersion: number
  operation: 'UNSHARE' | 'MEMBER_LEFT' | 'MEMBER_REMOVED' | 'AUTHORED_DELETED'
  shares: readonly CampaignContentShareRemovalSelection[]
  departingMembership?: {
    userId: string
    expectedAccessStartedAt: string
  }
  knownDependentCharacterIds?: readonly string[]
}

export interface CampaignContentShareRemovalReplayExpectation {
  operation: CampaignContentShareRemovalInput['operation']
  shares?: readonly CampaignContentShareRemovalSelection[]
  departingMembership?: CampaignContentShareRemovalInput['departingMembership']
}

function timestamp(value: string | Date): string {
  return new Date(value).toISOString()
}

function shareKey(share: CampaignContentShareRemovalSelection): string {
  return `${share.subjectKind}:${share.subjectId}:${share.sharedBy}`
}

function canonicalShares(
  shares: readonly CampaignContentShareRemovalSelection[]
): CampaignContentShareRemovalSelection[] {
  return [
    ...new Map(
      shares
        .filter((share) => share.subjectId && share.sharedBy)
        .map((share) => [shareKey(share), share] as const)
    ).values()
  ].sort((left, right) => shareKey(left).localeCompare(shareKey(right)))
}

function storedRequest(
  input: CampaignContentShareRemovalReplayExpectation,
  shares: readonly CampaignContentShareRemovalSelection[]
): z.infer<typeof storedRemovalRequestSchema> {
  return {
    operation: input.operation,
    shares: canonicalShares(shares),
    departingMembership: input.departingMembership
      ? {
          userId: input.departingMembership.userId,
          expectedAccessStartedAt: timestamp(input.departingMembership.expectedAccessStartedAt)
        }
      : null
  }
}

function sameRequest(
  stored: z.infer<typeof storedRemovalRequestSchema>,
  expected: CampaignContentShareRemovalReplayExpectation
): boolean {
  if (stored.operation !== expected.operation) return false
  const expectedDeparting = expected.departingMembership
    ? {
        userId: expected.departingMembership.userId,
        expectedAccessStartedAt: timestamp(expected.departingMembership.expectedAccessStartedAt)
      }
    : null
  if (JSON.stringify(stored.departingMembership) !== JSON.stringify(expectedDeparting)) return false
  return (
    expected.shares === undefined ||
    JSON.stringify(stored.shares) === JSON.stringify(canonicalShares(expected.shares))
  )
}

function target(share: CampaignContentShareRemovalSelection): CharacterSourceLossTarget {
  return { subjectKind: share.subjectKind, subjectId: share.subjectId }
}

export async function findCampaignContentRemovalReceipt(
  db: DBLike,
  campaignId: string,
  commandId: string,
  actorUserId: string,
  expected: CampaignContentShareRemovalReplayExpectation
): Promise<CampaignContentRemovalReceiptDto | null> {
  const event = await createInventoryRepository(db).findCampaignEventByIdempotency(
    campaignId,
    commandId
  )
  if (!event) return null
  if (event.actorUserId !== actorUserId || event.kind !== 'CAMPAIGN_CONTENT_SHARES_REMOVED') {
    throw new CampaignContentShareRemovalConflictError('Command ID was already used.')
  }
  const payload = storedRemovalEventSchema.parse(event.payload)
  if (!sameRequest(payload.request, expected)) {
    throw new CampaignContentShareRemovalConflictError('Command ID was already used.')
  }
  return campaignContentRemovalReceiptDtoSchema.parse({ ...payload.receipt, eventId: event.id })
}

export async function removeCampaignContentSharesAndReconcileInTransaction(
  db: DBLike,
  input: CampaignContentShareRemovalInput
): Promise<CampaignContentRemovalReceiptDto> {
  const selected = canonicalShares(input.shares)
  const replay = await findCampaignContentRemovalReceipt(
    db,
    input.campaign.id,
    input.commandId,
    input.actorUserId,
    { ...input, shares: selected }
  )
  if (replay) return replay
  if (
    input.campaign.status !== 'ACTIVE' ||
    input.campaign.version !== input.expectedCampaignVersion
  ) {
    throw new CampaignContentShareRemovalConflictError()
  }

  const sharesRepository = createCampaignContentShareRepository(db)
  if (input.operation === 'UNSHARE' && selected.length !== 1) {
    throw new CampaignContentShareRemovalConflictError('Direct unshare requires one exact share.')
  }
  const shareLock = await sharesRepository.lockSharesForRemoval({
    campaignId: input.campaign.id,
    shares: selected
  })
  if (shareLock.missing.length > 0 || shareLock.locked.length !== selected.length) {
    throw new CampaignContentShareRemovalConflictError()
  }

  const campaignRepository = createCampaignRepository(db)
  const departing = input.departingMembership
    ? await campaignRepository.lockActiveMembershipForUpdate(
        input.campaign.id,
        input.departingMembership.userId
      )
    : null
  if (
    input.departingMembership &&
    (!departing ||
      timestamp(departing.accessStartedAt) !==
        timestamp(input.departingMembership.expectedAccessStartedAt))
  ) {
    throw new CampaignContentShareRemovalConflictError('Campaign membership changed.')
  }
  const membershipUsers = [
    ...new Set([input.actorUserId, ...shareLock.locked.map((share) => share.sharedBy)])
  ].sort()
  const memberships = new Map<
    string,
    Awaited<ReturnType<typeof campaignRepository.findMembership>>
  >()
  for (const userId of membershipUsers) {
    if (departing?.userId === userId) {
      memberships.set(userId, departing)
      continue
    }
    memberships.set(
      userId,
      input.operation === 'AUTHORED_DELETED'
        ? await campaignRepository.lockMembershipForShare(input.campaign.id, userId)
        : await campaignRepository.lockActiveMembershipForShare(input.campaign.id, userId)
    )
  }
  const actor = memberships.get(input.actorUserId)
  if (!actor || (input.operation !== 'AUTHORED_DELETED' && actor.status !== 'ACTIVE')) {
    throw new CampaignContentShareRemovalConflictError('Campaign membership is unavailable.')
  }
  if (input.operation === 'UNSHARE') {
    const share = shareLock.locked[0]
    if (!share || (actor.role !== 'OWNER' && share.sharedBy !== input.actorUserId)) {
      throw new CampaignContentShareRemovalConflictError('The actor cannot remove this share.')
    }
  } else if (input.operation === 'MEMBER_LEFT' || input.operation === 'MEMBER_REMOVED') {
    if (!departing || departing.role !== 'PLAYER') {
      throw new CampaignContentShareRemovalConflictError('Only an active player may depart.')
    }
    if (input.operation === 'MEMBER_LEFT' && input.actorUserId !== departing.userId) {
      throw new CampaignContentShareRemovalConflictError(
        'A player may only leave their own membership.'
      )
    }
    if (input.operation === 'MEMBER_REMOVED' && actor.role !== 'OWNER') {
      throw new CampaignContentShareRemovalConflictError(
        'Only the Campaign owner may remove a member.'
      )
    }
  } else if (
    input.departingMembership ||
    shareLock.locked.some((share) => share.sharedBy !== input.actorUserId)
  ) {
    throw new CampaignContentShareRemovalConflictError(
      "Authored deletion may remove only the deleting author's shares."
    )
  }

  const assignmentCharacterIds = (
    await campaignRepository.listAssignmentCharacterIds(input.campaign.id)
  ).sort()
  const knownDependentCharacterIds = new Set(input.knownDependentCharacterIds ?? [])
  if (knownDependentCharacterIds.size > 0 && input.operation !== 'AUTHORED_DELETED') {
    throw new CampaignContentShareRemovalConflictError(
      'Known authored dependents are valid only for authored deletion.'
    )
  }
  if (
    [...knownDependentCharacterIds].some(
      (characterId) => !assignmentCharacterIds.includes(characterId)
    )
  ) {
    throw new CampaignContentShareRemovalConflictError(
      'An authored dependent is no longer assigned to this Campaign.'
    )
  }
  const characters = createCharacterRepository(db)
  const candidates: Array<{
    characterId: string
    snapshot: NonNullable<Awaited<ReturnType<typeof characters.findAuthoredById>>>
    row: NonNullable<Awaited<ReturnType<typeof characters.findById>>>
    canonicalTargets: CharacterSourceLossTarget[]
    draftTargets: CharacterSourceLossTarget[]
  }> = []
  const drafts = createCharacterBuilderDraftRepository(db)
  for (const characterId of assignmentCharacterIds) {
    const [snapshot, row] = await Promise.all([
      characters.findAuthoredById(characterId),
      characters.findById(characterId)
    ])
    if (!snapshot || !row) {
      throw new CampaignContentShareRemovalConflictError(
        `Assigned Character "${characterId}" is unavailable.`
      )
    }
    const canonicalTargets = shareLock.locked
      .map(target)
      .filter((entry) => characterReferencesAuthoredRoot(snapshot, entry))
    const draft = await drafts.findByCharacter({ characterId, userId: snapshot.userId })
    const draftCharacter = draft
      ? characterBuilderDraftPayloadDtoSchema.parse(draft.payload).character
      : null
    const draftTargets = draftCharacter
      ? shareLock.locked
          .map(target)
          .filter((entry) => characterReferencesAuthoredRoot(draftCharacter, entry))
      : []
    const vectorTargets = knownDependentCharacterIds.has(characterId)
      ? shareLock.locked.map(target)
      : []
    if (canonicalTargets.length > 0 || draftTargets.length > 0 || vectorTargets.length > 0) {
      candidates.push({
        characterId,
        snapshot,
        row,
        canonicalTargets: [
          ...new Map(
            [...canonicalTargets, ...vectorTargets].map((entry) => [
              `${entry.subjectKind}:${entry.subjectId}`,
              entry
            ])
          ).values()
        ],
        draftTargets
      })
    }
  }

  const vehicleDefinitionIds = shareLock.locked
    .filter((share) => share.subjectKind === 'VEHICLE')
    .map((share) => share.subjectId)
  const vehicles = await createCampaignVehicleRepository(db).listByDefinitionsForUpdate(
    input.campaign.id,
    vehicleDefinitionIds
  )
  const evacuation = createCampaignVehicleEvacuationRepository(db)
  const owners = await evacuation.lockOwners({
    campaignId: input.campaign.id,
    vehicleIds: vehicles.map((vehicle) => vehicle.id)
  })
  if (!owners.campaignOwner || owners.vehicleOwners.size !== vehicles.length) {
    throw new CampaignContentShareRemovalConflictError('Campaign Vehicle inventory is unavailable.')
  }
  await evacuation.lockOwnerGraphs([
    owners.campaignOwner.id,
    ...[...owners.vehicleOwners.values()].map((owner) => owner.id)
  ])

  const overlays = createCampaignCharacterMechanicsProjectionRepository(db)
  for (const candidate of candidates) {
    await overlays.lockAssignment({
      campaignId: input.campaign.id,
      characterId: candidate.characterId
    })
  }
  for (const candidate of candidates) {
    if (!(await characters.findUpdatedAtByIdForUpdate(candidate.characterId))) {
      throw new CampaignContentShareRemovalConflictError(
        `Character "${candidate.characterId}" changed before removal completed.`
      )
    }
  }

  const currentRoots = new Map<
    string,
    Awaited<ReturnType<typeof sharesRepository.lockCurrentRoot>>
  >()
  for (const share of shareLock.locked) {
    currentRoots.set(shareKey(share), await sharesRepository.lockCurrentRoot(share))
  }
  const affected = candidates.flatMap((candidate) => {
    const targets = [
      ...new Map(
        [...candidate.canonicalTargets, ...candidate.draftTargets].map((entry) => [
          `${entry.subjectKind}:${entry.subjectId}`,
          entry
        ])
      ).values()
    ].filter((entry) => {
      const share = shareLock.locked.find(
        (candidateShare) =>
          candidateShare.subjectKind === entry.subjectKind &&
          candidateShare.subjectId === entry.subjectId
      )
      if (!share) return false
      const root = currentRoots.get(shareKey(share))
      return !root || (!root.isMaster && root.ownerUserId !== candidate.snapshot.userId)
    })
    return targets.length > 0 ? [{ ...candidate, targets }] : []
  })
  const vehicleDefinitionsStillAvailable = new Set(
    shareLock.locked.flatMap((share) => {
      const root = currentRoots.get(shareKey(share))
      return share.subjectKind === 'VEHICLE' && root?.isMaster ? [share.subjectId] : []
    })
  )

  const removedShares: CampaignContentShare[] = []
  for (const share of shareLock.locked) {
    const removed = await sharesRepository.unshareRootExpectingAuthor(share)
    if (!removed) throw new CampaignContentShareRemovalConflictError()
    removedShares.push(removed)
  }

  const adjustments = createCampaignAdjustmentsRepository(db)
  const evacuatedVehicles: CampaignContentRemovalReceiptDto['evacuatedVehicles'] = []
  for (const vehicle of vehicles) {
    if (vehicleDefinitionsStillAvailable.has(vehicle.vehicleDefinitionId)) continue
    const sourceOwner = owners.vehicleOwners.get(vehicle.id)
    if (!sourceOwner) throw new CampaignContentShareRemovalConflictError()
    const result = await evacuation.evacuate({
      campaignId: input.campaign.id,
      vehicleId: vehicle.id,
      sourceOwnerId: sourceOwner.id,
      destinationOwnerId: owners.campaignOwner.id
    })
    await adjustments.insertCampaignEvent({
      campaignId: input.campaign.id,
      actorUserId: input.actorUserId,
      kind: 'CAMPAIGN_VEHICLE_EVACUATED',
      visibility: 'OWNER',
      payload: {
        reason: input.operation === 'UNSHARE' ? 'UNSHARED' : input.operation,
        formerCampaignVehicleId: vehicle.id,
        authoredVehicleId: vehicle.vehicleDefinitionId,
        transferredTopLevelItemIds: result.transferredTopLevelItemIds,
        transferredCurrencyGroupIds: result.transferredCurrencyGroupIds,
        currencyTransfers: result.currencyTransfers,
        sourceInventoryOwnerId: result.sourceOwnerId,
        destinationInventoryOwnerId: result.destinationOwnerId,
        sourceInventoryOwnerVersion: result.sourceOwnerVersion,
        destinationInventoryOwnerVersion: result.destinationOwnerVersion,
        resultingCampaignVersion: input.expectedCampaignVersion + 1
      } as unknown as Json
    })
    evacuatedVehicles.push({
      vehicleId: vehicle.id,
      vehicleDefinitionId: vehicle.vehicleDefinitionId,
      transferredTopLevelItemIds: result.transferredTopLevelItemIds,
      transferredCurrencyGroupIds: result.transferredCurrencyGroupIds
    })
  }

  const affectedCharacters: CampaignContentRemovalReceiptDto['affectedCharacters'] = []
  for (const candidate of affected) {
    const priorOverlayChecksum = await overlays.findCurrentChecksum({
      campaignId: input.campaign.id,
      characterId: candidate.characterId
    })
    const result =
      candidate.canonicalTargets.length === 0
        ? (await commitCharacterDraftOnlySourceLoss({
            db,
            characterId: candidate.characterId,
            userId: candidate.snapshot.userId,
            sourceLossTargets: candidate.targets
          }),
          {
            kind: candidate.row.status as 'ACTIVE' | 'DRAFT',
            character: candidate.snapshot,
            streamVersion: candidate.row.stream_version,
            draftOnly: true as const
          })
        : candidate.row.status === 'ACTIVE' && candidate.row.rule_pack_revision_id
          ? await commitCharacterStructuralReconciliation({
              db,
              expectedRuleRevisionId: candidate.row.rule_pack_revision_id,
              expectedStreamVersion: candidate.row.stream_version,
              snapshot: candidate.snapshot,
              sourceLossTargets: candidate.targets
            })
          : {
              kind: 'DRAFT' as const,
              ...(await commitCharacterDraftSourceLoss({
                db,
                expectedStreamVersion: candidate.row.stream_version,
                snapshot: candidate.snapshot,
                sourceLossTargets: candidate.targets
              }))
            }
    if (result.kind === 'ACTIVE' && !('draftOnly' in result)) {
      const campaignContext = await resolveCharacterLiveSessionRuleContext(
        db,
        result.character.id,
        input.campaign
      )
      if (!campaignContext) {
        throw new CampaignContentShareRemovalConflictError(
          `Character "${result.character.id}" lost its Campaign assignment.`
        )
      }
      const projection = await prepareCampaignCharacterMechanicsProjection({
        db,
        campaignId: input.campaign.id,
        character: result.character,
        characterStreamVersion: result.streamVersion,
        mechanics: result.mechanics,
        campaignAdjustments: campaignContext.adjustments,
        attunementSlotOverride: campaignContext.attunementSlotOverride
      })
      await overlays.publish({ expectedPriorOverlayChecksum: priorOverlayChecksum, projection })
    }
    await adjustments.insertCampaignEvent({
      campaignId: input.campaign.id,
      actorUserId: input.actorUserId,
      subjectCharacterId: candidate.characterId,
      kind: 'CAMPAIGN_CHARACTER_RECONCILED',
      visibility: 'SUBJECT',
      payload: {
        reason: input.operation,
        removedSources: candidate.targets,
        status: result.kind,
        streamVersion: result.streamVersion,
        draftOnly: 'draftOnly' in result
      } as unknown as Json
    })
    affectedCharacters.push({
      characterId: candidate.characterId,
      status: result.kind,
      streamVersion: result.streamVersion
    })
  }

  const nextCampaign = await campaignRepository.advanceCampaignVersion(
    input.campaign.id,
    input.expectedCampaignVersion
  )
  if (!nextCampaign) throw new CampaignContentShareRemovalConflictError()
  const stored: StoredReceipt = {
    campaignVersion: nextCampaign.version,
    removedShares: removedShares.map((share) => ({
      subjectKind: share.subjectKind,
      subjectId: share.subjectId,
      sharedBy: share.sharedBy
    })),
    affectedCharacters,
    evacuatedVehicles
  }
  const event = await adjustments.insertCampaignEvent({
    campaignId: input.campaign.id,
    actorUserId: input.actorUserId,
    subjectUserId: input.departingMembership?.userId,
    kind: 'CAMPAIGN_CONTENT_SHARES_REMOVED',
    visibility: 'OWNER',
    payload: {
      request: storedRequest(input, selected),
      receipt: stored
    } as Json,
    idempotencyKey: input.commandId
  })
  return campaignContentRemovalReceiptDtoSchema.parse({ ...stored, eventId: event.id })
}
