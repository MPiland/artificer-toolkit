import { v } from 'convex/values'
import { campaignContentRemovalReceiptDtoSchema } from '@artificer-toolkit/schema/api/campaignCore'
import { inventoryOwnerRefDtoSchema } from '@artificer-toolkit/schema/api/campaignInventory'
import { campaignEventDtoSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import { vehicleCleanupSummarySchema } from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { readOwnedCurrentPublication } from './contentAccess'

/** Removes only the bounded P12 driver state before the existing Campaign fixture cleanup. */
export const removeFixtureState = internalMutation({
  args: { ownerUserId: v.string(), playerUserId: v.string(), campaignId: v.string() },
  returns: v.null(),
  handler: async (ctx, input) => {
    await requireFixtureAccount(ctx, input.ownerUserId)
    await requireFixtureAccount(ctx, input.playerUserId)
    if (input.ownerUserId === input.playerUserId)
      throw new Error('Fixture owner and player must differ.')
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', input.campaignId))
      .unique()
    if (!campaign) return null
    if (
      campaign.ownerUserId !== input.ownerUserId ||
      campaign.name !== 'Encounter execution fixture'
    )
      throw new Error('Fixture Campaign ownership or name mismatch.')
    const [
      memberships,
      vehicles,
      inventories,
      items,
      groups,
      currencies,
      systems,
      denominations,
      events
    ] = await Promise.all([
      ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaign.id))
        .take(3),
      ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(3),
      ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .take(4),
      ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(37),
      ctx.db
        .query('campaignPartyCurrencyGroups')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(2),
      ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(9),
      ctx.db
        .query('campaignCurrencySystems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(2),
      ctx.db
        .query('campaignCurrencyDenominations')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(3),
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(44)
    ])
    if (
      memberships.length > 2 ||
      !memberships.some((row) => row.userId === input.ownerUserId && row.role === 'OWNER') ||
      memberships.some(
        (row) =>
          !(
            (row.userId === input.ownerUserId && row.role === 'OWNER') ||
            (row.userId === input.playerUserId && row.role === 'PLAYER')
          )
      ) ||
      vehicles.length > 2 ||
      inventories.length > 3 ||
      items.length > 36 ||
      groups.length > 1 ||
      currencies.length > 8 ||
      systems.length > 1 ||
      denominations.length > 2 ||
      events.length > 43
    )
      throw new Error('Fixture inventory membership or row bounds mismatch.')
    const vehicleIds = new Set(vehicles.map((row) => row.id))
    const groupById = new Map(groups.map((row) => [row.id, row]))
    const systemIds = new Set(systems.map((row) => row.id))
    const denominationIds = new Set(denominations.map((row) => row.id))
    if (
      vehicles.some((row) => !['P12 cart A', 'P12 cart B'].includes(row.label ?? '')) ||
      new Set(vehicles.map((row) => row.label)).size !== vehicles.length ||
      new Set(inventories.map((row) => row.vehicleId)).size !== inventories.length ||
      [...inventories, ...items, ...groups, ...currencies].some(
        (row) => row.vehicleId !== undefined && !vehicleIds.has(row.vehicleId)
      ) ||
      items.some((row) => row.containerId !== null) ||
      currencies.some(
        (row) =>
          row.containerId !== null ||
          (row.groupId !== undefined &&
            (groupById.get(row.groupId)?.vehicleId !== row.vehicleId ||
              groupById.get(row.groupId)?.containerId !== row.containerId)) ||
          row.campaignCurrencySystemId === undefined ||
          !systemIds.has(row.campaignCurrencySystemId) ||
          !denominationIds.has(row.denominationId)
      ) ||
      systems.some((row) => row.label !== 'P12 trade currency') ||
      denominations.some((row) => !systemIds.has(row.systemId))
    )
      throw new Error('Fixture inventory custody or definition mismatch.')

    const auditVehicleIds = new Set(vehicleIds)
    const removals = events.filter((event) => event.type === 'CAMPAIGN_CONTENT_SHARES_REMOVED')
    const evacuations = events.filter((event) => event.type === 'CAMPAIGN_VEHICLE_EVACUATED')
    if (removals.length || evacuations.length) {
      const removal = removals[0]
      const evacuation = evacuations[0]
      if (removals.length !== 1 || evacuations.length !== 1 || !removal || !evacuation)
        throw new Error('Fixture Vehicle evacuation receipt mismatch.')
      const payload = campaignEventDtoSchema.shape.payload.parse(JSON.parse(removal.payloadJson))
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('Fixture Vehicle evacuation receipt mismatch.')
      const receipt = campaignContentRemovalReceiptDtoSchema.parse(payload.receipt)
      const share = receipt.removedShares[0]
      const summary = vehicleCleanupSummarySchema.parse(JSON.parse(evacuation.payloadJson))
      const job = await ctx.db
        .query('campaignVehicleCleanupJobs')
        .withIndex('by_publicId', (q) => q.eq('id', summary.jobId))
        .unique()
      const sourceInventory = inventories.find((row) => row.vehicleId === summary.vehicleId)
      const destinationInventory = inventories.find((row) => row.vehicleId === undefined)
      const returnedItems = items.filter((row) => row.cleanupJobId === summary.jobId)
      const returnedGroups = groups.filter((row) => row.cleanupJobId === summary.jobId)
      const returnedCurrencies = currencies.filter((row) => row.cleanupJobId === summary.jobId)
      if (
        removal.visibility !== 'TABLE' ||
        removal.inventoryAudit !== undefined ||
        !removal.commandId ||
        !removal.inputFingerprint ||
        evacuation.visibility !== 'OWNER' ||
        evacuation.inventoryAudit !== true ||
        evacuation.commandId !== undefined ||
        !evacuation.inputFingerprint ||
        receipt.eventId !== removal.id ||
        receipt.campaignVersion !== campaign.version ||
        receipt.removedShares.length !== 1 ||
        !share ||
        share.subjectKind !== 'VEHICLE' ||
        share.sharedBy !== input.ownerUserId ||
        receipt.affectedCharacters.length ||
        receipt.evacuatedVehicles.length ||
        receipt.pendingVehicleCleanupIds?.length !== 1 ||
        receipt.pendingVehicleCleanupIds[0] !== summary.jobId ||
        !job ||
        job.status !== 'COMPLETED' ||
        job.grant.eventId !== evacuation.id ||
        job.grant.removalEventId !== removal.id ||
        job.grant.vehicleId !== summary.vehicleId ||
        job.grant.vehicleDefinitionId !== share.subjectId ||
        job.grant.mode !== 'RETURN' ||
        summary.removalEventId !== removal.id ||
        summary.vehicleDefinitionId !== share.subjectId ||
        summary.mode !== 'RETURN' ||
        checksumCanonicalJson(summary.counts) !== checksumCanonicalJson(job.applied) ||
        checksumCanonicalJson(summary.counts) !== checksumCanonicalJson(job.validated) ||
        returnedItems.length !== summary.counts.items ||
        returnedItems.filter((item) => item.containerId === null).length !==
          summary.counts.topLevelItems ||
        returnedGroups.length !== summary.counts.currencyGroups ||
        returnedCurrencies.length !== summary.counts.currencies ||
        returnedGroups.some((group) => group.vehicleId !== undefined) ||
        returnedCurrencies.some(
          (currency) =>
            currency.vehicleId !== undefined ||
            (currency.groupId !== undefined &&
              !returnedGroups.some((group) => group.id === currency.groupId))
        ) ||
        sourceInventory !== undefined ||
        destinationInventory?.version !== summary.destinationInventoryVersion ||
        job.sourceInventoryVersion !== summary.sourceInventoryVersion ||
        job.destinationInventoryVersion !== summary.destinationInventoryVersion ||
        job.grant.sourceInventoryVersion + 1 !== summary.sourceInventoryVersion ||
        vehicleIds.has(summary.vehicleId) ||
        vehicles.some((vehicle) => vehicle.label === 'P12 cart A') ||
        checksumCanonicalJson(payload) !== checksumCanonicalJson({ receipt }) ||
        removal.inputFingerprint !==
          checksumCanonicalJson({
            operation: 'UNSHARE',
            campaignId: campaign.id,
            subjectKind: 'VEHICLE',
            subjectId: share.subjectId,
            sharedBy: input.ownerUserId,
            expectedCampaignVersion: receipt.campaignVersion - 1,
            commandId: removal.commandId,
            actorUserId: input.ownerUserId
          }) ||
        evacuation.inputFingerprint !==
          checksumCanonicalJson({
            operation: 'SOURCE_LOSS_VEHICLE_CLEANUP',
            removalEventId: removal.id,
            parentInputFingerprint: removal.inputFingerprint,
            vehicleId: summary.vehicleId,
            reason: 'UNSHARE'
          })
      )
        throw new Error('Fixture Vehicle evacuation receipt mismatch.')
      const publication = await readOwnedCurrentPublication(
        ctx,
        'VEHICLE',
        share.subjectId,
        input.ownerUserId
      )
      if (!publication || publication.document.systemId !== campaign.gameSystemId)
        throw new Error('Fixture Vehicle publication ownership mismatch.')
      auditVehicleIds.add(summary.vehicleId)
    }

    for (const event of events) {
      if (
        event.actorUserId !== input.ownerUserId ||
        event.subjectCharacterId !== null ||
        !event.visibleInHistory
      )
        throw new Error('Fixture inventory audit ownership mismatch.')
      if (removals.includes(event) || evacuations.includes(event)) continue
      if (
        event.visibility !== 'OWNER' ||
        event.inventoryAudit !== true ||
        !event.commandId ||
        !event.inputFingerprint ||
        !['PARTY_ITEM_ADD', 'PARTY_CURRENCY_ADJUST', 'CUSTODY_TRANSFER'].includes(event.type)
      )
        throw new Error('Fixture inventory audit ownership mismatch.')
      const payload = campaignEventDtoSchema.shape.payload.parse(JSON.parse(event.payloadJson))
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('Fixture inventory audit payload mismatch.')
      if (event.type === 'CUSTODY_TRANSFER') {
        const source = inventoryOwnerRefDtoSchema.parse(payload.source)
        const destination = inventoryOwnerRefDtoSchema.parse(payload.destination)
        if (
          payload.action !== 'CUSTODY_TRANSFER' ||
          [source, destination].some(
            (owner) =>
              owner.kind === 'CHARACTER' ||
              (owner.kind === 'CAMPAIGN'
                ? owner.campaignId !== campaign.id
                : !auditVehicleIds.has(owner.vehicleId))
          )
        )
          throw new Error('Fixture inventory audit custody mismatch.')
      } else if (
        payload.action !== (event.type === 'PARTY_ITEM_ADD' ? 'ITEM_ADD' : 'CURRENCY_ADJUST') ||
        (checksumCanonicalJson(payload.custody) !==
          checksumCanonicalJson({
            kind: 'CAMPAIGN',
            campaignId: campaign.id,
            ownerId: campaign.id
          }) &&
          ![...auditVehicleIds].some(
            (vehicleId) =>
              checksumCanonicalJson(payload.custody) ===
              checksumCanonicalJson({
                kind: 'VEHICLE',
                vehicleId,
                campaignId: campaign.id,
                ownerId: vehicleId
              })
          ))
      )
        throw new Error('Fixture party inventory audit custody mismatch.')
    }

    for (const row of currencies) await ctx.db.delete(row._id)
    for (const row of groups) await ctx.db.delete(row._id)
    for (const row of items) await ctx.db.delete(row._id)
    for (const row of inventories) await ctx.db.delete(row._id)
    for (const row of events) await ctx.db.delete(row._id)
    for (const row of denominations) await ctx.db.delete(row._id)
    for (const row of systems) await ctx.db.delete(row._id)
    for (const row of vehicles) await ctx.db.delete(row._id)
    return null
  }
})
