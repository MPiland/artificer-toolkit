import assert from 'node:assert/strict'
import type {
  CampaignInventoryAuditEventDto,
  CampaignPartyInventoryMutationInput,
  InventoryOwnerRefDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import { decodeCampaignInventoryAuditPage } from '@artificer-toolkit/schema/api/campaignInventoryPages'
import type { CampaignVehicleLifecycleInput } from '@artificer-toolkit/schema/api/campaignVehicles'
import type {
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { api } from '../convex/_generated/api.js'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'
import type { DevelopmentClient } from './developmentClient'

type CharacterCommand =
  | Omit<
      Extract<CharacterSheetCommandInputDto, { type: 'ADD_INVENTORY_ITEM' }>,
      'commandId' | 'expectedVersion'
    >
  | Omit<
      Extract<CharacterSheetCommandInputDto, { type: 'UPDATE_INVENTORY_ITEM' }>,
      'commandId' | 'expectedVersion'
    >
  | Omit<
      Extract<CharacterSheetCommandInputDto, { type: 'REMOVE_INVENTORY_ITEM' }>,
      'commandId' | 'expectedVersion'
    >
type SharedCommand =
  | Omit<
      Extract<CampaignPartyInventoryMutationInput, { kind: 'ITEM_ADD' }>,
      'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey' | 'vehicleId'
    >
  | Omit<
      Extract<CampaignPartyInventoryMutationInput, { kind: 'ITEM_UPDATE' }>,
      'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey' | 'vehicleId'
    >
  | Omit<
      Extract<CampaignPartyInventoryMutationInput, { kind: 'ITEM_CONSUME' }>,
      'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey' | 'vehicleId'
    >
  | Omit<
      Extract<CampaignPartyInventoryMutationInput, { kind: 'ITEM_REMOVE' }>,
      'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey' | 'vehicleId'
    >
type Audit = CampaignInventoryAuditEventDto

async function collectPages<T>(
  load: (cursor: string | null) => Promise<{ page: T[]; isDone: boolean; continueCursor: string }>
) {
  const rows: T[] = []
  const cursors = new Set<string>()
  let cursor: string | null = null
  while (true) {
    const result = await load(cursor)
    rows.push(...result.page)
    if (result.isDone) return rows
    assert.ok(result.continueCursor, 'Incomplete pagination requires a cursor.')
    assert.equal(cursors.has(result.continueCursor), false, 'Pagination must advance.')
    cursors.add(result.continueCursor)
    cursor = result.continueCursor
  }
}

async function collectInventory<T>(
  load: (cursor: string | null) => Promise<{
    owner: InventoryOwnerRefDto
    version: number
    page: T[]
    isDone: boolean
    continueCursor: string
  }>
) {
  let fence: { owner: InventoryOwnerRefDto; version: number } | undefined
  const page = await collectPages(async (cursor) => {
    const result = await load(cursor)
    const current = { owner: result.owner, version: result.version }
    if (fence)
      assert.deepEqual(current, fence, 'Every page must retain its owner and version fence.')
    else fence = current
    return result
  })
  assert.ok(fence)
  return { ...fence, page }
}

/**
 * Public direct item-producer proof for Character, party, and Vehicle holdings.
 */
export async function verifyCampaignItemProducers(
  cohort: CampaignCustodyCohort,
  anonymous: DevelopmentClient
) {
  const { owner, players, campaignId, characterIds } = cohort
  const [firstPlayer, otherPlayer] = players
  const [firstCharacterId, otherCharacterId] = characterIds
  assert.ok(firstPlayer && otherPlayer && firstCharacterId && otherCharacterId)
  const pagination = (cursor: string | null) => ({
    campaignId,
    paginationOpts: { cursor, numItems: 1 }
  })
  const ownerRef = (vehicleId?: string): InventoryOwnerRefDto =>
    vehicleId === undefined ? { kind: 'CAMPAIGN', campaignId } : { kind: 'VEHICLE', vehicleId }
  const items = (vehicleId?: string) =>
    collectInventory((cursor) =>
      vehicleId === undefined
        ? owner.query(api.campaigns.partyInventory.items, pagination(cursor))
        : owner.query(api.campaigns.vehicleInventory.items, { ...pagination(cursor), vehicleId })
    )
  const currencies = (vehicleId?: string) =>
    collectInventory((cursor) =>
      vehicleId === undefined
        ? owner.query(api.campaigns.partyInventory.currencies, pagination(cursor))
        : owner.query(api.campaigns.vehicleInventory.currencies, {
            ...pagination(cursor),
            vehicleId
          })
    )
  const audit = async () => {
    const rows: Audit[] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    while (true) {
      const page = decodeCampaignInventoryAuditPage(
        await owner.query(api.campaigns.inventoryAudit.list, {
          campaignId,
          limit: 1,
          ...(cursor === undefined ? {} : { cursor })
        })
      )
      rows.push(...page.events)
      if (page.nextCursor === null) return rows
      assert.equal(cursors.has(page.nextCursor), false, 'Audit pagination must advance.')
      cursors.add(page.nextCursor)
      cursor = page.nextCursor
    }
  }
  const readShared = async (vehicleId?: string) => {
    const [heldItems, heldCurrencies, fence] = await Promise.all([
      items(vehicleId),
      currencies(vehicleId),
      owner.query(api.campaigns.inventoryOwners.version, {
        input: { campaignId, owner: ownerRef(vehicleId) }
      })
    ])
    assert.deepEqual(heldItems.owner, ownerRef(vehicleId))
    assert.deepEqual(heldCurrencies.owner, ownerRef(vehicleId))
    assert.equal(heldItems.version, heldCurrencies.version)
    assert.equal(heldItems.version, fence.version)
    assert.equal(new Set(heldItems.page.map((item) => item.id)).size, heldItems.page.length)
    return { items: heldItems, currencies: heldCurrencies, fence }
  }
  const read = async () => {
    const vehicles = await collectPages((cursor) =>
      owner.query(api.campaigns.vehicles.list, pagination(cursor))
    )
    const [party, characters, auditRows] = await Promise.all([
      readShared(),
      Promise.all(
        characterIds.map(async (id, index) => {
          const player = players[index]
          assert.ok(player)
          const [active, sheet, draft, fence] = await Promise.all([
            player.client.query(api.characters.builder.activeCharacter, { id }),
            player.client.query(api.characters.sheet.get, { id }),
            player.client.query(api.characters.drafts.get, { id }),
            owner.query(api.campaigns.inventoryOwners.version, {
              input: { campaignId, owner: { kind: 'CHARACTER', characterId: id } }
            })
          ])
          assert.ok(active && sheet)
          assert.equal(sheet.meta.viewer, 'CHARACTER_OWNER')
          assert.equal(sheet.meta.streamVersion, fence.version)
          return { id, active, sheet, draft, fence }
        })
      ),
      audit()
    ])
    const cargo = await Promise.all(
      vehicles.map(async (vehicle) => ({ vehicle, state: await readShared(vehicle.id) }))
    )
    return { vehicles, party, characters, cargo, audit: auditRows }
  }
  type Snapshot = Awaited<ReturnType<typeof read>>
  const character = (snapshot: Snapshot, id: string) => {
    const found = snapshot.characters.find((entry) => entry.id === id)
    assert.ok(found)
    return found
  }
  const shared = (snapshot: Snapshot, vehicleId?: string) => {
    if (vehicleId === undefined) return snapshot.party
    const found = snapshot.cargo.find((entry) => entry.vehicle.id === vehicleId)
    assert.ok(found)
    return found.state
  }
  const item = (state: Awaited<ReturnType<typeof readShared>>, id: string) => {
    const found = state.items.page.find((entry) => entry.id === id)
    assert.ok(found)
    return found
  }
  const noWrites = async (label: string, operation: () => Promise<unknown>) => {
    const before = await read()
    await assert.rejects(
      operation,
      /identity|authenticated|owner|authorized|permission|unavailable/i
    )
    assert.deepEqual(await read(), before, label + ' must not write.')
  }
  const assertAudit = (
    snapshot: Snapshot,
    eventId: string,
    type: string,
    action: string,
    itemId: string,
    vehicleId?: string
  ) => {
    const event = snapshot.audit.find((row) => row.id === eventId)
    assert.ok(event)
    assert.equal(event.kind, type)
    assert.equal(event.visibility, 'OWNER')
    assert.deepEqual(event.payload, {
      action,
      custody:
        vehicleId === undefined
          ? { kind: 'CAMPAIGN', campaignId, ownerId: campaignId }
          : { kind: 'VEHICLE', campaignId, vehicleId, ownerId: vehicleId },
      itemId,
      ...(action === 'ITEM_ADD' ? { equipmentId: club.id } : {}),
      itemLabel: 'Club',
      beforeQuantity:
        action === 'ITEM_ADD'
          ? 0
          : action === 'ITEM_UPDATE'
            ? 3
            : action === 'ITEM_CONSUME'
              ? 4
              : 3,
      afterQuantity:
        action === 'ITEM_ADD'
          ? 3
          : action === 'ITEM_UPDATE'
            ? 4
            : action === 'ITEM_CONSUME'
              ? 3
              : 0,
      ...(action === 'ITEM_CONSUME' ? { consumedQuantity: 1 } : {})
    })
  }
  const replayShared = async (
    input: CampaignPartyInventoryMutationInput,
    settled: { eventId: string }
  ) => {
    const before = await read()
    assert.deepEqual(
      await owner.mutation(api.campaigns.partyInventoryCommands.mutate, { input }),
      settled,
      'Exact shared replay must retain its event receipt.'
    )
    assert.deepEqual(
      await read(),
      before,
      'Exact shared replay must not write after later mutations.'
    )
  }
  const mutate = async (fields: SharedCommand, vehicleId?: string) => {
    const before = await read()
    const ownerBefore = shared(before, vehicleId)
    const input: CampaignPartyInventoryMutationInput = {
      ...fields,
      campaignId,
      expectedOwnerVersion: ownerBefore.fence.version,
      idempotencyKey: crypto.randomUUID(),
      ...(vehicleId === undefined ? {} : { vehicleId })
    }
    const settled = await owner.mutation(api.campaigns.partyInventoryCommands.mutate, { input })
    const after = await read()
    const ownerAfter = shared(after, vehicleId)
    assert.equal(ownerAfter.fence.version, ownerBefore.fence.version + 1)
    assert.deepEqual(ownerAfter.currencies.page, ownerBefore.currencies.page)
    return { input, settled, before, after }
  }
  const executeCharacter = async (fields: CharacterCommand) => {
    const before = await read()
    const current = character(before, firstCharacterId).sheet
    const command: CharacterSheetCommandInputDto = {
      ...fields,
      commandId: crypto.randomUUID(),
      expectedVersion: current.meta.streamVersion
    }
    const settled = await firstPlayer.client.mutation(api.characters.sheetCommands.execute, {
      id: firstCharacterId,
      command
    })
    const after = await read()
    assert.equal(settled.streamVersion, current.meta.streamVersion + 1)
    assert.equal(character(after, firstCharacterId).sheet.meta.streamVersion, settled.streamVersion)
    return { command, settled, before, after }
  }
  const replayCharacter = async (
    command: CharacterSheetCommandInputDto,
    settled: CharacterSheetCommandResponseDto
  ) => {
    const before = await read()
    const replay = await firstPlayer.client.mutation(api.characters.sheetCommands.execute, {
      id: firstCharacterId,
      command
    })
    const after = await read()
    assert.deepEqual(after, before, 'Character receipt replay must not write.')
    assert.equal(replay.characterId, settled.characterId)
    assert.deepEqual(replay.historyEntry, settled.historyEntry)
    assert.deepEqual(replay.sheet, character(before, firstCharacterId).sheet)
    assert.equal(replay.streamVersion, character(before, firstCharacterId).sheet.meta.streamVersion)
  }

  const initial = await read()
  const firstInitial = character(initial, firstCharacterId)
  const secondInitial = character(initial, otherCharacterId)
  await noWrites('anonymous party add', () =>
    anonymous.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'ITEM_ADD',
        campaignId,
        equipmentId: club.id,
        quantity: 3,
        expectedOwnerVersion: initial.party.fence.version,
        idempotencyKey: crypto.randomUUID()
      }
    })
  )
  await noWrites('player party add', () =>
    firstPlayer.client.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'ITEM_ADD',
        campaignId,
        equipmentId: club.id,
        quantity: 3,
        expectedOwnerVersion: initial.party.fence.version,
        idempotencyKey: crypto.randomUUID()
      }
    })
  )
  await noWrites('other player character add', () =>
    otherPlayer.client.mutation(api.characters.sheetCommands.execute, {
      id: firstCharacterId,
      command: {
        type: 'ADD_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: firstInitial.sheet.meta.streamVersion,
        equipmentId: club.id,
        quantity: 3
      }
    })
  )

  const characterAdd = await executeCharacter({
    type: 'ADD_INVENTORY_ITEM',
    equipmentId: club.id,
    quantity: 3,
    customName: 'P12 direct item',
    notes: 'Private direct item proof.'
  })
  const afterCharacterAdd = characterAdd.after
  const characterAdded = afterCharacterAdd.characters[0]!.active.state.equipment.inventory.filter(
    (entry) => !firstInitial.active.state.equipment.inventory.some((old) => old.id === entry.id)
  )
  assert.equal(characterAdded.length, 1)
  const characterItemId = characterAdded[0]!.id
  assert.equal(characterAdded[0]!.quantity, 3)
  const characterUpdate = await executeCharacter({
    type: 'UPDATE_INVENTORY_ITEM',
    itemId: characterItemId,
    quantity: 4,
    customName: 'P12 renamed item',
    notes: 'Private renamed direct item proof.'
  })
  assert.deepEqual(
    character(characterUpdate.after, firstCharacterId).active.state.equipment.inventory.find(
      (entry) => entry.id === characterItemId
    ),
    {
      ...characterAdded[0],
      quantity: 4,
      customName: 'P12 renamed item',
      notes: 'Private renamed direct item proof.'
    }
  )
  const characterConsume = await executeCharacter({
    type: 'REMOVE_INVENTORY_ITEM',
    itemId: characterItemId,
    quantity: 1
  })
  assert.equal(
    character(characterConsume.after, firstCharacterId).active.state.equipment.inventory.find(
      (entry) => entry.id === characterItemId
    )?.quantity,
    3
  )
  const characterRemove = await executeCharacter({
    type: 'REMOVE_INVENTORY_ITEM',
    itemId: characterItemId
  })
  assert.equal(
    character(characterRemove.after, firstCharacterId).active.state.equipment.inventory.some(
      (entry) => entry.id === characterItemId
    ),
    false
  )
  for (const receipt of [characterAdd, characterUpdate, characterConsume, characterRemove])
    await replayCharacter(receipt.command, receipt.settled)

  const cartVehicle = await owner.mutation(api.campaigns.vehicles.create, {
    campaignId,
    vehicleDefinitionId: cart.id,
    label: 'P12 direct item cart'
  })
  const operateShared = async (vehicleId?: string) => {
    const add = await mutate({ kind: 'ITEM_ADD', equipmentId: club.id, quantity: 3 }, vehicleId)
    const added = shared(add.after, vehicleId).items.page.filter(
      (entry) => !shared(add.before, vehicleId).items.page.some((old) => old.id === entry.id)
    )
    assert.equal(added.length, 1)
    const itemId = added[0]!.id
    assert.equal(added[0]!.quantity, 3)
    assertAudit(await read(), add.settled.eventId, 'PARTY_ITEM_ADD', 'ITEM_ADD', itemId, vehicleId)
    const update = await mutate({ kind: 'ITEM_UPDATE', itemId, quantity: 4 }, vehicleId)
    assert.equal(item(shared(update.after, vehicleId), itemId).quantity, 4)
    assertAudit(
      await read(),
      update.settled.eventId,
      'PARTY_ITEM_UPDATE',
      'ITEM_UPDATE',
      itemId,
      vehicleId
    )
    const consume = await mutate({ kind: 'ITEM_CONSUME', itemId, amount: 1 }, vehicleId)
    assert.equal(item(shared(consume.after, vehicleId), itemId).quantity, 3)
    assertAudit(
      await read(),
      consume.settled.eventId,
      'PARTY_ITEM_CONSUME',
      'ITEM_CONSUME',
      itemId,
      vehicleId
    )
    const remove = await mutate({ kind: 'ITEM_REMOVE', itemId }, vehicleId)
    assert.equal(
      shared(remove.after, vehicleId).items.page.some((entry) => entry.id === itemId),
      false
    )
    assertAudit(
      await read(),
      remove.settled.eventId,
      'PARTY_ITEM_REMOVE',
      'ITEM_REMOVE',
      itemId,
      vehicleId
    )
    for (const receipt of [add, update, consume, remove])
      await replayShared(receipt.input, receipt.settled)
    return { itemId, operations: [add, update, consume, remove] }
  }
  const party = await operateShared()
  const vehicle = await operateShared(cartVehicle.id)
  const vehicleRefusalFence = shared(await read(), cartVehicle.id).fence.version
  await noWrites('anonymous vehicle add', () =>
    anonymous.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'ITEM_ADD',
        campaignId,
        vehicleId: cartVehicle.id,
        equipmentId: club.id,
        quantity: 3,
        expectedOwnerVersion: vehicleRefusalFence,
        idempotencyKey: crypto.randomUUID()
      }
    })
  )
  await noWrites('player vehicle add', () =>
    firstPlayer.client.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'ITEM_ADD',
        campaignId,
        vehicleId: cartVehicle.id,
        equipmentId: club.id,
        quantity: 3,
        expectedOwnerVersion: vehicleRefusalFence,
        idempotencyKey: crypto.randomUUID()
      }
    })
  )
  const beforeRemoveVehicle = await read()
  const lifecycle: CampaignVehicleLifecycleInput = {
    campaignId,
    vehicleId: cartVehicle.id,
    action: 'REMOVE_DESTROY_CARGO',
    expectedVersion: cartVehicle.version,
    expectedInventoryVersion: shared(beforeRemoveVehicle, cartVehicle.id).fence.version,
    idempotencyKey: crypto.randomUUID()
  }
  const removedVehicle = await owner.mutation(api.campaigns.vehicles.lifecycle, {
    input: lifecycle
  })
  const afterVehicleRemoval = await read()
  assert.equal(
    afterVehicleRemoval.vehicles.some((entry) => entry.id === cartVehicle.id),
    false
  )
  assert.equal(
    afterVehicleRemoval.cargo.some((entry) => entry.vehicle.id === cartVehicle.id),
    false
  )
  const lifecycleAudit = afterVehicleRemoval.audit.find(
    (entry) => entry.id === removedVehicle.eventId
  )
  assert.ok(lifecycleAudit)
  assert.equal(lifecycleAudit.kind, 'VEHICLE_LIFECYCLE')
  assert.deepEqual(lifecycleAudit.payload, {
    action: 'REMOVE_DESTROY_CARGO',
    vehicleId: cartVehicle.id,
    itemCount: 0,
    currencyGroupCount: 0,
    currencyCount: 0
  })
  const beforeLifecycleReplay = await read()
  assert.deepEqual(
    await owner.mutation(api.campaigns.vehicles.lifecycle, { input: lifecycle }),
    removedVehicle
  )
  assert.deepEqual(await read(), beforeLifecycleReplay, 'Vehicle lifecycle replay must not write.')

  const final = await read()
  const firstFinal = character(final, firstCharacterId)
  const secondFinal = character(final, otherCharacterId)
  assert.deepEqual(firstFinal.active.state, firstInitial.active.state)
  assert.deepEqual(firstFinal.active.intent, firstInitial.active.intent)
  assert.deepEqual(firstFinal.sheet, {
    ...firstInitial.sheet,
    meta: { ...firstInitial.sheet.meta, streamVersion: firstInitial.sheet.meta.streamVersion + 4 }
  })
  assert.deepEqual(
    firstFinal.draft,
    firstInitial.draft,
    'Draft IDs, payload, and private notes must remain exact.'
  )
  assert.deepEqual(secondFinal.active, secondInitial.active)
  assert.deepEqual(secondFinal.sheet, secondInitial.sheet)
  assert.deepEqual(secondFinal.draft, secondInitial.draft)
  assert.deepEqual(final.party.items.page, initial.party.items.page)
  assert.deepEqual(final.party.currencies.page, initial.party.currencies.page)
  assert.equal(final.party.fence.version, initial.party.fence.version + 4)
  assert.equal(firstFinal.sheet.meta.streamVersion, firstInitial.sheet.meta.streamVersion + 4)
  assert.equal(secondFinal.sheet.meta.streamVersion, secondInitial.sheet.meta.streamVersion)
  assert.equal(
    final.vehicles.some((entry) => entry.id === cartVehicle.id),
    false
  )
  for (const original of initial.vehicles) {
    assert.deepEqual(
      final.vehicles.find((entry) => entry.id === original.id),
      original
    )
    assert.deepEqual(
      final.cargo.find((entry) => entry.vehicle.id === original.id),
      initial.cargo.find((entry) => entry.vehicle.id === original.id)
    )
  }
  for (const original of initial.audit)
    assert.deepEqual(
      final.audit.find((entry) => entry.id === original.id),
      original
    )
  return {
    initial,
    final,
    journeys: {
      character: {
        itemId: characterItemId,
        operations: [characterAdd, characterUpdate, characterConsume, characterRemove]
      },
      party,
      vehicle
    },
    temporaryVehicleId: cartVehicle.id,
    sourceIds: { clubId: club.id, cartId: cart.id },
    initialFences: { character: firstInitial.fence, party: initial.party.fence },
    finalFences: { character: firstFinal.fence, party: final.party.fence }
  }
}
