import { v } from 'convex/values'
import {
  campaignStoredVehicleSchema,
  vehicleCleanupSummarySchema
} from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import {
  campaignContentRemovalReceiptDtoSchema,
  type CampaignContentRemovalReceiptDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readOwnedCurrentPublication } from './contentAccess'
import { requireCampaignVehicleDefinition } from './vehicleSources'
import {
  campaignEventDtoSchema,
  campaignAdjustmentDtoSchema
} from '@artificer-toolkit/schema/api/campaignLiveState'
import { getCharacterSheetAdjustmentSlotKey } from '@artificer-toolkit/rules-runtime/character/sheetAdjustmentIdentity'
import { inventoryOwnerRefDtoSchema } from '@artificer-toolkit/schema/api/campaignInventory'
import { campaignVehicleLifecyclePayloadSchema } from '@artificer-toolkit/schema/api/campaignVehicles'
import {
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema,
  campaignStoredCurrencySystemSchema,
  campaignStoredCurrencyDenominationSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { campaignStoredAssignmentSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { campaignStoredCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterStatePersistence'
import { readCharacterRecord } from '../characters/stateDocuments'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'

const FIXTURE_NAME = 'Encounter execution fixture'
const MAX = {
  items: 100,
  groups: 100,
  balances: 200,
  events: 256,
  vehicles: 4,
  systems: 3,
  denominations: 8
}

function fixtureUsers(input: { ownerUserId: string; playerUserIds: [string, string] }) {
  const users = [input.ownerUserId, ...input.playerUserIds]
  if (new Set(users).size !== 3)
    throw new Error('Fixture custody users must be exactly three distinct accounts.')
  return new Set(users)
}

async function readCampaign(
  ctx: Parameters<typeof requireFixtureAccount>[0],
  ownerUserId: string,
  campaignId: string
) {
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaignId))
    .unique()
  if (
    !campaign ||
    campaign.ownerUserId !== ownerUserId ||
    campaign.name !== FIXTURE_NAME ||
    campaign.status !== 'ACTIVE'
  )
    throw new Error('Fixture Campaign ownership, name, or state mismatch.')
  return campaign
}

async function fixtureMemberships(
  ctx: Parameters<typeof requireFixtureAccount>[0],
  campaignId: string,
  ownerUserId: string,
  playerUserIds: [string, string]
) {
  const rows = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaignId))
    .take(4)
  if (
    rows.length > 3 ||
    rows.length !== 3 ||
    new Set(rows.map((row) => row.userId)).size !== rows.length
  )
    throw new Error('Fixture Campaign membership bounds mismatch.')
  const expected = new Map([
    [ownerUserId, 'OWNER'],
    [playerUserIds[0], 'PLAYER'],
    [playerUserIds[1], 'PLAYER']
  ])
  for (const row of rows) {
    if (expected.get(row.userId) !== row.role || row.status !== 'ACTIVE' || row.leftAt !== null)
      throw new Error('Fixture Campaign membership mismatch.')
  }
  return rows
}

export const admitFixturePlayers = internalMutation({
  args: {
    ownerUserId: v.string(),
    playerUserIds: v.array(v.string()),
    campaignId: v.string()
  },
  returns: v.null(),
  handler: async (ctx, input) => {
    if (input.playerUserIds.length !== 2)
      throw new Error('Fixture custody needs exactly two players.')
    const playerUserIds = input.playerUserIds as [string, string]
    fixtureUsers({ ownerUserId: input.ownerUserId, playerUserIds })
    await Promise.all(
      [input.ownerUserId, ...playerUserIds].map((userId) => requireFixtureAccount(ctx, userId))
    )
    const campaign = await readCampaign(ctx, input.ownerUserId, input.campaignId)
    const rows = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaign.id))
      .take(4)
    if (
      rows.length > 3 ||
      new Set(rows.map((row) => row.userId)).size !== rows.length ||
      rows.filter((row) => row.userId === input.ownerUserId).length !== 1
    )
      throw new Error('Fixture Campaign membership bounds or owner identity mismatch.')
    for (const row of rows) {
      if (row.userId !== input.ownerUserId && !playerUserIds.includes(row.userId))
        throw new Error('Fixture Campaign has an unexpected member.')
      if (row.role !== (row.userId === input.ownerUserId ? 'OWNER' : 'PLAYER'))
        throw new Error('Fixture membership role mismatch.')
      if (
        (row.status === 'ACTIVE') !== (row.leftAt === null) ||
        (row.userId === input.ownerUserId && row.status !== 'ACTIVE')
      )
        throw new Error('Fixture membership state mismatch.')
    }
    const admittedAt = new Date(
      Math.max(
        Date.now(),
        ...rows.flatMap((row) => [
          Date.parse(row.accessStartedAt),
          Date.parse(row.joinedAt),
          ...(row.leftAt ? [Date.parse(row.leftAt)] : [])
        ])
      ) + 1
    ).toISOString()
    for (const userId of playerUserIds) {
      const existing = rows.find((row) => row.userId === userId)
      if (existing?.status === 'ACTIVE') continue
      const membership = {
        campaignId: campaign.id,
        userId,
        role: 'PLAYER' as const,
        status: 'ACTIVE' as const,
        accessStartedAt: admittedAt,
        joinedAt: admittedAt,
        leftAt: null
      }
      if (existing) await ctx.db.replace(existing._id, membership)
      else await ctx.db.insert('campaignMemberships', membership)
    }
    return null
  }
})

export const removeFixtureState = internalMutation({
  args: {
    ownerUserId: v.string(),
    playerUserIds: v.array(v.string()),
    characterIds: v.array(v.string()),
    campaignId: v.string()
  },
  returns: v.null(),
  handler: async (ctx, input) => {
    if (input.playerUserIds.length !== 2 || input.characterIds.length !== 2)
      throw new Error('Fixture custody needs exactly two players and Characters.')
    const playerUserIds = input.playerUserIds as [string, string]
    const characterIds = input.characterIds as [string, string]
    fixtureUsers({ ownerUserId: input.ownerUserId, playerUserIds })
    if (new Set(characterIds).size !== 2)
      throw new Error('Fixture custody Characters must be distinct.')
    await Promise.all(
      [input.ownerUserId, ...playerUserIds].map((userId) => requireFixtureAccount(ctx, userId))
    )
    const campaign = await readCampaign(ctx, input.ownerUserId, input.campaignId)
    const memberships = await fixtureMemberships(ctx, campaign.id, input.ownerUserId, playerUserIds)
    const [
      assignments,
      overlays,
      characters,
      routes,
      inventories,
      items,
      groups,
      balances,
      vehicles,
      systems,
      denominations,
      events
    ] = await Promise.all([
      ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .take(3),
      ctx.db
        .query('campaignCharacterStates')
        .withIndex('by_campaignId_characterId', (q) => q.eq('campaignId', campaign.id))
        .take(3),
      Promise.all(
        characterIds.map((id) =>
          ctx.db
            .query('characters')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
        )
      ),
      Promise.all(
        characterIds.map((id) =>
          ctx.db
            .query('authoredRouteIds')
            .withIndex('by_subjectId', (q) => q.eq('subjectId', id))
            .unique()
        )
      ),
      ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .take(6),
      ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(MAX.items + 1),
      ctx.db
        .query('campaignPartyCurrencyGroups')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(MAX.groups + 1),
      ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(MAX.balances + 1),
      ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(MAX.vehicles + 1),
      ctx.db
        .query('campaignCurrencySystems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(MAX.systems + 1),
      ctx.db
        .query('campaignCurrencyDenominations')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(MAX.denominations + 1),
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(MAX.events + 1)
    ])
    if (
      [
        items.length > MAX.items,
        groups.length > MAX.groups,
        balances.length > MAX.balances,
        vehicles.length > MAX.vehicles,
        systems.length > MAX.systems,
        denominations.length > MAX.denominations,
        events.length > MAX.events
      ].some(Boolean)
    )
      throw new Error('Fixture custody row bounds exceeded.')
    for (const [index, character] of characters.entries()) {
      const route = routes[index]
      if (
        !character ||
        !route ||
        character.userId !== playerUserIds[index] ||
        character.systemId !== campaign.gameSystemId ||
        route.subjectKind !== 'CHARACTER' ||
        route.ownerUserId !== playerUserIds[index]
      )
        throw new Error('Fixture Character ownership or route mismatch.')
      readCharacterRecord(character)
    }
    const assignmentOwners = new Map([
      [characterIds[0], playerUserIds[0]],
      [characterIds[1], playerUserIds[1]]
    ])
    if (
      assignments.length !== 2 ||
      assignments.some((row) => {
        const stored = campaignStoredAssignmentSchema.parse(
          (({ _id, _creationTime, ...value }) => value)(row)
        )
        return assignmentOwners.get(stored.characterId) !== stored.userId
      })
    )
      throw new Error('Fixture Character assignment mismatch.')
    if (
      overlays.some((row) => {
        const { _id, _creationTime, ...stored } = row
        return (
          !characterIds.includes(row.characterId) ||
          !campaignStoredCharacterStateSchema.safeParse(stored).success
        )
      })
    )
      throw new Error('Fixture Character overlay mismatch.')
    if (
      inventories.length > 5 ||
      new Set(inventories.map((row) => row.vehicleId ?? 'PARTY')).size !== inventories.length
    )
      throw new Error('Fixture inventory owner bounds or identity mismatch.')
    for (const row of vehicles) {
      const { _id, _creationTime, ...stored } = row
      campaignStoredVehicleSchema.parse(stored)
    }
    for (const row of systems) {
      const { _id, _creationTime, ...stored } = row
      campaignStoredCurrencySystemSchema.parse(stored)
    }
    for (const row of denominations) {
      const { _id, _creationTime, ...stored } = row
      campaignStoredCurrencyDenominationSchema.parse(stored)
    }
    const vehicleIds = new Set(vehicles.map((row) => row.id))
    const itemById = new Map(items.map((row) => [row.id, row]))
    const groupById = new Map(groups.map((row) => [row.id, row]))
    const itemIds = new Set(items.map((row) => row.id))
    const groupIds = new Set(groups.map((row) => row.id))
    const systemIds = new Set(systems.map((row) => row.id))
    const denominationIds = new Set(denominations.map((row) => row.id))
    const denominationSystems = new Map(denominations.map((row) => [row.id, row.systemId]))
    if (
      [
        itemIds.size !== items.length,
        groupIds.size !== groups.length,
        new Set(balances.map((row) => row.id)).size !== balances.length
      ].some(Boolean)
    )
      throw new Error('Fixture custody identities are not unique.')
    for (const row of inventories) {
      const { _id, _creationTime, ...stored } = row
      campaignStoredPartyInventorySchema.parse(stored)
      if (row.vehicleId !== undefined && !vehicleIds.has(row.vehicleId))
        throw new Error('Fixture inventory Vehicle mismatch.')
    }
    for (const row of items) {
      const { _id, _creationTime, ...stored } = row
      campaignStoredPartyItemSchema.parse(stored)
      if (
        (row.vehicleId !== undefined && !vehicleIds.has(row.vehicleId)) ||
        (row.containerId !== null &&
          (!itemIds.has(row.containerId) ||
            itemById.get(row.containerId)?.vehicleId !== row.vehicleId))
      )
        throw new Error('Fixture item placement mismatch.')
    }
    for (const row of groups) {
      const { _id, _creationTime, ...stored } = row
      campaignStoredPartyCurrencyGroupSchema.parse(stored)
      if (
        (row.vehicleId !== undefined && !vehicleIds.has(row.vehicleId)) ||
        (row.containerId !== null &&
          (!itemIds.has(row.containerId) ||
            itemById.get(row.containerId)?.vehicleId !== row.vehicleId))
      )
        throw new Error('Fixture group placement mismatch.')
    }
    for (const row of balances) {
      const { _id, _creationTime, ...stored } = row
      campaignStoredPartyCurrencySchema.parse(stored)
      if (
        (row.vehicleId !== undefined && !vehicleIds.has(row.vehicleId)) ||
        (row.groupId !== undefined && !groupIds.has(row.groupId)) ||
        (row.groupId !== undefined && groupById.get(row.groupId)?.vehicleId !== row.vehicleId) ||
        (row.containerId !== null &&
          (!itemIds.has(row.containerId) ||
            itemById.get(row.containerId)?.vehicleId !== row.vehicleId)) ||
        (row.campaignCurrencySystemId !== undefined &&
          !systemIds.has(row.campaignCurrencySystemId)) ||
        (row.campaignCurrencySystemId !== undefined &&
          (!denominationIds.has(row.denominationId) ||
            denominationSystems.get(row.denominationId) !== row.campaignCurrencySystemId))
      )
        throw new Error('Fixture balance placement or namespace mismatch.')
    }
    for (const item of items) {
      const seen = new Set<string>()
      let containerId = item.containerId
      while (containerId !== null) {
        if (seen.has(containerId)) throw new Error('Fixture item container cycle.')
        seen.add(containerId)
        containerId = itemById.get(containerId)?.containerId ?? null
      }
    }
    const groupBalances = new Map<string, Set<string>>()
    for (const balance of balances) {
      if (balance.groupId === undefined) continue
      const key = `${balance.denominationId}|${balance.campaignCurrencySystemId ?? 'RULESET'}`
      const existing = groupBalances.get(balance.groupId) ?? new Set<string>()
      if (existing.has(key))
        throw new Error('Fixture currency group duplicates a qualified balance.')
      existing.add(key)
      groupBalances.set(balance.groupId, existing)
      const group = groupById.get(balance.groupId)
      if (!group || group.containerId !== balance.containerId)
        throw new Error('Fixture currency group placement mismatch.')
    }
    const cohort = fixtureUsers({
      ownerUserId: input.ownerUserId,
      playerUserIds
    })
    const storedEvents = events.map((row) => {
      const { _id, _creationTime, ...stored } = row
      return campaignStoredEventSchema.parse(stored)
    })
    const historicalVehicleIds = new Set(vehicleIds)
    const membershipByUserId = new Map(
      memberships.map((membership) => [membership.userId, membership])
    )
    const recognizedRemovalIds = new Set<string>()
    const recognizedEvacuationIds = new Set<string>()
    const authoredRemovals = new Map<
      string,
      { createdAt: number; receipt: CampaignContentRemovalReceiptDto }
    >()
    const departureRemovals = new Map<
      string,
      {
        reason: 'MEMBER_LEFT' | 'MEMBER_REMOVED'
        departingUserId: string
        departingCharacterId: string
        accessStartedAt: number
        createdAt: number
        receipt: CampaignContentRemovalReceiptDto
      }
    >()
    const evacuatedTopLevelItemIds = new Set<string>()
    const evacuatedCurrencyGroupIds = new Set<string>()
    const pendingVehicleCleanupIds = new Map<string, string>()
    for (const removal of storedEvents.filter(
      (event) => event.type === 'CAMPAIGN_CONTENT_SHARES_REMOVED'
    )) {
      const payload = campaignEventDtoSchema.shape.payload.parse(JSON.parse(removal.payloadJson))
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('Fixture Vehicle removal payload mismatch.')
      const receipt = campaignContentRemovalReceiptDtoSchema.parse(payload.receipt)
      const reason =
        payload.reason === 'MEMBER_LEFT' || payload.reason === 'MEMBER_REMOVED'
          ? payload.reason
          : null
      const authoredDeleted = payload.reason === 'AUTHORED_DELETED'
      const share = receipt.removedShares[0]
      const removalCreatedAt = Date.parse(removal.createdAt)
      if (reason) {
        const departingMembership = payload.departingMembership
        const departingUserId =
          departingMembership !== null &&
          typeof departingMembership === 'object' &&
          !Array.isArray(departingMembership) &&
          typeof departingMembership.userId === 'string'
            ? departingMembership.userId
            : null
        const departingAccessStartedAt =
          departingMembership !== null &&
          typeof departingMembership === 'object' &&
          !Array.isArray(departingMembership) &&
          typeof departingMembership.accessStartedAt === 'string'
            ? departingMembership.accessStartedAt
            : null
        const departedAt = departingAccessStartedAt
          ? Date.parse(departingAccessStartedAt)
          : Number.NaN
        const departureIndex = departingUserId ? playerUserIds.indexOf(departingUserId) : -1
        const membership = departingUserId ? membershipByUserId.get(departingUserId) : undefined
        if (
          !departingUserId ||
          departureIndex < 0 ||
          !membership ||
          !departingAccessStartedAt ||
          !Number.isFinite(departedAt) ||
          !Number.isFinite(removalCreatedAt) ||
          Date.parse(membership.accessStartedAt) <= departedAt ||
          removal.actorUserId !==
            (reason === 'MEMBER_LEFT' ? departingUserId : input.ownerUserId) ||
          removal.subjectCharacterId !== null ||
          !removal.visibleInHistory ||
          removal.visibility !== 'OWNER' ||
          removal.inventoryAudit !== undefined ||
          !removal.commandId ||
          !removal.inputFingerprint ||
          receipt.eventId !== removal.id ||
          receipt.campaignVersion > campaign.version ||
          checksumCanonicalJson(payload) !==
            checksumCanonicalJson({
              reason,
              departingMembership: {
                userId: departingUserId,
                accessStartedAt: departingAccessStartedAt
              },
              receipt
            }) ||
          removal.inputFingerprint !==
            checksumCanonicalJson({
              operation: reason,
              campaignId: campaign.id,
              actorUserId: removal.actorUserId,
              departingUserId,
              commandId: removal.commandId,
              expectedCampaignVersion: receipt.campaignVersion - 1,
              expectedMembershipAccessStartedAt: new Date(departedAt).toISOString()
            }) ||
          new Set(
            receipt.removedShares.map(
              (removed) => `${removed.subjectKind}:${removed.subjectId}:${removed.sharedBy}`
            )
          ).size !== receipt.removedShares.length ||
          receipt.removedShares.some(
            (removed) =>
              !['VEHICLE', 'EQUIPMENT'].includes(removed.subjectKind) ||
              removed.sharedBy !== departingUserId
          ) ||
          new Set(receipt.affectedCharacters.map((character) => character.characterId)).size !==
            receipt.affectedCharacters.length ||
          receipt.affectedCharacters.some((affected) => {
            const index = characterIds.indexOf(affected.characterId)
            const character = characters[index]
            return (
              index < 0 ||
              !character ||
              affected.status !== 'ACTIVE' ||
              affected.streamVersion > character.streamVersion
            )
          })
        )
          throw new Error('Fixture membership removal receipt mismatch.')
        for (const removed of receipt.removedShares) {
          const publication = await readOwnedCurrentPublication(
            ctx,
            removed.subjectKind,
            removed.subjectId,
            departingUserId
          )
          if (!publication || publication.document.systemId !== campaign.gameSystemId)
            throw new Error('Fixture membership removal publication mismatch.')
        }
        departureRemovals.set(removal.id, {
          reason,
          departingUserId,
          departingCharacterId: characterIds[departureIndex]!,
          accessStartedAt: departedAt,
          createdAt: removalCreatedAt,
          receipt
        })
      } else if (authoredDeleted) {
        if (
          removal.actorUserId !== input.ownerUserId ||
          removal.subjectCharacterId !== null ||
          !removal.visibleInHistory ||
          removal.visibility !== 'TABLE' ||
          removal.inventoryAudit !== undefined ||
          !removal.commandId ||
          !removal.inputFingerprint ||
          !Number.isFinite(removalCreatedAt) ||
          receipt.eventId !== removal.id ||
          receipt.campaignVersion > campaign.version ||
          receipt.removedShares.length !== 1 ||
          !share ||
          !['VEHICLE', 'EQUIPMENT'].includes(share.subjectKind) ||
          share.sharedBy !== input.ownerUserId ||
          (share.subjectKind === 'VEHICLE' && receipt.affectedCharacters.length !== 0) ||
          (share.subjectKind === 'EQUIPMENT' && receipt.evacuatedVehicles.length !== 0) ||
          receipt.evacuatedVehicles.length > MAX.vehicles ||
          new Set(receipt.affectedCharacters.map((character) => character.characterId)).size !==
            receipt.affectedCharacters.length ||
          receipt.affectedCharacters.some((affected) => {
            const index = characterIds.indexOf(affected.characterId)
            const character = characters[index]
            return (
              index < 0 ||
              !character ||
              affected.status !== 'ACTIVE' ||
              affected.streamVersion > character.streamVersion
            )
          }) ||
          checksumCanonicalJson(payload) !==
            checksumCanonicalJson({ reason: 'AUTHORED_DELETED', receipt }) ||
          removal.inputFingerprint !==
            checksumCanonicalJson({
              operation: 'AUTHORED_DELETED',
              campaignId: campaign.id,
              subjectKind: share.subjectKind,
              subjectId: share.subjectId,
              ownerUserId: input.ownerUserId,
              commandId: removal.commandId
            })
        )
          throw new Error('Fixture authored deletion receipt mismatch.')
        const [root, draft] = await Promise.all([
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', share.subjectId))
            .unique(),
          ctx.db
            .query('authoredDrafts')
            .withIndex('by_subjectId', (q) => q.eq('subjectId', share.subjectId))
            .unique()
        ])
        if (root) throw new Error('Fixture authored deletion root must be absent.')
        if (
          !draft ||
          draft.subjectKind !== share.subjectKind ||
          draft.subjectId !== share.subjectId ||
          draft.userId !== input.ownerUserId ||
          draft.systemId !== campaign.gameSystemId ||
          draft.draftState !== 'DRAFT_ONLY' ||
          draft.baseActiveUpdatedAt !== null ||
          draft.basePublishedChecksum !== null
        )
          throw new Error('Fixture authored deletion draft ownership mismatch.')
        authoredRemovals.set(removal.id, {
          createdAt: removalCreatedAt,
          receipt
        })
      } else if (
        (removal.actorUserId !== input.ownerUserId && removal.actorUserId !== share?.sharedBy) ||
        removal.subjectCharacterId !== null ||
        !removal.visibleInHistory ||
        removal.visibility !== 'TABLE' ||
        removal.inventoryAudit !== undefined ||
        !removal.commandId ||
        !removal.inputFingerprint ||
        receipt.eventId !== removal.id ||
        receipt.campaignVersion > campaign.version ||
        receipt.removedShares.length !== 1 ||
        !share ||
        !['VEHICLE', 'EQUIPMENT', 'BACKGROUND'].includes(share.subjectKind) ||
        !cohort.has(share.sharedBy) ||
        (share.subjectKind === 'VEHICLE' && share.sharedBy !== input.ownerUserId) ||
        (share.subjectKind === 'BACKGROUND' && receipt.affectedCharacters.length !== 0) ||
        (share.subjectKind === 'VEHICLE' && receipt.affectedCharacters.length !== 0) ||
        (share.subjectKind !== 'VEHICLE' && receipt.evacuatedVehicles.length !== 0) ||
        new Set(receipt.affectedCharacters.map((character) => character.characterId)).size !==
          receipt.affectedCharacters.length ||
        receipt.affectedCharacters.some((affected) => {
          const index = characterIds.indexOf(affected.characterId)
          const character = characters[index]
          return (
            index < 0 ||
            !character ||
            affected.status !== 'ACTIVE' ||
            affected.streamVersion > character.streamVersion
          )
        }) ||
        checksumCanonicalJson(payload) !== checksumCanonicalJson({ receipt }) ||
        removal.inputFingerprint !==
          checksumCanonicalJson({
            operation: 'UNSHARE',
            campaignId: campaign.id,
            subjectKind: share.subjectKind,
            subjectId: share.subjectId,
            sharedBy: share.sharedBy,
            expectedCampaignVersion: receipt.campaignVersion - 1,
            commandId: removal.commandId,
            actorUserId: removal.actorUserId
          })
      )
        throw new Error('Fixture Vehicle removal receipt mismatch.')
      if (!reason && !authoredDeleted) {
        const publication = await readOwnedCurrentPublication(
          ctx,
          share!.subjectKind,
          share!.subjectId,
          share!.sharedBy
        )
        if (!publication || publication.document.systemId !== campaign.gameSystemId)
          throw new Error('Fixture Vehicle publication ownership mismatch.')
      }
      recognizedRemovalIds.add(removal.id)
      for (const jobId of receipt.pendingVehicleCleanupIds ?? []) {
        if (pendingVehicleCleanupIds.has(jobId))
          throw new Error('Fixture durable Vehicle cleanup identity is duplicated.')
        pendingVehicleCleanupIds.set(jobId, removal.id)
      }
      for (const removed of receipt.evacuatedVehicles) {
        const children = storedEvents.filter((event) => {
          if (event.type !== 'CAMPAIGN_VEHICLE_EVACUATED') return false
          const child = campaignEventDtoSchema.shape.payload.parse(JSON.parse(event.payloadJson))
          return (
            child !== null &&
            typeof child === 'object' &&
            !Array.isArray(child) &&
            child.removalEventId === removal.id &&
            child.formerCampaignVehicleId === removed.vehicleId
          )
        })
        const evacuation = children[0]
        const vehicleShare = reason
          ? receipt.removedShares.find(
              (removedShare) =>
                removedShare.subjectKind === 'VEHICLE' &&
                removedShare.subjectId === removed.vehicleDefinitionId
            )
          : share
        if (
          children.length !== 1 ||
          !evacuation ||
          vehicleIds.has(removed.vehicleId) ||
          historicalVehicleIds.has(removed.vehicleId) ||
          !vehicleShare ||
          removed.vehicleDefinitionId !== vehicleShare.subjectId ||
          new Set(removed.transferredTopLevelItemIds).size !==
            removed.transferredTopLevelItemIds.length ||
          new Set(removed.transferredCurrencyGroupIds).size !==
            removed.transferredCurrencyGroupIds.length ||
          removed.transferredTopLevelItemIds.some((id) => evacuatedTopLevelItemIds.has(id)) ||
          removed.transferredCurrencyGroupIds.some((id) => evacuatedCurrencyGroupIds.has(id))
        )
          throw new Error('Fixture Vehicle evacuation identity mismatch.')
        const child = campaignEventDtoSchema.shape.payload.parse(JSON.parse(evacuation.payloadJson))
        if (child === null || typeof child !== 'object' || Array.isArray(child))
          throw new Error('Fixture Vehicle evacuation payload mismatch.')
        const sourceVersion = child.sourceInventoryVersion
        const destinationVersion = child.destinationInventoryVersion
        if (
          !Number.isFinite(Date.parse(evacuation.createdAt)) ||
          Date.parse(evacuation.createdAt) < removalCreatedAt ||
          evacuation.actorUserId !== removal.actorUserId ||
          evacuation.subjectCharacterId !== null ||
          !evacuation.visibleInHistory ||
          evacuation.visibility !== 'OWNER' ||
          evacuation.inventoryAudit !== undefined ||
          evacuation.commandId !== undefined ||
          evacuation.inputFingerprint !== undefined ||
          typeof sourceVersion !== 'number' ||
          !Number.isSafeInteger(sourceVersion) ||
          sourceVersion < 0 ||
          typeof destinationVersion !== 'number' ||
          !Number.isSafeInteger(destinationVersion) ||
          destinationVersion < 0 ||
          checksumCanonicalJson(child) !==
            checksumCanonicalJson({
              reason: reason ?? (authoredDeleted ? 'AUTHORED_DELETED' : 'UNSHARED'),
              removalEventId: removal.id,
              formerCampaignVehicleId: removed.vehicleId,
              authoredVehicleId: vehicleShare.subjectId,
              transferredTopLevelItemIds: removed.transferredTopLevelItemIds,
              transferredCurrencyGroupIds: removed.transferredCurrencyGroupIds,
              sourceInventoryVersion: sourceVersion,
              destinationInventoryVersion: destinationVersion,
              resultingCampaignVersion: receipt.campaignVersion
            })
        )
          throw new Error('Fixture Vehicle evacuation receipt mismatch.')
        for (const id of removed.transferredTopLevelItemIds) evacuatedTopLevelItemIds.add(id)
        for (const id of removed.transferredCurrencyGroupIds) evacuatedCurrencyGroupIds.add(id)
        historicalVehicleIds.add(removed.vehicleId)
        recognizedEvacuationIds.add(evacuation.id)
      }
    }
    for (const event of storedEvents.filter(
      (candidate) => candidate.type === 'CAMPAIGN_VEHICLE_EVACUATED'
    )) {
      const summary = vehicleCleanupSummarySchema.safeParse(JSON.parse(event.payloadJson))
      if (!summary.success) continue
      const payload = summary.data
      const removalEventId = pendingVehicleCleanupIds.get(payload.jobId)
      if (
        removalEventId === undefined ||
        payload.removalEventId !== removalEventId ||
        !pendingVehicleCleanupIds.delete(payload.jobId) ||
        payload.mode !== 'RETURN' ||
        historicalVehicleIds.has(payload.vehicleId) ||
        event.actorUserId === null ||
        !cohort.has(event.actorUserId) ||
        event.subjectCharacterId !== null ||
        !event.visibleInHistory ||
        event.visibility !== 'OWNER' ||
        event.inventoryAudit !== true ||
        event.commandId !== undefined ||
        !event.inputFingerprint
      )
        throw new Error('Fixture durable Vehicle evacuation receipt mismatch.')
      historicalVehicleIds.add(payload.vehicleId)
      recognizedEvacuationIds.add(event.id)
    }
    if (pendingVehicleCleanupIds.size)
      throw new Error('Fixture durable Vehicle evacuation is incomplete.')
    const recognizedLifecycleIds = new Set<string>()
    const manuallyRemovedVehicleIds = new Set<string>()
    const lifecycleVehicleIds = new Set<string>()
    const lifecycleEvents = storedEvents.filter((event) => event.type === 'VEHICLE_LIFECYCLE')
    for (const event of lifecycleEvents) {
      const rawPayload: unknown = JSON.parse(event.payloadJson)
      const lifecycle = campaignVehicleLifecyclePayloadSchema.safeParse(rawPayload)
      const cleanup = lifecycle.success ? null : vehicleCleanupSummarySchema.safeParse(rawPayload)
      if (!lifecycle.success && !cleanup?.success)
        throw new Error('Fixture Vehicle lifecycle payload mismatch.')
      if (
        event.actorUserId !== input.ownerUserId ||
        event.subjectCharacterId !== null ||
        !event.visibleInHistory ||
        event.visibility !== 'OWNER' ||
        event.inventoryAudit !== true ||
        !event.commandId ||
        !event.inputFingerprint
      )
        throw new Error('Fixture Vehicle lifecycle audit mismatch.')
      if (cleanup?.success) {
        const payload = cleanup.data
        if (
          payload.removalEventId !== undefined ||
          historicalVehicleIds.has(payload.vehicleId) ||
          manuallyRemovedVehicleIds.has(payload.vehicleId) ||
          payload.counts.items > MAX.items ||
          payload.counts.topLevelItems > payload.counts.items ||
          payload.counts.currencyGroups > MAX.groups ||
          payload.counts.currencies > MAX.balances ||
          payload.sourceInventoryVersion < 1 ||
          (payload.mode === 'RETURN'
            ? payload.destinationInventoryVersion === null ||
              payload.destinationInventoryVersion < 1
            : payload.destinationInventoryVersion !== null)
        )
          throw new Error('Fixture durable Vehicle lifecycle receipt mismatch.')
        await requireCampaignVehicleDefinition(ctx, campaign, payload.vehicleDefinitionId)
        manuallyRemovedVehicleIds.add(payload.vehicleId)
        historicalVehicleIds.add(payload.vehicleId)
        lifecycleVehicleIds.add(payload.vehicleId)
      } else if (lifecycle.success) {
        const payload = lifecycle.data
        if (payload.action === 'REMOVE_RETURN_CARGO' || payload.action === 'REMOVE_DESTROY_CARGO') {
          if (
            historicalVehicleIds.has(payload.vehicleId) ||
            manuallyRemovedVehicleIds.has(payload.vehicleId)
          )
            throw new Error('Fixture Vehicle lifecycle removal identity mismatch.')
          if (payload.action === 'REMOVE_RETURN_CARGO') {
            if (
              new Set(payload.transferredTopLevelItemIds).size !==
                payload.transferredTopLevelItemIds.length ||
              new Set(payload.transferredCurrencyGroupIds).size !==
                payload.transferredCurrencyGroupIds.length ||
              payload.transferredTopLevelItemIds.length > MAX.items ||
              payload.transferredCurrencyGroupIds.length > MAX.groups ||
              payload.sourceInventoryVersion < 1 ||
              payload.destinationInventoryVersion < 1
            )
              throw new Error('Fixture Vehicle lifecycle return receipt mismatch.')
            await requireCampaignVehicleDefinition(ctx, campaign, payload.vehicleDefinitionId)
          } else if (
            payload.itemCount > MAX.items ||
            payload.currencyGroupCount > MAX.groups ||
            payload.currencyCount > MAX.balances
          )
            throw new Error('Fixture Vehicle lifecycle destruction receipt mismatch.')
          manuallyRemovedVehicleIds.add(payload.vehicleId)
          historicalVehicleIds.add(payload.vehicleId)
        }
        lifecycleVehicleIds.add(payload.vehicleId)
      }
      recognizedLifecycleIds.add(event.id)
    }
    for (const vehicleId of lifecycleVehicleIds) {
      if (!historicalVehicleIds.has(vehicleId))
        throw new Error('Fixture Vehicle lifecycle identity mismatch.')
    }
    const validOwner = (value: unknown) => {
      const owner = inventoryOwnerRefDtoSchema.safeParse(value)
      if (!owner.success) return false
      return (
        (owner.data.kind === 'CAMPAIGN' && owner.data.campaignId === campaign.id) ||
        (owner.data.kind === 'VEHICLE' && historicalVehicleIds.has(owner.data.vehicleId)) ||
        (owner.data.kind === 'CHARACTER' && characterIds.includes(owner.data.characterId))
      )
    }
    const recognizedDepartureCustodyIds = new Set<string>()
    const recognizedReconciliationIds = new Set<string>()
    const recognizedReconciledCharacters = new Set<string>()
    for (const event of storedEvents.filter((event) => event.type === 'CUSTODY_TRANSFER')) {
      if (event.commandId !== undefined || event.inputFingerprint !== undefined) continue
      const payload = campaignEventDtoSchema.shape.payload.parse(JSON.parse(event.payloadJson))
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('Fixture membership currency payload mismatch.')
      const assignmentReason =
        payload.reason === 'CHARACTER_REPLACED' || payload.reason === 'CHARACTER_UNASSIGNED'
      const assignmentIndex = event.subjectCharacterId
        ? characterIds.indexOf(event.subjectCharacterId)
        : -1
      const assignmentReconciliations = assignmentReason
        ? storedEvents.filter((candidate) => {
            if (
              candidate.type !== 'CAMPAIGN_CHARACTER_RECONCILED' ||
              candidate.subjectCharacterId !== event.subjectCharacterId ||
              candidate.actorUserId !== event.actorUserId
            )
              return false
            const candidatePayload = campaignEventDtoSchema.shape.payload.parse(
              JSON.parse(candidate.payloadJson)
            )
            return (
              candidatePayload !== null &&
              typeof candidatePayload === 'object' &&
              !Array.isArray(candidatePayload) &&
              candidatePayload.reason === payload.reason
            )
          })
        : []
      const assignmentDeparture =
        assignmentReason &&
        assignmentIndex >= 0 &&
        assignmentReconciliations.length === 1 &&
        (event.actorUserId === input.ownerUserId ||
          event.actorUserId === playerUserIds[assignmentIndex]) &&
        Number.isFinite(Date.parse(event.createdAt)) &&
        Date.parse(event.createdAt) >= Date.parse(campaign.createdAt) &&
        Date.parse(event.createdAt) <= Date.parse(assignmentReconciliations[0]!.createdAt)
          ? {
              reason: payload.reason,
              departingCharacterId: event.subjectCharacterId,
              departingUserId: event.actorUserId,
              accessStartedAt: Date.parse(campaign.createdAt),
              createdAt: Date.parse(assignmentReconciliations[0]!.createdAt)
            }
          : null
      if (assignmentReason && !assignmentDeparture)
        throw new Error('Fixture assignment currency provenance mismatch.')
      const departures = assignmentDeparture
        ? [assignmentDeparture]
        : [...departureRemovals.values()].filter(
            (departure) =>
              event.actorUserId ===
                (departure.reason === 'MEMBER_LEFT'
                  ? departure.departingUserId
                  : input.ownerUserId) &&
              event.subjectCharacterId === departure.departingCharacterId &&
              payload.reason === departure.reason &&
              Number.isFinite(Date.parse(event.createdAt)) &&
              Date.parse(event.createdAt) >= departure.accessStartedAt &&
              Date.parse(event.createdAt) <= departure.createdAt
          )
      const departure = departures[0]
      if (
        departures.length !== 1 ||
        !departure ||
        !event.visibleInHistory ||
        event.visibility !== 'OWNER' ||
        event.inventoryAudit !== true ||
        event.commandId !== undefined ||
        event.inputFingerprint !== undefined ||
        payload.action !== 'CUSTODY_TRANSFER' ||
        payload.custodyContext === null ||
        typeof payload.custodyContext !== 'object' ||
        Array.isArray(payload.custodyContext) ||
        payload.custodyContext.sourceOwnerId !== departure.departingCharacterId ||
        payload.custodyContext.destinationOwnerId !== campaign.id ||
        !Array.isArray(payload.denominations) ||
        payload.denominations.length === 0 ||
        checksumCanonicalJson(payload) !==
          checksumCanonicalJson({
            action: 'CUSTODY_TRANSFER',
            custodyContext: {
              sourceOwnerId: departure.departingCharacterId,
              destinationOwnerId: campaign.id
            },
            reason: departure.reason,
            denominations: payload.denominations
          })
      )
        throw new Error('Fixture membership currency receipt mismatch.')
      const denominationIdentities = new Set<string>()
      for (const denomination of payload.denominations) {
        if (
          denomination === null ||
          typeof denomination !== 'object' ||
          Array.isArray(denomination) ||
          typeof denomination.denominationId !== 'string' ||
          denomination.kind !== 'CAMPAIGN' ||
          typeof denomination.campaignCurrencySystemId !== 'string' ||
          typeof denomination.amount !== 'string' ||
          !/^[1-9][0-9]*$/.test(denomination.amount) ||
          checksumCanonicalJson(denomination) !==
            checksumCanonicalJson({
              denominationId: denomination.denominationId,
              kind: 'CAMPAIGN',
              campaignCurrencySystemId: denomination.campaignCurrencySystemId,
              amount: denomination.amount,
              beforeSourceAmount: denomination.amount,
              afterSourceAmount: '0'
            }) ||
          denomination.beforeSourceAmount !== denomination.amount ||
          denomination.afterSourceAmount !== '0' ||
          !denominationIds.has(denomination.denominationId) ||
          !systemIds.has(denomination.campaignCurrencySystemId) ||
          denominationSystems.get(denomination.denominationId) !==
            denomination.campaignCurrencySystemId
        )
          throw new Error('Fixture membership currency namespace mismatch.')
        const identity = `${denomination.denominationId}:${denomination.campaignCurrencySystemId}`
        if (denominationIdentities.has(identity))
          throw new Error('Fixture membership currency duplicates an identity.')
        denominationIdentities.add(identity)
      }
      recognizedDepartureCustodyIds.add(event.id)
    }
    for (const event of storedEvents.filter(
      (event) => event.type === 'CAMPAIGN_CHARACTER_RECONCILED'
    )) {
      const payload = campaignEventDtoSchema.shape.payload.parse(JSON.parse(event.payloadJson))
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('Fixture membership Character reconciliation payload mismatch.')
      const removedSources = Array.isArray(payload.removedSources) ? payload.removedSources : []
      const removedSourceKeys: string[] = []
      for (const source of removedSources) {
        if (
          source === null ||
          typeof source !== 'object' ||
          Array.isArray(source) ||
          typeof source.subjectKind !== 'string' ||
          typeof source.subjectId !== 'string' ||
          checksumCanonicalJson(source) !==
            checksumCanonicalJson({
              subjectKind: source.subjectKind,
              subjectId: source.subjectId
            })
        )
          throw new Error('Fixture membership Character source receipt mismatch.')
        removedSourceKeys.push(`${source.subjectKind}:${source.subjectId}`)
      }
      if (
        new Set(removedSourceKeys).size !== removedSourceKeys.length ||
        removedSourceKeys.some((key, index) => key !== [...removedSourceKeys].sort()[index])
      )
        throw new Error('Fixture membership Character source identity mismatch.')
      const removalEventId =
        typeof payload.removalEventId === 'string' ? payload.removalEventId : undefined
      if (payload.reason === 'CHARACTER_REPLACED' || payload.reason === 'CHARACTER_UNASSIGNED') {
        const characterIndex = event.subjectCharacterId
          ? characterIds.indexOf(event.subjectCharacterId)
          : -1
        const character = characters[characterIndex]
        const identity = JSON.stringify([
          'assignment',
          event.subjectCharacterId,
          payload.streamVersion
        ])
        if (
          characterIndex < 0 ||
          !character ||
          (event.actorUserId !== input.ownerUserId &&
            event.actorUserId !== playerUserIds[characterIndex]) ||
          !Number.isFinite(Date.parse(event.createdAt)) ||
          Date.parse(event.createdAt) < Date.parse(campaign.createdAt) ||
          Date.parse(event.createdAt) > Date.now() ||
          !event.visibleInHistory ||
          event.visibility !== 'SUBJECT' ||
          event.inventoryAudit !== undefined ||
          event.commandId !== undefined ||
          event.inputFingerprint !== undefined ||
          payload.characterId !== event.subjectCharacterId ||
          (payload.status !== 'ACTIVE' && payload.status !== 'DRAFT') ||
          typeof payload.streamVersion !== 'number' ||
          !Number.isSafeInteger(payload.streamVersion) ||
          payload.streamVersion < 0 ||
          payload.streamVersion > character.streamVersion ||
          typeof payload.draftOnly !== 'boolean' ||
          !Array.isArray(payload.removedSources) ||
          recognizedReconciledCharacters.has(identity) ||
          checksumCanonicalJson(payload) !==
            checksumCanonicalJson({
              reason: payload.reason,
              characterId: event.subjectCharacterId,
              status: payload.status,
              streamVersion: payload.streamVersion,
              removedSources: payload.removedSources,
              draftOnly: payload.draftOnly
            })
        )
          throw new Error('Fixture assignment Character reconciliation receipt mismatch.')
        for (const key of removedSourceKeys) {
          const separator = key.indexOf(':')
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', key.slice(separator + 1)))
            .unique()
          if (
            !root ||
            root.subjectKind !== key.slice(0, separator) ||
            !root.ownerUserId ||
            !cohort.has(root.ownerUserId) ||
            root.ownerUserId === playerUserIds[characterIndex] ||
            !(await readOwnedCurrentPublication(ctx, root.subjectKind, root.id, root.ownerUserId))
          )
            throw new Error('Fixture assignment Character source ownership mismatch.')
        }
        recognizedReconciledCharacters.add(identity)
        recognizedReconciliationIds.add(event.id)
        continue
      }
      if (payload.reason === 'AUTHORED_DELETED') {
        const authored = removalEventId ? authoredRemovals.get(removalEventId) : undefined
        const characterIndex = event.subjectCharacterId
          ? characterIds.indexOf(event.subjectCharacterId)
          : -1
        const character = characters[characterIndex]
        const affected = authored?.receipt.affectedCharacters.find(
          (entry) => entry.characterId === event.subjectCharacterId
        )
        if (
          !removalEventId ||
          !authored ||
          !affected ||
          characterIndex < 0 ||
          !character ||
          event.actorUserId !== input.ownerUserId ||
          !Number.isFinite(Date.parse(event.createdAt)) ||
          Date.parse(event.createdAt) < authored.createdAt ||
          !event.visibleInHistory ||
          event.visibility !== 'SUBJECT' ||
          event.inventoryAudit !== undefined ||
          event.commandId !== undefined ||
          event.inputFingerprint !== undefined ||
          payload.characterId !== undefined ||
          payload.status !== 'ACTIVE' ||
          affected.status !== payload.status ||
          typeof payload.streamVersion !== 'number' ||
          !Number.isSafeInteger(payload.streamVersion) ||
          payload.streamVersion < 0 ||
          affected.streamVersion !== payload.streamVersion ||
          payload.streamVersion > character.streamVersion ||
          !Array.isArray(payload.removedSources) ||
          typeof payload.draftOnly !== 'boolean' ||
          removedSourceKeys.some(
            (key) =>
              !authored.receipt.removedShares.some(
                (share) => `${share.subjectKind}:${share.subjectId}` === key
              )
          ) ||
          checksumCanonicalJson(payload) !==
            checksumCanonicalJson({
              reason: 'AUTHORED_DELETED',
              removalEventId,
              removedSources: payload.removedSources,
              status: payload.status,
              streamVersion: payload.streamVersion,
              draftOnly: payload.draftOnly
            })
        )
          throw new Error('Fixture authored deletion Character reconciliation mismatch.')
        const identity = `${removalEventId}:${event.subjectCharacterId}`
        if (recognizedReconciledCharacters.has(identity))
          throw new Error(
            'Fixture authored deletion Character reconciliation duplicates an identity.'
          )
        recognizedReconciledCharacters.add(identity)
        recognizedReconciliationIds.add(event.id)
        continue
      }
      const departureFromRemoval = removalEventId
        ? departureRemovals.get(removalEventId)
        : undefined
      const departures = removalEventId
        ? departureFromRemoval
          ? [departureFromRemoval]
          : []
        : [...departureRemovals.values()].filter(
            (departure) =>
              event.subjectCharacterId === departure.departingCharacterId &&
              payload.reason === departure.reason &&
              Number.isFinite(Date.parse(event.createdAt)) &&
              Date.parse(event.createdAt) >= departure.accessStartedAt &&
              Date.parse(event.createdAt) <= departure.createdAt
          )
      const departure = departures[0]
      const characterIndex = event.subjectCharacterId
        ? characterIds.indexOf(event.subjectCharacterId)
        : -1
      const character = characters[characterIndex]
      if (
        !departure ||
        removedSourceKeys.some(
          (key) =>
            !departure.receipt.removedShares.some(
              (share) => `${share.subjectKind}:${share.subjectId}` === key
            )
        )
      )
        throw new Error('Fixture membership Character source ownership mismatch.')
      const affected = removalEventId
        ? departure?.receipt.affectedCharacters.find(
            (entry) => entry.characterId === event.subjectCharacterId
          )
        : undefined
      if (
        departures.length !== 1 ||
        !departure ||
        characterIndex < 0 ||
        !character ||
        event.actorUserId !==
          (departure.reason === 'MEMBER_LEFT' ? departure.departingUserId : input.ownerUserId) ||
        !Number.isFinite(Date.parse(event.createdAt)) ||
        (removalEventId
          ? Date.parse(event.createdAt) < departure.createdAt
          : Date.parse(event.createdAt) < departure.accessStartedAt ||
            Date.parse(event.createdAt) > departure.createdAt) ||
        !event.visibleInHistory ||
        event.visibility !== 'SUBJECT' ||
        event.inventoryAudit !== undefined ||
        event.commandId !== undefined ||
        event.inputFingerprint !== undefined ||
        payload.reason !== departure.reason ||
        (payload.status !== 'ACTIVE' && payload.status !== 'DRAFT') ||
        typeof payload.streamVersion !== 'number' ||
        !Number.isSafeInteger(payload.streamVersion) ||
        payload.streamVersion < 0 ||
        !Array.isArray(payload.removedSources) ||
        typeof payload.draftOnly !== 'boolean' ||
        (removalEventId
          ? payload.characterId !== undefined ||
            !affected ||
            affected.status !== payload.status ||
            affected.streamVersion !== payload.streamVersion ||
            checksumCanonicalJson(payload) !==
              checksumCanonicalJson({
                reason: departure.reason,
                removalEventId,
                removedSources: payload.removedSources,
                status: payload.status,
                streamVersion: payload.streamVersion,
                draftOnly: payload.draftOnly
              })
          : event.subjectCharacterId !== departure.departingCharacterId ||
            payload.characterId !== event.subjectCharacterId ||
            payload.streamVersion > character.streamVersion ||
            payload.status !== 'ACTIVE' ||
            checksumCanonicalJson(payload) !==
              checksumCanonicalJson({
                reason: departure.reason,
                characterId: event.subjectCharacterId,
                status: payload.status,
                streamVersion: payload.streamVersion,
                removedSources: payload.removedSources,
                draftOnly: payload.draftOnly
              }))
      )
        throw new Error('Fixture membership Character reconciliation receipt mismatch.')
      const identity = `${removalEventId ?? departure.departingCharacterId}:${event.subjectCharacterId}`
      if (recognizedReconciledCharacters.has(identity))
        throw new Error('Fixture membership Character reconciliation duplicates an identity.')
      recognizedReconciledCharacters.add(identity)
      recognizedReconciliationIds.add(event.id)
    }
    for (const [removalEventId, departure] of departureRemovals) {
      for (const affected of departure.receipt.affectedCharacters) {
        if (!recognizedReconciledCharacters.has(`${removalEventId}:${affected.characterId}`))
          throw new Error('Fixture membership removal lacks a Character reconciliation receipt.')
      }
    }
    for (const [removalEventId, authored] of authoredRemovals) {
      for (const affected of authored.receipt.affectedCharacters) {
        if (!recognizedReconciledCharacters.has(`${removalEventId}:${affected.characterId}`))
          throw new Error('Fixture authored deletion lacks a Character reconciliation receipt.')
      }
    }
    const recognizedAdjustmentIds = new Set<string>()
    const adjustmentIdentityIds = new Set<string>()
    for (const event of storedEvents.filter((row) => row.type === 'CAMPAIGN_ADJUSTMENT_SAVED')) {
      const payload = campaignEventDtoSchema.shape.payload.parse(JSON.parse(event.payloadJson))
      const characterIndex = event.subjectCharacterId
        ? characterIds.indexOf(event.subjectCharacterId)
        : -1
      if (
        recognizedAdjustmentIds.size >= 2 ||
        event.actorUserId !== input.ownerUserId ||
        characterIndex < 0 ||
        !event.visibleInHistory ||
        event.visibility !== 'OWNER' ||
        event.inventoryAudit !== undefined ||
        event.commandId !== undefined ||
        event.inputFingerprint !== undefined ||
        !Number.isFinite(Date.parse(event.createdAt)) ||
        Date.parse(event.createdAt) < Date.parse(campaign.createdAt) ||
        Date.parse(event.createdAt) > Date.now() ||
        payload === null ||
        typeof payload !== 'object' ||
        Array.isArray(payload) ||
        !campaignAdjustmentDtoSchema.shape.id.safeParse(payload.adjustmentId).success ||
        typeof payload.adjustmentId !== 'string' ||
        adjustmentIdentityIds.has(payload.adjustmentId) ||
        payload.action !== 'SAVED' ||
        payload.family !== 'HIT_POINTS' ||
        payload.version !== 0 ||
        payload.slotKey !==
          getCharacterSheetAdjustmentSlotKey({
            family: 'HIT_POINTS',
            field: 'MAXIMUM_MODIFIER',
            value: 4
          }) ||
        checksumCanonicalJson(payload) !==
          checksumCanonicalJson({
            action: 'SAVED',
            adjustmentId: payload.adjustmentId,
            family: 'HIT_POINTS',
            slotKey: payload.slotKey,
            version: 0
          })
      )
        throw new Error('Fixture assignment GM adjustment receipt mismatch.')
      adjustmentIdentityIds.add(payload.adjustmentId)
      recognizedAdjustmentIds.add(event.id)
    }
    for (const event of storedEvents) {
      if (
        recognizedAdjustmentIds.has(event.id) ||
        recognizedRemovalIds.has(event.id) ||
        recognizedEvacuationIds.has(event.id) ||
        recognizedLifecycleIds.has(event.id) ||
        recognizedDepartureCustodyIds.has(event.id) ||
        recognizedReconciliationIds.has(event.id)
      )
        continue
      const payload = campaignEventDtoSchema.shape.payload.parse(JSON.parse(event.payloadJson))
      const custody = event.type === 'CUSTODY_TRANSFER'
      const partyKinds = [
        'ITEM_ADD',
        'ITEM_UPDATE',
        'ITEM_CONSUME',
        'ITEM_REMOVE',
        'CURRENCY_ADJUST',
        'CURRENCY_MOVE'
      ]
      if (
        event.actorUserId === null ||
        !cohort.has(event.actorUserId) ||
        (event.subjectCharacterId !== null && !characterIds.includes(event.subjectCharacterId)) ||
        !event.visibleInHistory ||
        event.visibility !== 'OWNER' ||
        event.inventoryAudit !== true ||
        !event.commandId ||
        !event.inputFingerprint ||
        payload === null ||
        typeof payload !== 'object' ||
        Array.isArray(payload) ||
        (custody
          ? payload.action !== 'CUSTODY_TRANSFER' ||
            !validOwner(payload.source) ||
            !validOwner(payload.destination)
          : event.actorUserId !== input.ownerUserId ||
            event.subjectCharacterId !== null ||
            !partyKinds.some((kind) => event.type === 'PARTY_' + kind && payload.action === kind) ||
            !(
              checksumCanonicalJson(payload.custody) ===
                checksumCanonicalJson({
                  kind: 'CAMPAIGN',
                  campaignId: campaign.id,
                  ownerId: campaign.id
                }) ||
              (payload.custody !== null &&
                typeof payload.custody === 'object' &&
                !Array.isArray(payload.custody) &&
                typeof payload.custody.vehicleId === 'string' &&
                historicalVehicleIds.has(payload.custody.vehicleId) &&
                checksumCanonicalJson(payload.custody) ===
                  checksumCanonicalJson({
                    kind: 'VEHICLE',
                    vehicleId: payload.custody.vehicleId,
                    campaignId: campaign.id,
                    ownerId: payload.custody.vehicleId
                  }))
            ))
      )
        throw new Error('Fixture custody audit event mismatch.')
    }
    const residualDependencies = await Promise.all([
      ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', campaign.id))
        .first(),
      ctx.db
        .query('encounterRuns')
        .withIndex('by_campaignId_sessionId_createdAt_id', (q) => q.eq('campaignId', campaign.id))
        .first(),
      ctx.db
        .query('campaignContentShares')
        .withIndex('by_campaignId_subjectKind_subjectId', (q) => q.eq('campaignId', campaign.id))
        .first(),
      ctx.db
        .query('campaignAnnouncements')
        .withIndex('by_campaignId_createdAt_publicId', (q) => q.eq('campaignId', campaign.id))
        .first(),
      ctx.db
        .query('campaignConversations')
        .withIndex('by_campaignId_kind', (q) => q.eq('campaignId', campaign.id))
        .first(),
      ctx.db
        .query('campaignNotebookSections')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .first(),
      ctx.db
        .query('sceneDefinitions')
        .withIndex('by_campaignId_updatedAt_id', (q) => q.eq('campaignId', campaign.id))
        .first(),
      ctx.db
        .query('campaignScenes')
        .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaign.id))
        .first(),
      ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId_sessionId', (q) => q.eq('campaignId', campaign.id))
        .first()
    ])
    if (residualDependencies.some((row) => row !== null))
      throw new Error('Fixture Campaign retains non-inventory dependencies.')
    for (const row of balances) await ctx.db.delete(row._id)
    for (const row of groups) await ctx.db.delete(row._id)
    for (const row of items) await ctx.db.delete(row._id)
    for (const row of inventories) await ctx.db.delete(row._id)
    for (const row of denominations) await ctx.db.delete(row._id)
    for (const row of systems) await ctx.db.delete(row._id)
    for (const row of vehicles) await ctx.db.delete(row._id)
    for (const row of events) await ctx.db.delete(row._id)
    const second = 1
    for (const row of overlays.filter((row) => row.characterId === characterIds[second]))
      await ctx.db.delete(row._id)
    for (const row of assignments.filter((row) => row.characterId === characterIds[second]))
      await ctx.db.delete(row._id)
    await ctx.db.delete(memberships.find((row) => row.userId === playerUserIds[second])!._id)
    return null
  }
})
