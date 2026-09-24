import assert from 'node:assert/strict'
import type {
  CampaignVehicleLifecycleInput,
  CampaignVehicleLifecycleResult
} from '@artificer-toolkit/schema/api/campaignVehicles'
import type { CampaignPartyInventoryMutationInput } from '@artificer-toolkit/schema/api/campaignInventory'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { api } from '../convex/_generated/api.js'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'
import type { DevelopmentClient } from './developmentClient'

export async function verifyCampaignVehicleLifecycle(
  cohort: CampaignCustodyCohort,
  anonymous: DevelopmentClient
) {
  const { owner, campaignId } = cohort
  const player = cohort.players[1].client
  const characterId = cohort.characterIds[1]
  const paginationOpts = { cursor: null, numItems: 48 }
  const listInput = { campaignId, paginationOpts }
  const readAllItems = async (vehicleId?: string) => {
    const load = (cursor: string | null) =>
      vehicleId === undefined
        ? owner.query(api.campaigns.partyInventory.items, {
            campaignId,
            paginationOpts: { cursor, numItems: 8 }
          })
        : owner.query(api.campaigns.vehicleInventory.items, {
            campaignId,
            vehicleId,
            paginationOpts: { cursor, numItems: 8 }
          })
    let result = await load(null)
    const version = result.version
    const rows = [...result.page]
    const cursors = new Set<string>()
    while (!result.isDone) {
      assert.equal(result.version, version, 'Inventory pagination must retain one owner version.')
      assert.ok(result.continueCursor)
      assert.equal(cursors.has(result.continueCursor), false, 'Inventory cursor must advance.')
      cursors.add(result.continueCursor)
      result = await load(result.continueCursor)
      rows.push(...result.page)
    }
    assert.equal(result.version, version)
    return { ...result, page: rows, version }
  }
  const currentVehicles = await owner.query(api.campaigns.vehicles.list, listInput)
  assert.equal(currentVehicles.isDone, true)
  assert.equal(currentVehicles.page.length, 1)
  const vehicle = currentVehicles.page[0]!
  const character = await player.query(api.characters.builder.get, { id: characterId })
  assert.ok(character)
  const bag = character.character.state.equipment.inventory.find(
    (item) =>
      item.equipmentId === backpack.id &&
      character.character.state.equipment.inventory.some((child) => child.containerId === item.id)
  )
  assert.ok(bag, 'Lifecycle proof requires the previously transferred filled backpack.')
  const fences = await owner.query(api.campaigns.inventoryOwners.transferVersions, {
    input: {
      campaignId,
      source: { kind: 'CHARACTER', characterId },
      destination: { kind: 'VEHICLE', vehicleId: vehicle.id }
    }
  })
  await owner.mutation(api.campaigns.inventoryTransfers.transfer, {
    input: {
      kind: 'ITEM',
      campaignId,
      source: { kind: 'CHARACTER', characterId },
      destination: { kind: 'VEHICLE', vehicleId: vehicle.id },
      itemId: bag.id,
      amount: 1,
      expectedSourceVersion: fences.sourceVersion,
      expectedDestinationVersion: fences.destinationVersion,
      idempotencyKey: crypto.randomUUID()
    }
  })
  const read = async (vehicleId: string) => {
    const [vehicles, partyItems, partyCurrencies, partyVersion] = await Promise.all([
      owner.query(api.campaigns.vehicles.list, listInput),
      readAllItems(),
      owner.query(api.campaigns.partyInventory.currencies, listInput),
      owner.query(api.campaigns.inventoryOwners.version, {
        input: { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
      })
    ])
    for (const page of [vehicles, partyItems, partyCurrencies]) assert.equal(page.isDone, true)
    const metadata = vehicles.page.find((row) => row.id === vehicleId) ?? null
    const cargo = metadata
      ? await Promise.all([
          readAllItems(vehicleId),
          owner.query(api.campaigns.vehicleInventory.currencies, { ...listInput, vehicleId }),
          owner.query(api.campaigns.inventoryOwners.version, {
            input: { campaignId, owner: { kind: 'VEHICLE', vehicleId } }
          })
        ])
      : null
    if (cargo) {
      assert.equal(cargo[0].isDone, true)
      assert.equal(cargo[1].isDone, true)
    }
    const firstAudit = await owner.query(api.campaigns.inventoryAudit.list, {
      campaignId,
      limit: 32
    })
    const audit = [...firstAudit.events]
    const cursors = new Set<string>()
    let cursor = firstAudit.nextCursor
    while (cursor) {
      assert.equal(cursors.has(cursor), false, 'Audit cursor must advance.')
      cursors.add(cursor)
      const next = await owner.query(api.campaigns.inventoryAudit.list, {
        campaignId,
        limit: 32,
        cursor
      })
      audit.push(...next.events)
      cursor = next.nextCursor
    }
    return { vehicles, partyItems, partyCurrencies, partyVersion, metadata, cargo, audit }
  }
  const execute = async (input: CampaignVehicleLifecycleInput) => {
    const result: CampaignVehicleLifecycleResult = await owner.mutation(
      api.campaigns.vehicles.lifecycle,
      { input }
    )
    const after = await read(input.vehicleId)
    assert.deepEqual(await owner.mutation(api.campaigns.vehicles.lifecycle, { input }), result)
    assert.deepEqual(await read(input.vehicleId), after, 'Exact lifecycle replay must not write.')
    await assert.rejects(
      () =>
        owner.mutation(api.campaigns.vehicles.lifecycle, {
          input: { ...input, expectedVersion: input.expectedVersion + 1 }
        }),
      /different input|already used/i
    )
    await assert.rejects(
      () => player.mutation(api.campaigns.vehicles.lifecycle, { input }),
      /owner|permission|authorized/i
    )
    await assert.rejects(
      () => anonymous.mutation(api.campaigns.vehicles.lifecycle, { input }),
      /identity|authenticated|authorized|permission/i
    )
    assert.deepEqual(
      await read(input.vehicleId),
      after,
      'Changed replay and unauthorized lifecycle commands must not write.'
    )
    assert.equal(after.audit.filter((event) => event.id === result.eventId).length, 1)
    return after
  }
  const before = await read(vehicle.id)
  assert.ok(before.cargo && before.metadata)
  const unavailable = await execute({
    campaignId,
    vehicleId: vehicle.id,
    action: 'MAKE_UNAVAILABLE',
    expectedVersion: before.metadata.version,
    idempotencyKey: crypto.randomUUID()
  })
  assert.equal(unavailable.metadata?.availability, 'UNAVAILABLE')
  assert.equal(unavailable.metadata?.version, before.metadata.version + 1)
  assert.deepEqual(unavailable.cargo, before.cargo)
  const playerVehicles = await player.query(api.campaigns.vehicles.list, listInput)
  assert.equal(playerVehicles.isDone, true)
  assert.equal(
    playerVehicles.page.some((row) => row.id === vehicle.id),
    false
  )
  for (const client of cohort.players.map((entry) => entry.client)) {
    await assert.rejects(
      () =>
        client.query(api.campaigns.vehicleInventory.items, { ...listInput, vehicleId: vehicle.id }),
      /unavailable|permission|authorized/i
    )
    await assert.rejects(
      () =>
        client.query(api.campaigns.vehicleInventory.currencies, {
          ...listInput,
          vehicleId: vehicle.id
        }),
      /unavailable|permission|authorized/i
    )
    await assert.rejects(
      () =>
        client.query(api.campaigns.inventoryOwners.version, {
          input: { campaignId, owner: { kind: 'VEHICLE', vehicleId: vehicle.id } }
        }),
      /unavailable|permission|authorized/i
    )
    await assert.rejects(
      () =>
        client.query(api.campaigns.inventoryOwners.transferVersions, {
          input: {
            campaignId,
            source: {
              kind: 'CHARACTER',
              characterId:
                cohort.characterIds[cohort.players.findIndex((entry) => entry.client === client)]!
            },
            destination: { kind: 'VEHICLE', vehicleId: vehicle.id }
          }
        }),
      /unavailable|permission|authorized/i
    )
  }
  assert.deepEqual(await read(vehicle.id), unavailable)
  const restored = await execute({
    campaignId,
    vehicleId: vehicle.id,
    action: 'RESTORE',
    expectedVersion: unavailable.metadata!.version,
    idempotencyKey: crypto.randomUUID()
  })
  assert.equal(restored.metadata?.availability, 'AVAILABLE')
  assert.deepEqual(restored.cargo, before.cargo)
  assert.deepEqual(
    await player.query(api.campaigns.vehicleInventory.items, {
      ...listInput,
      vehicleId: vehicle.id
    }),
    restored.cargo![0]
  )
  assert.deepEqual(
    await player.query(api.campaigns.vehicleInventory.currencies, {
      ...listInput,
      vehicleId: vehicle.id
    }),
    restored.cargo![1]
  )
  await assert.rejects(
    () =>
      owner.mutation(api.campaigns.vehicles.remove, {
        campaignId,
        vehicleId: vehicle.id,
        expectedVersion: restored.metadata!.version
      }),
    /nonempty|lifecycle/i
  )
  const removal: CampaignVehicleLifecycleInput = {
    campaignId,
    vehicleId: vehicle.id,
    action: 'REMOVE_RETURN_CARGO',
    expectedVersion: restored.metadata!.version,
    expectedInventoryVersion: restored.cargo![2].version,
    expectedPartyInventoryVersion: restored.partyVersion.version,
    idempotencyKey: crypto.randomUUID()
  }
  await assert.rejects(
    () =>
      owner.mutation(api.campaigns.vehicles.lifecycle, {
        input: { ...removal, expectedInventoryVersion: removal.expectedInventoryVersion + 1 }
      }),
    /changed|version/i
  )
  assert.deepEqual(await read(vehicle.id), restored)
  const returned = await execute(removal)
  assert.equal(returned.metadata, null)
  assert.equal(returned.cargo, null)
  assert.equal(returned.partyVersion.version, restored.partyVersion.version + 1)
  for (const item of restored.cargo![0].page)
    assert.deepEqual(
      returned.partyItems.page.find((row) => row.id === item.id),
      item
    )
  const totalCoins = (rows: typeof returned.partyCurrencies.page) =>
    rows.reduce((sum, row) => sum + BigInt(row.amount), 0n)
  assert.equal(
    totalCoins(returned.partyCurrencies.page),
    totalCoins(restored.partyCurrencies.page) + totalCoins(restored.cargo![1].page)
  )
  for (const row of restored.cargo![1].page.filter((row) => row.containerId === bag.id))
    assert.deepEqual(
      returned.partyCurrencies.page.find(
        (candidate) =>
          candidate.denominationId === row.denominationId &&
          candidate.campaignCurrencySystemId === row.campaignCurrencySystemId &&
          candidate.containerId === row.containerId
      ),
      row
    )
  await assert.rejects(
    () =>
      owner.query(api.campaigns.vehicleInventory.items, { ...listInput, vehicleId: vehicle.id }),
    /unavailable/i
  )

  const nested = returned.partyItems.page.filter((item) => item.containerId === bag.id)
  assert.equal(nested.length, 1)
  const placedCoins = returned.partyCurrencies.page.filter((row) => row.containerId === bag.id)
  assert.equal(placedCoins.length, 1)
  const heldCoins = placedCoins[0]!
  await assert.rejects(
    () =>
      owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: {
          kind: 'ITEM_REMOVE',
          campaignId,
          itemId: bag.id,
          expectedOwnerVersion: returned.partyVersion.version,
          idempotencyKey: crypto.randomUUID()
        }
      }),
    /Empty a container/i
  )
  assert.deepEqual(await read(vehicle.id), returned)
  let partyVersion = returned.partyVersion.version
  for (const fields of [
    {
      kind: 'ITEM_UPDATE' as const,
      itemId: nested[0]!.id,
      quantity: nested[0]!.quantity,
      containerId: null
    },
    {
      kind: 'CURRENCY_MOVE' as const,
      denominationId: heldCoins.denominationId,
      campaignCurrencySystemId: heldCoins.campaignCurrencySystemId ?? null,
      fromContainerId: bag.id,
      toContainerId: null,
      amount: heldCoins.amount
    },
    { kind: 'ITEM_REMOVE' as const, itemId: bag.id }
  ]) {
    const input: CampaignPartyInventoryMutationInput = {
      ...fields,
      campaignId,
      expectedOwnerVersion: partyVersion,
      idempotencyKey: crypto.randomUUID()
    }
    const result = await owner.mutation(api.campaigns.partyInventoryCommands.mutate, { input })
    const after = await read(vehicle.id)
    assert.equal(after.partyVersion.version, ++partyVersion)
    assert.equal(totalCoins(after.partyCurrencies.page), totalCoins(returned.partyCurrencies.page))
    assert.deepEqual(
      await owner.mutation(api.campaigns.partyInventoryCommands.mutate, { input }),
      result
    )
    assert.deepEqual(await read(vehicle.id), after)
  }
  const emptied = await read(vehicle.id)
  assert.equal(
    emptied.partyItems.page.some((item) => item.id === bag.id),
    false
  )
  assert.equal(emptied.partyItems.page.find((item) => item.id === nested[0]!.id)?.containerId, null)
  assert.equal(
    emptied.partyCurrencies.page.some((row) => row.containerId === bag.id),
    false
  )

  const destroyedVehicle = await owner.mutation(api.campaigns.vehicles.create, {
    campaignId,
    vehicleDefinitionId: cart.id,
    label: 'P13 destroyed cart'
  })
  const produce = async (
    vehicleId: string,
    fields:
      | Omit<
          Extract<CampaignPartyInventoryMutationInput, { kind: 'ITEM_ADD' }>,
          'campaignId' | 'vehicleId' | 'expectedOwnerVersion' | 'idempotencyKey'
        >
      | Omit<
          Extract<CampaignPartyInventoryMutationInput, { kind: 'CURRENCY_ADJUST' }>,
          'campaignId' | 'vehicleId' | 'expectedOwnerVersion' | 'idempotencyKey'
        >
  ) => {
    const version = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: { kind: 'VEHICLE', vehicleId } }
    })
    await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        ...fields,
        campaignId,
        vehicleId,
        expectedOwnerVersion: version.version,
        idempotencyKey: crypto.randomUUID()
      }
    })
  }
  await produce(destroyedVehicle.id, { kind: 'ITEM_ADD', equipmentId: backpack.id, quantity: 1 })
  const addedItems = await owner.query(api.campaigns.vehicleInventory.items, {
    ...listInput,
    vehicleId: destroyedVehicle.id
  })
  assert.equal(addedItems.isDone, true)
  const destroyedBag = addedItems.page[0]!
  await produce(destroyedVehicle.id, {
    kind: 'ITEM_ADD',
    equipmentId: club.id,
    quantity: 1,
    containerId: destroyedBag.id
  })
  const denominationId = restored.cargo![1].page.find(
    (row) => row.containerId === bag.id
  )?.denominationId
  assert.ok(denominationId)
  await produce(destroyedVehicle.id, {
    kind: 'CURRENCY_ADJUST',
    denominationId,
    amount: 7,
    containerId: destroyedBag.id
  })
  const destroyBefore = await read(destroyedVehicle.id)
  assert.equal(destroyBefore.cargo![0].page.length, 2)
  assert.equal(totalCoins(destroyBefore.cargo![1].page), 7n)
  const destroy: CampaignVehicleLifecycleInput = {
    campaignId,
    vehicleId: destroyedVehicle.id,
    action: 'REMOVE_DESTROY_CARGO',
    expectedVersion: destroyedVehicle.version,
    expectedInventoryVersion: destroyBefore.cargo![2].version,
    idempotencyKey: crypto.randomUUID()
  }
  await assert.rejects(
    () =>
      owner.mutation(api.campaigns.vehicles.lifecycle, {
        input: { ...destroy, expectedInventoryVersion: destroy.expectedInventoryVersion - 1 }
      }),
    /changed|version/i
  )
  assert.deepEqual(await read(destroyedVehicle.id), destroyBefore)
  const destroyed = await execute(destroy)
  assert.equal(destroyed.metadata, null)
  assert.equal(destroyed.cargo, null)
  assert.deepEqual(destroyed.partyItems, destroyBefore.partyItems)
  assert.deepEqual(destroyed.partyCurrencies, destroyBefore.partyCurrencies)
  assert.deepEqual(destroyed.partyVersion, destroyBefore.partyVersion)
  await assert.rejects(
    () =>
      owner.query(api.campaigns.vehicleInventory.currencies, {
        ...listInput,
        vehicleId: destroyedVehicle.id
      }),
    /unavailable/i
  )
  const backgroundVehicle = await owner.mutation(api.campaigns.vehicles.create, {
    campaignId,
    vehicleDefinitionId: cart.id,
    label: 'P13 durable cleanup cart'
  })
  for (let index = 0; index < 33; index++)
    await produce(backgroundVehicle.id, { kind: 'ITEM_ADD', equipmentId: club.id, quantity: 1 })
  await produce(backgroundVehicle.id, {
    kind: 'CURRENCY_ADJUST',
    denominationId,
    amount: 1
  })

  const readAudit = async () => {
    const first = await owner.query(api.campaigns.inventoryAudit.list, { campaignId, limit: 32 })
    const events = [...first.events]
    let cursor = first.nextCursor
    const cursors = new Set<string>()
    while (cursor) {
      assert.equal(cursors.has(cursor), false, 'Audit cursor must advance.')
      cursors.add(cursor)
      const next = await owner.query(api.campaigns.inventoryAudit.list, {
        campaignId,
        limit: 32,
        cursor
      })
      events.push(...next.events)
      cursor = next.nextCursor
    }
    return events
  }

  const sourceItems = await readAllItems(backgroundVehicle.id)
  assert.equal(sourceItems.page.length, 33)
  assert.equal(new Set(sourceItems.page.map((item) => item.id)).size, 33)
  const sourceCurrencies = await owner.query(api.campaigns.vehicleInventory.currencies, {
    ...listInput,
    vehicleId: backgroundVehicle.id
  })
  assert.equal(sourceCurrencies.isDone, true)
  assert.equal(sourceCurrencies.page.length, 1)
  assert.equal(sourceCurrencies.page[0]!.amount, 1)
  assert.equal(sourceCurrencies.version, sourceItems.version)

  const partyCurrenciesBefore = await owner.query(
    api.campaigns.partyInventory.currencies,
    listInput
  )
  assert.equal(partyCurrenciesBefore.isDone, true)
  const destinationCurrency = partyCurrenciesBefore.page.find(
    (row) =>
      row.denominationId === denominationId &&
      row.campaignCurrencySystemId === undefined &&
      row.containerId === null
  )
  const saturationAmount = Number.MAX_SAFE_INTEGER - (destinationCurrency?.amount ?? 0)
  assert.ok(saturationAmount > 0)
  await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
    input: {
      kind: 'CURRENCY_ADJUST',
      campaignId,
      denominationId,
      amount: saturationAmount,
      expectedOwnerVersion: partyCurrenciesBefore.version,
      idempotencyKey: crypto.randomUUID()
    }
  })
  const saturatedParty = await owner.query(api.campaigns.partyInventory.currencies, listInput)
  assert.equal(
    saturatedParty.page.find(
      (row) =>
        row.denominationId === denominationId &&
        row.campaignCurrencySystemId === undefined &&
        row.containerId === null
    )?.amount,
    Number.MAX_SAFE_INTEGER
  )

  const backgroundInput: CampaignVehicleLifecycleInput = {
    campaignId,
    vehicleId: backgroundVehicle.id,
    action: 'REMOVE_RETURN_CARGO',
    expectedVersion: backgroundVehicle.version,
    expectedInventoryVersion: sourceItems.version,
    expectedPartyInventoryVersion: saturatedParty.version,
    idempotencyKey: crypto.randomUUID()
  }
  const backgroundReceipt = await owner.mutation(api.campaigns.vehicles.lifecycle, {
    input: backgroundInput
  })
  assert.ok(backgroundReceipt.cleanupJobId)
  const cleanupJobId = backgroundReceipt.cleanupJobId
  assert.deepEqual(
    await owner.mutation(api.campaigns.vehicles.lifecycle, { input: backgroundInput }),
    backgroundReceipt
  )
  await assert.rejects(
    () =>
      owner.mutation(api.campaigns.vehicles.lifecycle, {
        input: { ...backgroundInput, expectedPartyInventoryVersion: saturatedParty.version + 1 }
      }),
    /different input|already used/i
  )
  await assert.rejects(
    () => player.mutation(api.campaigns.vehicles.lifecycle, { input: backgroundInput }),
    /owner|permission|authorized/i
  )
  await assert.rejects(
    () => anonymous.mutation(api.campaigns.vehicles.lifecycle, { input: backgroundInput }),
    /identity|authenticated|authorized|permission/i
  )

  const sourcePending = await owner.query(api.campaigns.vehicleInventory.items, {
    campaignId,
    vehicleId: backgroundVehicle.id,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  assert.deepEqual(sourcePending.page, [])
  assert.ok(
    sourcePending.pendingCleanup?.some(
      (entry) => entry.kind === 'CARGO' && entry.jobId === cleanupJobId
    )
  )
  await assert.rejects(
    () =>
      owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: {
          kind: 'ITEM_ADD',
          campaignId,
          vehicleId: backgroundVehicle.id,
          equipmentId: club.id,
          quantity: 1,
          expectedOwnerVersion: sourceItems.version + 1,
          idempotencyKey: crypto.randomUUID()
        }
      }),
    /cleanup|pending|updating/i
  )

  const unrelatedBefore = await readAllItems()
  await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
    input: {
      kind: 'ITEM_ADD',
      campaignId,
      equipmentId: club.id,
      quantity: 1,
      expectedOwnerVersion: unrelatedBefore.version,
      idempotencyKey: crypto.randomUUID()
    }
  })
  const unrelatedAfter = await readAllItems()
  const oldIds = new Set(unrelatedBefore.page.map((item) => item.id))
  const unrelatedItem = unrelatedAfter.page.find((item) => !oldIds.has(item.id))
  assert.ok(unrelatedItem, 'Unrelated party inventory must stay writable during cleanup.')

  let failedNotice: { jobId: string; status: 'RUNNING' | 'FAILED'; retryReady: boolean } | undefined
  for (let attempt = 0; attempt < 100; attempt++) {
    const pending = await owner.query(api.campaigns.inventoryCleanup.pending, {
      campaignId,
      vehicleId: backgroundVehicle.id,
      paginationOpts
    })
    failedNotice = pending.page.find((entry) => entry.jobId === cleanupJobId)
    if (failedNotice?.status === 'FAILED' && failedNotice.retryReady) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.deepEqual(failedNotice, { jobId: cleanupJobId, status: 'FAILED', retryReady: true })
  const playerPending = await player.query(api.campaigns.inventoryCleanup.pending, {
    campaignId,
    vehicleId: backgroundVehicle.id,
    paginationOpts
  })
  assert.deepEqual(playerPending.page, [
    { jobId: cleanupJobId, status: 'FAILED', retryReady: false }
  ])
  await assert.rejects(
    () =>
      anonymous.query(api.campaigns.inventoryCleanup.pending, {
        campaignId,
        vehicleId: backgroundVehicle.id,
        paginationOpts
      }),
    /identity|authenticated|authorized|permission/i
  )
  for (const client of [player, anonymous])
    await assert.rejects(
      () =>
        client.mutation(api.campaigns.inventoryCleanup.retry, { campaignId, jobId: cleanupJobId }),
      /identity|authenticated|owner|permission|authorized/i
    )

  const failedParty = await owner.query(api.campaigns.partyInventory.currencies, listInput)
  assert.equal(
    failedParty.page.find(
      (row) =>
        row.denominationId === denominationId &&
        row.campaignCurrencySystemId === undefined &&
        row.containerId === null
    )?.amount,
    Number.MAX_SAFE_INTEGER,
    'Failed cleanup must release its currency lock without changing the balance.'
  )
  await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
    input: {
      kind: 'CURRENCY_ADJUST',
      campaignId,
      denominationId,
      amount: -1,
      expectedOwnerVersion: failedParty.version,
      idempotencyKey: crypto.randomUUID()
    }
  })
  const reducedParty = await owner.query(api.campaigns.partyInventory.currencies, listInput)
  assert.equal(
    await owner.mutation(api.campaigns.inventoryCleanup.retry, { campaignId, jobId: cleanupJobId }),
    null
  )
  assert.equal(
    await owner.mutation(api.campaigns.inventoryCleanup.retry, { campaignId, jobId: cleanupJobId }),
    null
  )

  let backgroundRemoved = false
  for (let attempt = 0; attempt < 100; attempt++) {
    const vehicles = await owner.query(api.campaigns.vehicles.list, listInput)
    if (!vehicles.page.some((entry) => entry.id === backgroundVehicle.id)) {
      backgroundRemoved = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.equal(backgroundRemoved, true, 'Timed out waiting for durable Vehicle cleanup.')

  const finalItems = await readAllItems()
  const finalCurrencies = await owner.query(api.campaigns.partyInventory.currencies, listInput)
  assert.equal(finalCurrencies.isDone, true)
  assert.equal(finalItems.version, reducedParty.version + 1)
  for (const item of sourceItems.page)
    assert.deepEqual(
      finalItems.page.filter((candidate) => candidate.id === item.id),
      [item],
      'Durable cleanup must transfer every source item exactly once.'
    )
  assert.deepEqual(
    finalItems.page.filter((item) => item.id === unrelatedItem.id),
    [unrelatedItem]
  )
  assert.equal(
    finalCurrencies.page.find(
      (row) =>
        row.denominationId === denominationId &&
        row.campaignCurrencySystemId === undefined &&
        row.containerId === null
    )?.amount,
    Number.MAX_SAFE_INTEGER
  )
  await assert.rejects(
    () =>
      owner.query(api.campaigns.vehicleInventory.items, {
        campaignId,
        vehicleId: backgroundVehicle.id,
        paginationOpts: { cursor: null, numItems: 8 }
      }),
    /unavailable/i
  )
  const finalAudit = await readAudit()
  assert.equal(finalAudit.filter((event) => event.id === backgroundReceipt.eventId).length, 1)

  const settled = { items: finalItems, currencies: finalCurrencies, audit: finalAudit }
  assert.deepEqual(
    await owner.mutation(api.campaigns.vehicles.lifecycle, { input: backgroundInput }),
    backgroundReceipt
  )
  assert.deepEqual(
    {
      items: await readAllItems(),
      currencies: await owner.query(api.campaigns.partyInventory.currencies, listInput),
      audit: await readAudit()
    },
    settled,
    'Completed cleanup replay must not duplicate cargo, money or audit.'
  )

  console.log(
    'Vehicle lifecycle: unavailable cargo stayed accessible to the DM and hidden from both Players; restoration preserved cargo; removal returned filled containers and qualified coins or destroyed cargo by explicit choice; oversized cleanup failed safely, kept unrelated inventory usable, retried, converged exactly once, and preserved sealed replay.'
  )
}
