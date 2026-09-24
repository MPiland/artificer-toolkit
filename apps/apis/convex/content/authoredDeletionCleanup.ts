import { campaignStoredContentShareSchema } from '@artificer-toolkit/schema/projections/campaignContentPersistence'
import type { AuthoredSubjectKind } from '@artificer-toolkit/schema/projections/identity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CharacterSourceLossTarget } from '@artificer-toolkit/rules-runtime/character/characterSourceLoss'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { readCharacterRecord } from '../characters/documents'
import { retainCharacterEquipmentRules } from '../characters/acquiredEquipment'
import { retainCampaignEquipmentRules } from '../campaigns/acquiredEquipment'
import { finalizeCampaignContentRemoval } from '../campaigns/contentRemovalFinalization'
import {
  reconcileCharacterSourceLoss,
  reconcileCreateOnlyCharacterDraftSourceLoss,
  type CharacterSourceLossResult
} from '../characters/sourceLoss'

interface CampaignWork {
  campaign: Doc<'campaigns'>
  shares: Doc<'campaignContentShares'>[]
  characterResults: CharacterSourceLossResult[]
}

function presentShare(share: Doc<'campaignContentShares'>) {
  campaignStoredContentShareSchema.parse({
    campaignId: share.campaignId,
    subjectKind: share.subjectKind,
    subjectId: share.subjectId,
    sharedBy: share.sharedBy,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt
  })
  return {
    subjectKind: share.subjectKind,
    subjectId: share.subjectId,
    sharedBy: share.sharedBy
  }
}

async function collectOwnerCharacters(ctx: MutationCtx, userId: string, systemId: string) {
  const records: Doc<'characters'>[] = []
  let afterId: string | null = null
  do {
    const page = await ctx.db
      .query('characters')
      .withIndex('by_userId_systemId_id', (q) =>
        afterId
          ? q.eq('userId', userId).eq('systemId', systemId).gt('id', afterId)
          : q.eq('userId', userId).eq('systemId', systemId)
      )
      .order('asc')
      .take(100)
    records.push(...page)
    afterId = page.length === 100 ? page.at(-1)!.id : null
  } while (afterId !== null)
  return records
}

async function collectOwnerDrafts(ctx: MutationCtx, userId: string, systemId: string) {
  const records: Doc<'characterDrafts'>[] = []
  let afterCharacterId: string | null = null
  do {
    const page = await ctx.db
      .query('characterDrafts')
      .withIndex('by_userId_systemId_characterId', (q) =>
        afterCharacterId
          ? q.eq('userId', userId).eq('systemId', systemId).gt('characterId', afterCharacterId)
          : q.eq('userId', userId).eq('systemId', systemId)
      )
      .order('asc')
      .take(100)
    records.push(...page)
    afterCharacterId = page.length === 100 ? page.at(-1)!.characterId : null
  } while (afterCharacterId !== null)
  return records
}

async function collectShares(
  ctx: MutationCtx,
  subjectKind: AuthoredSubjectKind,
  subjectId: string
) {
  const records: Doc<'campaignContentShares'>[] = []
  let afterCampaignId: string | null = null
  do {
    const page = await ctx.db
      .query('campaignContentShares')
      .withIndex('by_subjectKind_subjectId_campaignId', (q) =>
        afterCampaignId
          ? q
              .eq('subjectKind', subjectKind)
              .eq('subjectId', subjectId)
              .gt('campaignId', afterCampaignId)
          : q.eq('subjectKind', subjectKind).eq('subjectId', subjectId)
      )
      .order('asc')
      .take(100)
    records.push(...page)
    afterCampaignId = page.length === 100 ? page.at(-1)!.campaignId : null
  } while (afterCampaignId !== null)
  return records
}

async function requireWork(
  ctx: MutationCtx,
  byCampaignId: Map<string, CampaignWork>,
  campaignId: string
) {
  const found = byCampaignId.get(campaignId)
  if (found) return found
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaignId))
    .unique()
  if (!campaign) throw new Error('Stored Campaign content share is unavailable.')
  const work: CampaignWork = { campaign, shares: [], characterResults: [] }
  byCampaignId.set(campaignId, work)
  return work
}

/** Capture acquired mechanics before the deleting producer removes source authority. */
export async function prepareAuthoredDeletionRetention(input: {
  ctx: MutationCtx
  ownerUserId: string
  systemId: string
  subjectKind: AuthoredSubjectKind
  subjectId: string
}) {
  const states = new Map<string, CharacterAuthored['state']>()
  if (input.subjectKind !== 'EQUIPMENT' && input.subjectKind !== 'SPELL') return states
  const records = new Map(
    (await collectOwnerCharacters(input.ctx, input.ownerUserId, input.systemId)).map((record) => [
      record.id,
      record
    ])
  )
  const campaignIds = new Set(
    (await collectShares(input.ctx, input.subjectKind, input.subjectId)).map(
      (share) => share.campaignId
    )
  )
  if (input.subjectKind === 'EQUIPMENT') {
    for await (const item of input.ctx.db
      .query('campaignPartyItems')
      .withIndex('by_equipmentId', (q) => q.eq('equipmentId', input.subjectId)))
      campaignIds.add(item.campaignId)
  }
  for (const id of [...campaignIds].sort()) {
    const campaign = await input.ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
    if (!campaign || campaign.gameSystemId !== input.systemId)
      throw new Error('Stored acquired Equipment Campaign mismatch.')
    await retainCampaignEquipmentRules(input.ctx, campaign, [input])
    for await (const assignment of input.ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', id))) {
      const record = await input.ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', assignment.characterId))
        .unique()
      if (!record || record.userId !== assignment.userId || record.systemId !== input.systemId)
        throw new Error('Stored acquired Equipment Character assignment mismatch.')
      records.set(record.id, record)
    }
  }
  for (const record of [...records.values()].sort((left, right) => left.id.localeCompare(right.id)))
    states.set(
      record.id,
      await retainCharacterEquipmentRules(
        input.ctx,
        readCharacterRecord(record) as CharacterAuthored
      )
    )
  return states
}

/** Trusted root-owner cleanup. The caller has already removed current source visibility. */
export async function reconcileAuthoredDeletionDependencies(input: {
  ctx: MutationCtx
  ownerUserId: string
  systemId: string
  subjectKind: AuthoredSubjectKind
  subjectId: string
  retainedStateByCharacterId?: ReadonlyMap<string, CharacterAuthored['state']>
}) {
  const { ctx, ownerUserId, systemId, subjectKind, subjectId } = input
  const target: CharacterSourceLossTarget = { subjectKind, subjectId }
  const [ownerCharacters, ownerDrafts, shares] = await Promise.all([
    collectOwnerCharacters(ctx, ownerUserId, systemId),
    collectOwnerDrafts(ctx, ownerUserId, systemId),
    collectShares(ctx, subjectKind, subjectId)
  ])
  const workByCampaignId = new Map<string, CampaignWork>()
  const charactersById = new Map(ownerCharacters.map((record) => [record.id, record]))
  const expectedCampaignByCharacterId = new Map<string, string>()

  for (const share of shares.sort((left, right) =>
    left.campaignId.localeCompare(right.campaignId)
  )) {
    if (share.sharedBy !== ownerUserId)
      throw new Error('Stored Campaign content share author mismatch.')
    const work = await requireWork(ctx, workByCampaignId, share.campaignId)
    if (work.campaign.gameSystemId !== systemId)
      throw new Error('Stored Campaign content share System mismatch.')
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', work.campaign.id).eq('userId', ownerUserId)
      )
      .unique()
    if (!membership || (membership.status !== 'ACTIVE' && membership.status !== 'LEFT'))
      throw new Error('Stored Campaign content share author membership mismatch.')
    work.shares.push(share)
    const assignments = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', work.campaign.id))
      .collect()
    for (const assignment of assignments.sort((left, right) =>
      left.characterId.localeCompare(right.characterId)
    )) {
      const expected = expectedCampaignByCharacterId.get(assignment.characterId)
      if (expected && expected !== work.campaign.id)
        throw new Error('Stored Campaign Character assignment mismatch.')
      expectedCampaignByCharacterId.set(assignment.characterId, work.campaign.id)
      if (charactersById.has(assignment.characterId)) continue
      const record = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', assignment.characterId))
        .unique()
      if (
        !record ||
        record.userId !== assignment.userId ||
        record.systemId !== work.campaign.gameSystemId
      )
        throw new Error('Stored Campaign Character assignment mismatch.')
      charactersById.set(record.id, record)
    }
  }

  for (const share of shares) await ctx.db.delete(share._id)
  for (const record of [...charactersById.values()].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    const result = await reconcileCharacterSourceLoss({
      ctx,
      record,
      targets: [target],
      stateAfterContextChange: input.retainedStateByCharacterId?.get(record.id)
    })
    if (!result) continue
    const expectedCampaignId = expectedCampaignByCharacterId.get(record.id)
    if (expectedCampaignId && result.campaign?.id !== expectedCampaignId)
      throw new Error('Stored Campaign Character assignment mismatch.')
    if (result.campaign) {
      const work = await requireWork(ctx, workByCampaignId, result.campaign.id)
      work.characterResults.push(result)
    }
  }
  for (const draft of ownerDrafts.sort((left, right) =>
    left.characterId.localeCompare(right.characterId)
  )) {
    if (charactersById.has(draft.characterId)) continue
    const active = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', draft.characterId))
      .unique()
    if (active) throw new Error('Stored Character draft ownership mismatch.')
    await reconcileCreateOnlyCharacterDraftSourceLoss({
      ctx,
      draft,
      targets: [target]
    })
  }

  for (const work of [...workByCampaignId.values()].sort((left, right) =>
    left.campaign.id.localeCompare(right.campaign.id)
  )) {
    const vehicles =
      subjectKind === 'VEHICLE' && work.shares.length > 0
        ? await ctx.db
            .query('campaignVehicles')
            .withIndex('by_campaignId_vehicleDefinitionId_id', (q) =>
              q.eq('campaignId', work.campaign.id).eq('vehicleDefinitionId', subjectId)
            )
            .collect()
        : []
    const commandId = work.shares.length > 0 ? crypto.randomUUID() : undefined
    await finalizeCampaignContentRemoval({
      ctx,
      campaign: work.campaign,
      actorUserId: ownerUserId,
      reason: 'AUTHORED_DELETED',
      removedShares: work.shares.map(presentShare),
      characterResults: work.characterResults,
      vehicles,
      commandId,
      inputFingerprint: commandId
        ? checksumCanonicalJson({
            operation: 'AUTHORED_DELETED',
            campaignId: work.campaign.id,
            subjectKind,
            subjectId,
            ownerUserId,
            commandId
          })
        : undefined
    })
  }
}
