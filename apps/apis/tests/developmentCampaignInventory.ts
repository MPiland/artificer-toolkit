import assert from 'node:assert/strict'
import type {
  CampaignPartyInventoryMutationInput,
  SaveCampaignCurrencySystemInput,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'

const canonicalClubId = '00000000-0000-0000-0060-000100000000'
const canonicalBackpackId = '00000000-0000-0000-0060-006900000000'
const canonicalCartId = '00000000-0000-0000-0080-000700000000'
const page = (campaignId: string) => ({
  campaignId,
  paginationOpts: { cursor: null, numItems: 48 }
})
const party = (campaignId: string) => ({ kind: 'CAMPAIGN' as const, campaignId })
const vehicle = (vehicleId: string) => ({ kind: 'VEHICLE' as const, vehicleId })

export async function verifyCampaignInventory({
  owner,
  player,
  anonymous,
  campaignId,
  boundedCleanup = true
}: {
  owner: DevelopmentClient
  player: DevelopmentClient
  anonymous: DevelopmentClient
  campaignId: string
  /**
   * True fills Vehicle A past the ordinary cleanup bound so source loss runs the durable bounded
   * cleanup job. The custody convex test passes false to prove the immediate path instead: the
   * Vehicle is then evacuated in the unshare itself and the party stays small for later reads.
   */
  boundedCleanup?: boolean
}): Promise<void> {
  assert.notEqual(owner, player, 'Inventory proof requires independent owner and player clients.')
  const draft = await owner.mutation(api.content.drafts.duplicate, {
    subjectKind: 'VEHICLE',
    subjectId: canonicalCartId
  })
  if (!draft.updatedAt) throw new Error('Inventory proof Vehicle draft is unavailable.')
  const publication = await owner.mutation(api.content.publication.publishDraft, {
    subjectKind: 'VEHICLE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  const share = await owner.mutation(api.campaigns.contentShares.share, {
    campaignId,
    subjectKind: 'VEHICLE',
    subjectId: publication.subjectId
  })
  const carts = await Promise.all(
    [publication.subjectId, canonicalCartId].map((vehicleDefinitionId, index) =>
      owner.mutation(api.campaigns.vehicles.create, {
        campaignId,
        vehicleDefinitionId,
        label: index === 0 ? 'P12 cart A' : 'P12 cart B'
      })
    )
  )
  const [cartA, cartB] = carts
  if (!cartA || !cartB) throw new Error('Inventory proof carts are unavailable.')
  const completeItemPage = async (client: DevelopmentClient, vehicleId?: string) => {
    const load = (cursor: string | null) =>
      vehicleId === undefined
        ? client.query(api.campaigns.partyInventory.items, {
            campaignId,
            paginationOpts: { cursor, numItems: 8 }
          })
        : client.query(api.campaigns.vehicleInventory.items, {
            campaignId,
            vehicleId,
            paginationOpts: { cursor, numItems: 8 }
          })
    let result = await load(null)
    const ownerRef = result.owner
    const version = result.version
    const rows = [...result.page]
    const cursors = new Set<string>()
    while (!result.isDone) {
      assert.deepEqual(result.owner, ownerRef)
      assert.equal(result.version, version)
      assert.ok(result.continueCursor)
      assert.equal(cursors.has(result.continueCursor), false, 'Inventory cursor must advance.')
      cursors.add(result.continueCursor)
      result = await load(result.continueCursor)
      rows.push(...result.page)
    }
    assert.deepEqual(result.owner, ownerRef)
    assert.equal(result.version, version)
    return { ...result, page: rows }
  }

  await assert.rejects(
    () =>
      player.mutation(api.campaigns.vehicles.create, {
        campaignId,
        vehicleDefinitionId: cartA.vehicleDefinitionId,
        label: 'P12 player cart'
      }),
    /owner|permission|authorized|cannot remove/i
  )

  const read = async () => {
    const [
      partyItems,
      partyCurrencies,
      aItems,
      aCurrencies,
      bItems,
      bCurrencies,
      systems,
      audit,
      shares,
      campaign
    ] = await Promise.all([
      completeItemPage(owner),
      owner.query(api.campaigns.partyInventory.currencies, page(campaignId)),
      completeItemPage(owner, cartA.id),
      owner.query(api.campaigns.vehicleInventory.currencies, {
        ...page(campaignId),
        vehicleId: cartA.id
      }),
      completeItemPage(owner, cartB.id),
      owner.query(api.campaigns.vehicleInventory.currencies, {
        ...page(campaignId),
        vehicleId: cartB.id
      }),
      owner.query(api.campaigns.currencySystems.list, page(campaignId)),
      owner.query(api.campaigns.inventoryAudit.list, { campaignId, limit: 100 }),
      owner.query(api.campaigns.contentShares.list, page(campaignId)),
      owner.query(api.campaigns.queries.get, { id: campaignId })
    ])
    for (const result of [
      partyItems,
      partyCurrencies,
      aItems,
      aCurrencies,
      bItems,
      bCurrencies,
      systems
    ])
      assert.equal(result.isDone, true, 'Inventory proof expects one complete bounded page.')
    assert.equal(shares.isDone, true, 'Inventory proof expects one complete content-share page.')
    assert.equal(audit.nextCursor, null, 'Inventory proof expects one complete audit page.')
    assert.deepEqual(partyItems.owner, party(campaignId))
    assert.deepEqual(aItems.owner, vehicle(cartA.id))
    assert.deepEqual(bItems.owner, vehicle(cartB.id))
    assert.deepEqual(partyCurrencies.owner, partyItems.owner)
    assert.deepEqual(aCurrencies.owner, aItems.owner)
    assert.deepEqual(bCurrencies.owner, bItems.owner)
    assert.equal(partyCurrencies.version, partyItems.version)
    assert.equal(aCurrencies.version, aItems.version)
    assert.equal(bCurrencies.version, bItems.version)
    return {
      partyItems,
      partyCurrencies,
      aItems,
      aCurrencies,
      bItems,
      bCurrencies,
      systems,
      audit,
      shares,
      campaign
    }
  }
  const add = async (equipmentId: string, quantity: number, expectedOwnerVersion: number) =>
    owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'ITEM_ADD',
        campaignId,
        equipmentId,
        quantity,
        expectedOwnerVersion,
        idempotencyKey: crypto.randomUUID()
      } satisfies CampaignPartyInventoryMutationInput
    })

  const readAfterEvacuation = async () => {
    const [
      partyItems,
      partyCurrencies,
      bItems,
      bCurrencies,
      systems,
      audit,
      shares,
      campaign,
      vehicles
    ] = await Promise.all([
      completeItemPage(owner),
      owner.query(api.campaigns.partyInventory.currencies, page(campaignId)),
      completeItemPage(owner, cartB.id),
      owner.query(api.campaigns.vehicleInventory.currencies, {
        ...page(campaignId),
        vehicleId: cartB.id
      }),
      owner.query(api.campaigns.currencySystems.list, page(campaignId)),
      owner.query(api.campaigns.inventoryAudit.list, { campaignId, limit: 100 }),
      owner.query(api.campaigns.contentShares.list, page(campaignId)),
      owner.query(api.campaigns.queries.get, { id: campaignId }),
      owner.query(api.campaigns.vehicles.list, page(campaignId))
    ])
    for (const result of [
      partyItems,
      partyCurrencies,
      bItems,
      bCurrencies,
      systems,
      shares,
      vehicles
    ])
      assert.equal(result.isDone, true, 'Inventory proof expects one complete available page.')
    assert.equal(audit.nextCursor, null, 'Inventory proof expects one complete audit page.')
    assert.equal(partyItems.version, partyCurrencies.version)
    return {
      partyItems,
      partyCurrencies,
      bItems,
      bCurrencies,
      systems,
      audit,
      shares,
      campaign,
      vehicles
    }
  }

  await add(canonicalClubId, 5, 0)
  await add(canonicalBackpackId, 1, 1)
  let state = await read()
  const club = state.partyItems.page.find((item) => item.label === 'Club')
  const backpack = state.partyItems.page.find((item) => item.label === 'Backpack')
  if (!club || !backpack) throw new Error('Canonical club or backpack is unavailable.')

  const rawTransfer = (input: TransferCampaignInventoryInput) =>
    owner.mutation(api.campaigns.inventoryTransfers.transfer, { input })
  const transfer = async (input: TransferCampaignInventoryInput) => {
    const before = await read()
    const result = await rawTransfer(input)
    const after = await read()
    const inventoryFor = (
      snapshot: typeof before,
      ownerRef: TransferCampaignInventoryInput['source']
    ) => {
      if (ownerRef.kind === 'CAMPAIGN') return snapshot.partyItems
      assert.ok(ownerRef.kind === 'VEHICLE', 'Inventory proof requires party or Vehicle custody.')
      return ownerRef.vehicleId === cartA.id ? snapshot.aItems : snapshot.bItems
    }
    assert.equal(
      inventoryFor(after, input.source).version,
      inventoryFor(before, input.source).version + 1
    )
    assert.equal(
      inventoryFor(after, input.destination).version,
      inventoryFor(before, input.destination).version + 1
    )
    assert.equal(after.audit.events.filter((event) => event.id === result.eventId).length, 1)
    assert.equal(after.audit.events.length, before.audit.events.length + 1)
    assert.deepEqual(
      after.audit.events.filter((event) => event.id !== result.eventId),
      before.audit.events,
      'A transfer must preserve every earlier audit event.'
    )
    const total = (snapshot: typeof before) =>
      input.kind === 'ITEM'
        ? [snapshot.partyItems, snapshot.aItems, snapshot.bItems]
            .flatMap((entry) => entry.page)
            .filter(
              (item) =>
                item.label ===
                inventoryFor(before, input.source).page.find((item) => item.id === input.itemId)
                  ?.label
            )
            .reduce((sum, item) => sum + item.quantity, 0)
        : [snapshot.partyCurrencies, snapshot.aCurrencies, snapshot.bCurrencies]
            .flatMap((entry) => entry.page)
            .filter((currency) => currency.denominationId === input.denominationId)
            .reduce((sum, currency) => sum + currency.amount, 0)
    assert.equal(total(after), total(before), 'Transfers must conserve inventory quantity.')
    assert.deepEqual(await rawTransfer(input), result)
    assert.deepEqual(
      await read(),
      after,
      'Exact transfer replay must preserve all inventory and audit state.'
    )
    return result
  }
  const first: TransferCampaignInventoryInput = {
    kind: 'ITEM',
    campaignId,
    source: party(campaignId),
    destination: vehicle(cartA.id),
    itemId: club.id,
    amount: 2,
    expectedSourceVersion: 2,
    expectedDestinationVersion: 0,
    idempotencyKey: crypto.randomUUID()
  }
  await transfer(first)
  state = await read()
  assert.equal(state.partyItems.version, 3)
  assert.equal(state.aItems.version, 1)
  const replaySnapshot = await read()
  await assert.rejects(() => transfer({ ...first, amount: 1 }), /different input/i)
  assert.deepEqual(
    await read(),
    replaySnapshot,
    'Changed payload replay must not write inventory rows.'
  )
  await assert.rejects(
    () => transfer({ ...first, idempotencyKey: crypto.randomUUID(), expectedSourceVersion: 2 }),
    /changed/i
  )
  assert.deepEqual(await read(), replaySnapshot, 'Stale transfer must not write inventory rows.')

  const clubInA = replaySnapshot.aItems.page.find((item) => item.label === 'Club')
  if (!clubInA) throw new Error('Club transfer to cart A is unavailable.')
  await transfer({
    kind: 'ITEM',
    campaignId,
    source: vehicle(cartA.id),
    destination: vehicle(cartB.id),
    itemId: clubInA.id,
    amount: 1,
    expectedSourceVersion: 1,
    expectedDestinationVersion: 0,
    idempotencyKey: crypto.randomUUID()
  })
  state = await read()
  const clubInB = state.bItems.page.find((item) => item.label === 'Club')
  if (!clubInB) throw new Error('Club transfer to cart B is unavailable.')
  await transfer({
    kind: 'ITEM',
    campaignId,
    source: vehicle(cartB.id),
    destination: party(campaignId),
    itemId: clubInB.id,
    amount: 1,
    expectedSourceVersion: 1,
    expectedDestinationVersion: 3,
    idempotencyKey: crypto.randomUUID()
  })
  await transfer({
    kind: 'ITEM',
    campaignId,
    source: party(campaignId),
    destination: vehicle(cartA.id),
    itemId: backpack.id,
    amount: 1,
    expectedSourceVersion: 4,
    expectedDestinationVersion: 2,
    idempotencyKey: crypto.randomUUID()
  })
  state = await read()
  assert.equal(state.aItems.page.find((item) => item.id === backpack.id)?.id, backpack.id)
  assert.equal(
    [state.partyItems, state.aItems, state.bItems]
      .flatMap((entry) => entry.page)
      .filter((item) => item.label === 'Club')
      .reduce((total, item) => total + item.quantity, 0),
    5
  )

  await assert.rejects(
    () =>
      player.mutation(api.campaigns.inventoryTransfers.transfer, {
        input: {
          kind: 'ITEM',
          campaignId,
          source: vehicle(cartA.id),
          destination: party(campaignId),
          itemId: backpack.id,
          amount: 1,
          expectedSourceVersion: 3,
          expectedDestinationVersion: 5,
          idempotencyKey: crypto.randomUUID()
        }
      }),
    /owner|permission|authorized/i
  )
  await assert.rejects(
    () => player.query(api.campaigns.inventoryAudit.list, { campaignId, limit: 32 }),
    /owner|permission|authorized/i
  )
  await assert.rejects(
    () => anonymous.query(api.campaigns.partyInventory.items, page(campaignId)),
    /identity|authenticated|authorized/i
  )
  await assert.rejects(
    () =>
      anonymous.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: {
          kind: 'ITEM_ADD',
          campaignId,
          equipmentId: canonicalClubId,
          quantity: 1,
          expectedOwnerVersion: 5,
          idempotencyKey: crypto.randomUUID()
        }
      }),
    /identity|authenticated|authorized/i
  )

  const baseId = crypto.randomUUID()
  const tradeId = crypto.randomUUID()
  const systemInput: SaveCampaignCurrencySystemInput = {
    campaignId,
    label: 'P12 trade currency',
    isReference: true,
    denominations: [
      { id: baseId, label: 'Reference', abbreviation: 'r', scaleInReference: 1 },
      { id: tradeId, label: 'Trade', abbreviation: 't', scaleInReference: 4 }
    ]
  }
  const system = await owner.mutation(api.campaigns.currencySystems.save, systemInput)
  const adjust: CampaignPartyInventoryMutationInput = {
    kind: 'CURRENCY_ADJUST',
    campaignId,
    denominationId: tradeId,
    amount: 12,
    expectedOwnerVersion: 5,
    idempotencyKey: crypto.randomUUID()
  }
  await owner.mutation(api.campaigns.partyInventoryCommands.mutate, { input: adjust })
  state = await read()
  await transfer({
    kind: 'CURRENCY',
    campaignId,
    source: party(campaignId),
    destination: vehicle(cartA.id),
    denominationId: tradeId,
    amount: 6,
    expectedSourceVersion: 6,
    expectedDestinationVersion: 3,
    idempotencyKey: crypto.randomUUID()
  })
  await transfer({
    kind: 'CURRENCY',
    campaignId,
    source: vehicle(cartA.id),
    destination: vehicle(cartB.id),
    denominationId: tradeId,
    amount: 2,
    expectedSourceVersion: 4,
    expectedDestinationVersion: 2,
    idempotencyKey: crypto.randomUUID()
  })
  const converted = await owner.mutation(api.campaigns.currencySystems.save, {
    ...systemInput,
    systemId: system.id,
    expectedVersion: system.version,
    denominations: [
      { id: baseId, label: 'Reference', abbreviation: 'r', scaleInReference: 1 },
      { id: tradeId, label: 'Trade', abbreviation: 't', scaleInReference: 2 }
    ]
  })
  assert.equal(converted.version, 1)
  state = await read()
  const amounts = [state.partyCurrencies, state.aCurrencies, state.bCurrencies].map(
    (entry) => entry.page.find((currency) => currency.denominationId === tradeId)?.amount
  )
  assert.deepEqual(amounts, [12, 8, 4])
  assert.deepEqual(
    [state.partyCurrencies.version, state.aCurrencies.version, state.bCurrencies.version],
    [8, 6, 4]
  )
  const playerPages = await Promise.all([
    completeItemPage(player),
    player.query(api.campaigns.partyInventory.currencies, page(campaignId)),
    player.query(api.campaigns.vehicleInventory.items, {
      ...page(campaignId),
      vehicleId: cartA.id
    }),
    player.query(api.campaigns.vehicleInventory.currencies, {
      ...page(campaignId),
      vehicleId: cartA.id
    }),
    completeItemPage(player, cartB.id),
    player.query(api.campaigns.vehicleInventory.currencies, {
      ...page(campaignId),
      vehicleId: cartB.id
    })
  ])
  assert.deepEqual(playerPages, [
    state.partyItems,
    state.partyCurrencies,
    state.aItems,
    state.aCurrencies,
    state.bItems,
    state.bCurrencies
  ])
  const lossSnapshot = await read()
  await assert.rejects(
    () =>
      owner.mutation(api.campaigns.currencySystems.save, {
        ...systemInput,
        systemId: system.id,
        expectedVersion: 1,
        denominations: [
          { id: baseId, label: 'Reference', abbreviation: 'r', scaleInReference: 1 },
          { id: tradeId, label: 'Trade', abbreviation: 't', scaleInReference: 3 }
        ]
      }),
    /preserve/i
  )
  assert.deepEqual(await read(), lossSnapshot, 'Lossy scale change must be atomic.')

  for (let index = 0; index < (boundedCleanup ? 32 : 0); index++) {
    const version = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: vehicle(cartA.id) }
    })
    await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'ITEM_ADD',
        campaignId,
        vehicleId: cartA.id,
        equipmentId: canonicalClubId,
        quantity: 1,
        expectedOwnerVersion: version.version,
        idempotencyKey: crypto.randomUUID()
      } satisfies CampaignPartyInventoryMutationInput
    })
  }
  const beforeUnshare = await read()
  const campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
  const unshareRequest = {
    campaignId,
    subjectKind: 'VEHICLE' as const,
    subjectId: publication.subjectId,
    sharedBy: share.sharedBy,
    expectedCampaignVersion: campaign.version,
    commandId: crypto.randomUUID()
  }
  await assert.rejects(
    () => player.mutation(api.campaigns.contentShares.unshare, unshareRequest),
    /owner|permission|authorized|cannot remove/i
  )
  assert.deepEqual(
    await read(),
    beforeUnshare,
    'Player unshare refusal must not write inventory state.'
  )
  const receipt = await owner.mutation(api.campaigns.contentShares.unshare, unshareRequest)
  assert.equal(receipt.campaignVersion, campaign.version + 1)
  assert.deepEqual(receipt.removedShares, [
    { subjectKind: 'VEHICLE', subjectId: publication.subjectId, sharedBy: share.sharedBy }
  ])
  assert.deepEqual(receipt.affectedCharacters, [])
  if (boundedCleanup) {
    assert.deepEqual(receipt.evacuatedVehicles, [])
    assert.equal(receipt.pendingVehicleCleanupIds?.length, 1)
  } else {
    assert.deepEqual(
      receipt.evacuatedVehicles.map((evacuated) => evacuated.vehicleId),
      [cartA.id]
    )
    assert.equal(receipt.pendingVehicleCleanupIds, undefined)
  }
  let afterUnshare: Awaited<ReturnType<typeof readAfterEvacuation>> | undefined
  for (let attempt = 0; attempt < 60; attempt++) {
    const vehicles = await owner.query(api.campaigns.vehicles.list, page(campaignId))
    if (!vehicles.page.some((entry) => entry.id === cartA.id)) {
      afterUnshare = await readAfterEvacuation()
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (!afterUnshare) throw new Error('Timed out waiting for durable Vehicle source-loss cleanup.')
  assert.equal(afterUnshare.campaign.version, receipt.campaignVersion)
  assert.deepEqual(
    afterUnshare.vehicles.page.map((vehicle) => vehicle.id),
    [cartB.id]
  )
  assert.equal(afterUnshare.partyItems.version, beforeUnshare.partyItems.version + 1)
  assert.deepEqual(afterUnshare.shares.page, [])
  assert.deepEqual(afterUnshare.bItems, beforeUnshare.bItems)
  assert.deepEqual(afterUnshare.bCurrencies, beforeUnshare.bCurrencies)
  assert.equal(
    afterUnshare.partyCurrencies.page.find((currency) => currency.denominationId === tradeId)
      ?.amount,
    20
  )
  assert.deepEqual(
    afterUnshare.partyItems.page
      .map(({ id, quantity }) => ({ id, quantity }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    [...beforeUnshare.partyItems.page, ...beforeUnshare.aItems.page]
      .map(({ id, quantity }) => ({ id, quantity }))
      .sort((left, right) => left.id.localeCompare(right.id))
  )
  await assert.rejects(() => completeItemPage(owner, cartA.id), /Vehicle|unavailable|content/i)
  const playerAfterUnshare = await Promise.all([
    completeItemPage(player),
    player.query(api.campaigns.partyInventory.currencies, page(campaignId)),
    completeItemPage(player, cartB.id),
    player.query(api.campaigns.vehicleInventory.currencies, {
      ...page(campaignId),
      vehicleId: cartB.id
    })
  ])
  assert.deepEqual(playerAfterUnshare, [
    afterUnshare.partyItems,
    afterUnshare.partyCurrencies,
    afterUnshare.bItems,
    afterUnshare.bCurrencies
  ])
  assert.deepEqual(
    await owner.mutation(api.campaigns.contentShares.unshare, unshareRequest),
    receipt
  )
  assert.deepEqual(
    await readAfterEvacuation(),
    afterUnshare,
    'Exact unshare retry must preserve public state.'
  )
  await assert.rejects(
    () =>
      owner.mutation(api.campaigns.contentShares.unshare, {
        ...unshareRequest,
        expectedCampaignVersion: campaign.version + 1
      }),
    /different input|command/i
  )
  assert.deepEqual(
    await readAfterEvacuation(),
    afterUnshare,
    'Changed unshare retry must preserve public state.'
  )
}
