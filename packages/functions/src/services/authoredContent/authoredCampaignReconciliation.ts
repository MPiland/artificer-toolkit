import { randomUUID } from 'node:crypto'

import {
  createAccountEntitlementsRepository,
  createCampaignAdjustmentsRepository,
  createCampaignCharacterMechanicsProjectionRepository,
  createCampaignContentShareRepository,
  createCampaignRepository,
  createCampaignVehicleEvacuationRepository,
  createCampaignVehicleRepository,
  createCharacterBuilderDraftRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  type CampaignAssignmentRecord,
  type CampaignContentShare,
  type CampaignRecord,
  type CharacterBuilderDraft,
  type DBLike,
  type Json
} from '@artificer-toolkit/db'
import { characterBuilderDraftPayloadDtoSchema } from '@artificer-toolkit/schema/api/characters'
import type { AuthoredSubjectKind } from '@artificer-toolkit/schema/projections/identity'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

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
import { prepareCampaignCharacterMechanicsProjection } from '../campaign/campaignCharacterMechanicsProjection.js'
import { removeCampaignContentSharesAndReconcileInTransaction } from '../campaign/campaignContentShareRemoval.js'

type MutationKind = 'ACTIVATED' | 'DELETED'
type CharacterRepository = ReturnType<typeof createCharacterRepository>
type CharacterRow = NonNullable<Awaited<ReturnType<CharacterRepository['findById']>>>

interface AffectedCharacter {
  activeDependency: boolean
  assignment: CampaignAssignmentRecord | null
  canonicalReference: boolean
  draftReference: boolean
  row: CharacterRow
  snapshot: CharacterAuthored
}

interface DiscoveredMutationState {
  affectedCharacters: AffectedCharacter[]
  affectedOwnerDrafts: CharacterBuilderDraft[]
  campaignIds: string[]
  shares: CampaignContentShare[]
}

export interface AuthoredCampaignMutationPlan extends DiscoveredMutationState {
  campaigns: Map<string, CampaignRecord>
  kind: MutationKind
  ownerUserId: string
  subjectId: string
  subjectKind: AuthoredSubjectKind
}

export class AuthoredCampaignMutationConflictError extends Error {
  constructor(message = 'Authored content dependencies changed before mutation completed.') {
    super(message)
    this.name = 'AuthoredCampaignMutationConflictError'
  }
}

function target(input: {
  subjectId: string
  subjectKind: AuthoredSubjectKind
}): CharacterSourceLossTarget {
  return { subjectKind: input.subjectKind, subjectId: input.subjectId }
}

function shareKey(share: CampaignContentShare): string {
  return `${share.campaignId}:${share.subjectKind}:${share.subjectId}:${share.sharedBy}`
}

function characterKey(character: AffectedCharacter): string {
  return [
    character.snapshot.id,
    character.row.stream_version,
    character.activeDependency,
    character.canonicalReference,
    character.draftReference,
    character.assignment?.campaignId ?? '',
    character.assignment?.userId ?? ''
  ].join(':')
}

function draftKey(draft: CharacterBuilderDraft): string {
  return [
    draft.id,
    draft.characterId,
    draft.userId,
    draft.updatedAt,
    draft.baseActiveUpdatedAt ?? '',
    JSON.stringify(draft.payload)
  ].join(':')
}

function stateSignature(state: DiscoveredMutationState): string {
  return JSON.stringify({
    shares: state.shares.map(shareKey).sort(),
    campaigns: [...state.campaignIds].sort(),
    characters: state.affectedCharacters.map(characterKey).sort(),
    ownerDrafts: state.affectedOwnerDrafts.map(draftKey).sort()
  })
}

async function discoverMutationState(
  db: DBLike,
  input: {
    kind: MutationKind
    ownerUserId: string
    subjectId: string
    subjectKind: AuthoredSubjectKind
  }
): Promise<DiscoveredMutationState> {
  const sharesRepository = createCampaignContentShareRepository(db)
  const campaigns = createCampaignRepository(db)
  const characters = createCharacterRepository(db)
  const drafts = createCharacterBuilderDraftRepository(db)
  const mechanics = createCharacterMechanicsProjectionRepository(db)
  const shares = await sharesRepository.listByRoot(input)
  const shareCampaignIds = [...new Set(shares.map((share) => share.campaignId))].sort()
  if (input.kind === 'ACTIVATED') {
    return {
      affectedCharacters: [],
      affectedOwnerDrafts: [],
      campaignIds: shareCampaignIds,
      shares: [...shares].sort((left, right) => shareKey(left).localeCompare(shareKey(right)))
    }
  }
  const ownerDrafts = input.kind === 'DELETED' ? await drafts.listByUser(input.ownerUserId) : []
  const ownerDraftByCharacterId = new Map(
    ownerDrafts.map((draft) => [draft.characterId, draft] as const)
  )
  const ownerCharacterIds = (await characters.listByUser(input.ownerUserId)).map(
    (character) => character.id
  )
  const sharedCharacterIds = (
    await Promise.all(
      shareCampaignIds.map((campaignId) => campaigns.listAssignmentCharacterIds(campaignId))
    )
  ).flat()
  const candidateCharacterIds = [...new Set([...ownerCharacterIds, ...sharedCharacterIds])].sort()
  const activeDependencyIds = new Set(
    await mechanics.listCharacterIdsByAuthoredRoot({
      candidateCharacterIds,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId
    })
  )
  const affectedCharacters: AffectedCharacter[] = []
  const sourceTarget = target(input)
  for (const characterId of candidateCharacterIds) {
    const [snapshot, row] = await Promise.all([
      characters.findAuthoredById(characterId),
      characters.findById(characterId)
    ])
    if (!snapshot || !row) {
      if (ownerDraftByCharacterId.has(characterId) && !sharedCharacterIds.includes(characterId)) {
        continue
      }
      throw new AuthoredCampaignMutationConflictError(
        `Character "${characterId}" is unavailable during authored mutation.`
      )
    }
    const activeDependency = activeDependencyIds.has(characterId)
    const canonicalReference = characterReferencesAuthoredRoot(snapshot, sourceTarget)
    const draft =
      ownerDraftByCharacterId.get(characterId) ??
      (await drafts.findByCharacter({ characterId, userId: snapshot.userId }))
    const draftReference = draft
      ? characterReferencesAuthoredRoot(
          characterBuilderDraftPayloadDtoSchema.parse(draft.payload).character,
          sourceTarget
        )
      : false
    if (!activeDependency && !canonicalReference && !draftReference) {
      continue
    }
    affectedCharacters.push({
      activeDependency,
      assignment: await campaigns.findCampaignByCharacter(characterId),
      canonicalReference,
      draftReference,
      row,
      snapshot
    })
  }
  const affectedOwnerDrafts = ownerDrafts.filter((draft) =>
    characterReferencesAuthoredRoot(
      characterBuilderDraftPayloadDtoSchema.parse(draft.payload).character,
      sourceTarget
    )
  )
  const campaignIds = [
    ...new Set([
      ...shareCampaignIds,
      ...affectedCharacters.flatMap((character) =>
        character.assignment ? [character.assignment.campaignId] : []
      )
    ])
  ].sort()
  return {
    affectedCharacters: affectedCharacters.sort((left, right) =>
      left.snapshot.id.localeCompare(right.snapshot.id)
    ),
    affectedOwnerDrafts: affectedOwnerDrafts.sort((left, right) => left.id.localeCompare(right.id)),
    campaignIds,
    shares: [...shares].sort((left, right) => shareKey(left).localeCompare(shareKey(right)))
  }
}

async function lockMutationDependencies(
  db: DBLike,
  state: DiscoveredMutationState,
  kind: MutationKind
): Promise<Map<string, CampaignRecord>> {
  const campaignRepository = createCampaignRepository(db)
  const sharesRepository = createCampaignContentShareRepository(db)
  const overlays = createCampaignCharacterMechanicsProjectionRepository(db)
  const characters = createCharacterRepository(db)
  const drafts = createCharacterBuilderDraftRepository(db)
  const lockedCampaigns = new Map<string, CampaignRecord>()
  for (const campaignId of state.campaignIds) {
    const campaign = await campaignRepository.lockCampaign(campaignId)
    if (!campaign) {
      throw new AuthoredCampaignMutationConflictError(`Campaign "${campaignId}" is unavailable.`)
    }
    lockedCampaigns.set(campaignId, campaign)
  }

  if (kind === 'ACTIVATED') {
    const locked = await sharesRepository.lockSharesForActivation(state.shares)
    if (locked.missing.length > 0 || locked.locked.length !== state.shares.length) {
      throw new AuthoredCampaignMutationConflictError('Campaign content shares changed.')
    }
  } else {
    for (const campaignId of [...new Set(state.shares.map((share) => share.campaignId))].sort()) {
      const selected = state.shares.filter((share) => share.campaignId === campaignId)
      const locked = await sharesRepository.lockSharesForRemoval({ campaignId, shares: selected })
      if (locked.missing.length > 0 || locked.locked.length !== selected.length) {
        throw new AuthoredCampaignMutationConflictError('Campaign content shares changed.')
      }
    }
  }

  for (const share of state.shares) {
    const membership = await campaignRepository.lockMembershipForShare(
      share.campaignId,
      share.sharedBy
    )
    if (!membership || membership.userId !== share.sharedBy) {
      throw new AuthoredCampaignMutationConflictError('Campaign sharing membership changed.')
    }
  }

  if (kind === 'DELETED') {
    const vehicleRepository = createCampaignVehicleRepository(db)
    const evacuation = createCampaignVehicleEvacuationRepository(db)
    for (const campaignId of [...new Set(state.shares.map((share) => share.campaignId))].sort()) {
      const vehicleDefinitionIds = state.shares
        .filter((share) => share.campaignId === campaignId && share.subjectKind === 'VEHICLE')
        .map((share) => share.subjectId)
      const vehicles = await vehicleRepository.listByDefinitionsForUpdate(
        campaignId,
        vehicleDefinitionIds
      )
      const owners = await evacuation.lockOwners({
        campaignId,
        vehicleIds: vehicles.map((vehicle) => vehicle.id)
      })
      if (!owners.campaignOwner || owners.vehicleOwners.size !== vehicles.length) {
        throw new AuthoredCampaignMutationConflictError(
          'Campaign Vehicle inventory is unavailable.'
        )
      }
      await evacuation.lockOwnerGraphs([
        owners.campaignOwner.id,
        ...[...owners.vehicleOwners.values()].map((owner) => owner.id)
      ])
    }
  }

  for (const character of [...state.affectedCharacters].sort((left, right) => {
    const leftKey = `${left.assignment?.campaignId ?? ''}:${left.snapshot.id}`
    const rightKey = `${right.assignment?.campaignId ?? ''}:${right.snapshot.id}`
    return leftKey.localeCompare(rightKey)
  })) {
    if (character.assignment) {
      await overlays.lockAssignment({
        campaignId: character.assignment.campaignId,
        characterId: character.snapshot.id
      })
    }
  }
  for (const character of state.affectedCharacters) {
    if (!(await characters.findUpdatedAtByIdForUpdate(character.snapshot.id))) {
      throw new AuthoredCampaignMutationConflictError(
        `Character "${character.snapshot.id}" is unavailable.`
      )
    }
  }
  if (state.affectedOwnerDrafts.length > 0) {
    const lockedDrafts = await drafts.lockByIds({
      draftIds: state.affectedOwnerDrafts.map((draft) => draft.id),
      userId: state.affectedOwnerDrafts[0]?.userId ?? ''
    })
    if (
      lockedDrafts.length !== state.affectedOwnerDrafts.length ||
      JSON.stringify(lockedDrafts.map(draftKey).sort()) !==
        JSON.stringify(state.affectedOwnerDrafts.map(draftKey).sort())
    ) {
      throw new AuthoredCampaignMutationConflictError('Character Builder drafts changed.')
    }
  }
  return lockedCampaigns
}

export async function prepareAuthoredCampaignMutation(
  db: DBLike,
  input: {
    kind: MutationKind
    ownerUserId: string
    subjectId: string
    subjectKind: AuthoredSubjectKind
  }
): Promise<AuthoredCampaignMutationPlan> {
  await createAccountEntitlementsRepository(db).lockTier(input.ownerUserId)
  const initial = await discoverMutationState(db, input)
  const campaigns = await lockMutationDependencies(db, initial, input.kind)
  const locked = await discoverMutationState(db, input)
  if (stateSignature(initial) !== stateSignature(locked)) {
    throw new AuthoredCampaignMutationConflictError()
  }
  return { ...input, ...locked, campaigns }
}

export async function assertAuthoredCampaignMutationPlanCurrent(
  db: DBLike,
  plan: AuthoredCampaignMutationPlan
): Promise<void> {
  const current = await discoverMutationState(db, plan)
  if (stateSignature(plan) !== stateSignature(current)) {
    throw new AuthoredCampaignMutationConflictError()
  }
}

async function reconcileCharacter(input: {
  actorUserId: string
  character: AffectedCharacter
  db: DBLike
  reason: 'AUTHORED_DELETED'
  sourceLossTargets: readonly CharacterSourceLossTarget[]
}): Promise<void> {
  const { character, db } = input
  const overlays = createCampaignCharacterMechanicsProjectionRepository(db)
  const priorOverlayChecksum = character.assignment
    ? await overlays.findCurrentChecksum({
        campaignId: character.assignment.campaignId,
        characterId: character.snapshot.id
      })
    : null
  const result =
    input.sourceLossTargets.length > 0 &&
    !character.activeDependency &&
    !character.canonicalReference
      ? (await commitCharacterDraftOnlySourceLoss({
          db,
          characterId: character.snapshot.id,
          userId: character.snapshot.userId,
          sourceLossTargets: input.sourceLossTargets
        }),
        {
          kind: character.row.status as 'ACTIVE' | 'DRAFT',
          character: character.snapshot,
          streamVersion: character.row.stream_version,
          draftOnly: true as const
        })
      : character.row.status === 'ACTIVE' && character.row.rule_pack_revision_id
        ? await commitCharacterStructuralReconciliation({
            db,
            expectedRuleRevisionId: character.row.rule_pack_revision_id,
            expectedStreamVersion: character.row.stream_version,
            snapshot: character.snapshot,
            sourceLossTargets: input.sourceLossTargets
          })
        : {
            kind: 'DRAFT' as const,
            ...(await commitCharacterDraftSourceLoss({
              db,
              expectedStreamVersion: character.row.stream_version,
              snapshot: character.snapshot,
              sourceLossTargets: input.sourceLossTargets
            }))
          }
  if (result.kind === 'ACTIVE' && !('draftOnly' in result) && character.assignment) {
    const campaign = await createCampaignRepository(db).lockCampaign(
      character.assignment.campaignId
    )
    if (!campaign) throw new AuthoredCampaignMutationConflictError('Campaign is unavailable.')
    const campaignContext = await resolveCharacterLiveSessionRuleContext(
      db,
      result.character.id,
      campaign
    )
    if (!campaignContext) {
      throw new AuthoredCampaignMutationConflictError('Campaign assignment changed.')
    }
    const projection = await prepareCampaignCharacterMechanicsProjection({
      db,
      campaignId: campaign.id,
      character: result.character,
      characterStreamVersion: result.streamVersion,
      mechanics: result.mechanics,
      campaignAdjustments: campaignContext.adjustments,
      attunementSlotOverride: campaignContext.attunementSlotOverride
    })
    await overlays.publish({ expectedPriorOverlayChecksum: priorOverlayChecksum, projection })
  }
  if (character.assignment) {
    await createCampaignAdjustmentsRepository(db).insertCampaignEvent({
      campaignId: character.assignment.campaignId,
      actorUserId: input.actorUserId,
      subjectCharacterId: character.snapshot.id,
      kind: 'CAMPAIGN_CHARACTER_RECONCILED',
      visibility: 'SUBJECT',
      payload: {
        reason: input.reason,
        removedSources: input.sourceLossTargets,
        status: result.kind,
        streamVersion: result.streamVersion,
        draftOnly: 'draftOnly' in result
      } as unknown as Json
    })
  }
}

export async function reconcileAuthoredActivationInTransaction(input: {
  db: DBLike
  plan: AuthoredCampaignMutationPlan
  versionId: string
}): Promise<void> {
  const sourceTarget = target(input.plan)
  const affectedCampaignIds = new Set(input.plan.shares.map((share) => share.campaignId))
  const adjustments = createCampaignAdjustmentsRepository(input.db)
  const campaigns = createCampaignRepository(input.db)
  for (const campaignId of [...affectedCampaignIds].sort()) {
    const campaign = input.plan.campaigns.get(campaignId)
    if (!campaign) throw new AuthoredCampaignMutationConflictError('Campaign changed.')
    await adjustments.insertCampaignEvent({
      campaignId,
      actorUserId: input.plan.ownerUserId,
      kind: 'CAMPAIGN_AUTHORED_CONTENT_ACTIVATED',
      visibility: 'OWNER',
      payload: {
        subjectKind: sourceTarget.subjectKind,
        subjectId: sourceTarget.subjectId,
        versionId: input.versionId
      } as unknown as Json
    })
    if (!(await campaigns.advanceCampaignVersion(campaignId, campaign.version))) {
      throw new AuthoredCampaignMutationConflictError('Campaign changed.')
    }
  }
}

export async function reconcileAuthoredDeletionInTransaction(input: {
  db: DBLike
  plan: AuthoredCampaignMutationPlan
}): Promise<void> {
  const sourceTarget = target(input.plan)
  const ownerCharacters = input.plan.affectedCharacters.filter(
    (character) => character.snapshot.userId === input.plan.ownerUserId
  )
  const ownerCharacterIds = new Set(ownerCharacters.map((character) => character.snapshot.id))
  for (const draft of input.plan.affectedOwnerDrafts) {
    if (ownerCharacterIds.has(draft.characterId)) continue
    await commitCharacterDraftOnlySourceLoss({
      db: input.db,
      characterId: draft.characterId,
      userId: draft.userId,
      sourceLossTargets: [sourceTarget]
    })
  }
  for (const character of ownerCharacters) {
    await reconcileCharacter({
      actorUserId: input.plan.ownerUserId,
      character,
      db: input.db,
      reason: 'AUTHORED_DELETED',
      sourceLossTargets: [sourceTarget]
    })
  }

  const shareCampaignIds = [...new Set(input.plan.shares.map((share) => share.campaignId))].sort()
  for (const campaignId of shareCampaignIds) {
    const campaign = input.plan.campaigns.get(campaignId)
    if (!campaign) throw new AuthoredCampaignMutationConflictError('Campaign changed.')
    await removeCampaignContentSharesAndReconcileInTransaction(input.db, {
      actorUserId: input.plan.ownerUserId,
      campaign,
      commandId: randomUUID(),
      expectedCampaignVersion: campaign.version,
      operation: 'AUTHORED_DELETED',
      shares: input.plan.shares
        .filter((share) => share.campaignId === campaignId)
        .map((share) => ({
          subjectKind: share.subjectKind,
          subjectId: share.subjectId,
          sharedBy: share.sharedBy
        })),
      knownDependentCharacterIds: input.plan.affectedCharacters
        .filter(
          (character) =>
            character.assignment?.campaignId === campaignId &&
            character.snapshot.userId !== input.plan.ownerUserId &&
            character.activeDependency
        )
        .map((character) => character.snapshot.id)
        .sort()
    })
  }

  const campaigns = createCampaignRepository(input.db)
  const ownerOnlyCampaignIds = [
    ...new Set(
      ownerCharacters.flatMap((character) =>
        character.assignment && !shareCampaignIds.includes(character.assignment.campaignId)
          ? [character.assignment.campaignId]
          : []
      )
    )
  ].sort()
  for (const campaignId of ownerOnlyCampaignIds) {
    const campaign = input.plan.campaigns.get(campaignId)
    if (!campaign || !(await campaigns.advanceCampaignVersion(campaignId, campaign.version))) {
      throw new AuthoredCampaignMutationConflictError('Campaign changed.')
    }
  }
}
