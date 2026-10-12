import assert from 'node:assert/strict'
import type {
  TransferCampaignInventoryInput,
  CampaignInventoryTransferResultDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import { developmentCli as cli } from './developmentCli'
import { verifyCampaignInventory } from './developmentCampaignInventory'
import { verifyCampaignVehicleLifecycle } from './developmentCampaignVehicleLifecycle'
import { verifyCampaignSharedEquipmentRetention } from './developmentCampaignSharedEquipmentRetention'

type FixturePlayer = {
  client: DevelopmentClient & { setAuth: (token: string) => void }
  fetchToken: () => Promise<string>
}

export type CampaignCustodyCohort = {
  owner: DevelopmentClient
  players: [FixturePlayer, FixturePlayer]
  ownerUserId: string
  playerUserIds: [string, string]
  characterIds: [string, string]
  campaignId: string
}

export async function admitCampaignCustodyPlayers(input: {
  ownerUserId: string
  playerUserIds: [string, string]
  campaignId: string
}) {
  await cli(
    'campaigns/developmentCustody:admitFixturePlayers',
    {
      ownerUserId: input.ownerUserId,
      playerUserIds: input.playerUserIds,
      campaignId: input.campaignId
    },
    false
  )
}

export async function assignCampaignCustodyCharacters(cohort: CampaignCustodyCohort) {
  for (const [index, player] of cohort.players.entries())
    await player.client.mutation(api.campaigns.assignments.assign, {
      campaignId: cohort.campaignId,
      characterId: cohort.characterIds[index]!
    })
}

export async function removeCampaignCustodyFixture(cohort: CampaignCustodyCohort) {
  await admitCampaignCustodyPlayers(cohort)
  const detail = await cohort.owner.query(api.campaigns.queries.get, { id: cohort.campaignId })
  assert.ok(detail, 'Custody fixture Campaign is missing.')
  for (const [index, player] of cohort.players.entries()) {
    const expectedCharacterId = cohort.characterIds[index]!
    const member = detail.memberships.find((entry) => entry.userId === cohort.playerUserIds[index])
    const assignedCharacterId = member?.assignedCharacter?.id
    if (assignedCharacterId && assignedCharacterId !== expectedCharacterId)
      throw new Error('Custody fixture has a conflicting Character assignment.')
    if (!assignedCharacterId) {
      player.client.setAuth(await player.fetchToken())
      await player.client.mutation(api.campaigns.assignments.assign, {
        campaignId: cohort.campaignId,
        characterId: expectedCharacterId
      })
    }
  }
  await cli(
    'campaigns/developmentCustody:removeFixtureState',
    {
      ownerUserId: cohort.ownerUserId,
      playerUserIds: cohort.playerUserIds,
      characterIds: cohort.characterIds,
      campaignId: cohort.campaignId
    },
    false
  )
}

async function verifyCharacterCustody(cohort: CampaignCustodyCohort) {
  if (fighter.category !== 'BASE') throw new Error('Custody requires the canonical base Fighter.')
  const [first, second] = cohort.players
  const [sourceId, destinationId] = cohort.characterIds
  const initialSheet = await first.client.query(api.characters.sheet.get, { id: sourceId })
  assert.ok(initialSheet)
  let version = initialSheet.meta.streamVersion
  const execute = async (command: CharacterSheetCommandInputDto) => {
    const result = await first.client.mutation(api.characters.sheetCommands.execute, {
      id: sourceId,
      command
    })
    assert.equal(result.streamVersion, version + 1)
    version = result.streamVersion
  }
  const beforeAdd = await first.client.query(api.characters.builder.activeCharacter, {
    id: sourceId
  })
  assert.ok(beforeAdd)
  await execute({
    type: 'ADD_INVENTORY_ITEM',
    commandId: crypto.randomUUID(),
    expectedVersion: version,
    equipmentId: backpack.id,
    quantity: 2,
    customName: 'Custody physical backpack',
    notes: 'Move this physical backpack with its contents.'
  })
  const added = await first.client.query(api.characters.builder.activeCharacter, { id: sourceId })
  assert.ok(added)
  const bag = added.state.equipment.inventory.find(
    (item) => !beforeAdd.state.equipment.inventory.some((old) => old.id === item.id)
  )
  assert.ok(bag)
  assert.equal(bag.equipmentId, backpack.id)
  assert.equal(bag.quantity, 2)
  await execute({
    type: 'ADD_INVENTORY_ITEM',
    commandId: crypto.randomUUID(),
    expectedVersion: version,
    equipmentId: club.id,
    quantity: 1,
    containerId: bag.id,
    customName: 'Custody club',
    notes: 'This item belongs to the transferred bag.'
  })
  const filled = await first.client.query(api.characters.builder.activeCharacter, { id: sourceId })
  assert.ok(filled)
  const child = filled.state.equipment.inventory.find(
    (item) => item.containerId === bag.id && item.customName === 'Custody club'
  )
  assert.ok(child)
  await execute({
    type: 'EQUIP_ITEM',
    commandId: crypto.randomUUID(),
    expectedVersion: version,
    itemId: child.id
  })
  await execute({
    type: 'ADJUST_CURRENCY',
    commandId: crypto.randomUUID(),
    expectedVersion: version,
    kind: 'RULESET',
    currencyId: fighter.startingGold.currencyId,
    amount: 10,
    containerId: bag.id
  })
  const vehicles = await cohort.owner.query(api.campaigns.vehicles.list, {
    campaignId: cohort.campaignId,
    paginationOpts: { cursor: null, numItems: 48 }
  })
  assert.equal(vehicles.isDone, true)
  assert.equal(vehicles.page.length, 1)
  const vehicleId = vehicles.page[0]!.id
  const completeItems = async (vehicleOwnerId?: string) => {
    const load = (cursor: string | null) =>
      vehicleOwnerId === undefined
        ? cohort.owner.query(api.campaigns.partyInventory.items, {
            campaignId: cohort.campaignId,
            paginationOpts: { cursor, numItems: 8 }
          })
        : cohort.owner.query(api.campaigns.vehicleInventory.items, {
            campaignId: cohort.campaignId,
            vehicleId: vehicleOwnerId,
            paginationOpts: { cursor, numItems: 8 }
          })
    let result = await load(null)
    const version = result.version
    const owner = result.owner
    const rows = [...result.page]
    const cursors = new Set<string>()
    while (!result.isDone) {
      assert.equal(result.version, version)
      assert.deepEqual(result.owner, owner)
      assert.ok(result.continueCursor)
      assert.equal(cursors.has(result.continueCursor), false, 'Inventory cursor must advance.')
      cursors.add(result.continueCursor)
      result = await load(result.continueCursor)
      rows.push(...result.page)
    }
    assert.equal(result.version, version)
    assert.deepEqual(result.owner, owner)
    return { ...result, page: rows }
  }
  const read = async () => {
    const [partyItems, partyCurrencies, vehicleItems, vehicleCurrencies] = await Promise.all([
      completeItems(),
      cohort.owner.query(api.campaigns.partyInventory.currencies, {
        campaignId: cohort.campaignId,
        paginationOpts: { cursor: null, numItems: 48 }
      }),
      completeItems(vehicleId),
      cohort.owner.query(api.campaigns.vehicleInventory.currencies, {
        campaignId: cohort.campaignId,
        vehicleId,
        paginationOpts: { cursor: null, numItems: 48 }
      })
    ])
    for (const page of [partyItems, partyCurrencies, vehicleItems, vehicleCurrencies])
      assert.equal(page.isDone, true, 'Custody owners require complete inventory pages.')
    const [source, destination, sourceSheet, destinationSheet, audit] = await Promise.all([
      first.client.query(api.characters.builder.activeCharacter, { id: sourceId }),
      second.client.query(api.characters.builder.activeCharacter, { id: destinationId }),
      first.client.query(api.characters.sheet.get, { id: sourceId }),
      second.client.query(api.characters.sheet.get, { id: destinationId }),
      cohort.owner.query(api.campaigns.inventoryAudit.list, {
        campaignId: cohort.campaignId,
        limit: 32
      })
    ])
    assert.ok(source && destination && sourceSheet && destinationSheet)
    const events = [...audit.events]
    let cursor = audit.nextCursor
    const cursors = new Set<string>()
    while (cursor) {
      assert.equal(cursors.has(cursor), false, 'Inventory audit cursor must advance.')
      cursors.add(cursor)
      const next = await cohort.owner.query(api.campaigns.inventoryAudit.list, {
        campaignId: cohort.campaignId,
        limit: 32,
        cursor
      })
      events.push(...next.events)
      cursor = next.nextCursor
    }
    return {
      source,
      destination,
      sourceSheet,
      destinationSheet,
      events,
      partyItems,
      partyCurrencies,
      vehicleItems,
      vehicleCurrencies
    }
  }
  const owners = {
    campaignId: cohort.campaignId,
    source: { kind: 'CHARACTER' as const, characterId: sourceId },
    destination: { kind: 'CHARACTER' as const, characterId: destinationId }
  }
  const fences = await first.client.query(api.campaigns.inventoryOwners.transferVersions, {
    input: owners
  })
  const before = await read()
  assert.equal(fences.sourceVersion, before.sourceSheet.meta.streamVersion)
  assert.equal(fences.destinationVersion, before.destinationSheet.meta.streamVersion)
  await assert.rejects(
    () =>
      first.client.query(api.campaigns.inventoryOwners.version, {
        input: { campaignId: cohort.campaignId, owner: owners.destination }
      }),
    /not found|unavailable|assigned|own|access|authorized|permission/i
  )
  const input = {
    ...owners,
    kind: 'ITEM' as const,
    itemId: bag.id,
    amount: 1,
    expectedSourceVersion: fences.sourceVersion,
    expectedDestinationVersion: fences.destinationVersion,
    idempotencyKey: crypto.randomUUID()
  }
  const result = await first.client.mutation(api.campaigns.inventoryTransfers.transfer, { input })
  const after = await read()
  assert.equal(after.sourceSheet.meta.streamVersion, fences.sourceVersion + 1)
  assert.equal(after.destinationSheet.meta.streamVersion, fences.destinationVersion + 1)
  const sourceEquipment = after.source.state.equipment
  const destinationEquipment = after.destination.state.equipment
  assert.equal(
    sourceEquipment.inventory.some((item) => item.id === bag.id || item.id === child.id),
    false
  )
  const spare = sourceEquipment.inventory.find(
    (item) => item.equipmentId === backpack.id && item.customName === bag.customName
  )
  assert.ok(spare)
  assert.equal(spare.quantity, 1)
  assert.notEqual(spare.id, bag.id)
  assert.equal(spare.containerId, undefined)
  assert.equal(
    sourceEquipment.inventory.some((item) => item.containerId === spare.id),
    false
  )
  assert.equal(
    after.source.state.currency.some((group) => group.containerId === spare.id),
    false
  )
  const heldBag = before.source.state.equipment.inventory.find((item) => item.id === bag.id)
  assert.ok(heldBag)
  assert.deepEqual(
    destinationEquipment.inventory.find((item) => item.id === bag.id),
    {
      ...heldBag,
      quantity: 1
    }
  )
  assert.deepEqual(
    destinationEquipment.inventory.find((item) => item.id === child.id),
    before.source.state.equipment.inventory.find((item) => item.id === child.id)
  )
  const movedGroups = before.source.state.currency.filter((group) => group.containerId === bag.id)
  assert.equal(movedGroups.length, 1)
  assert.equal(
    movedGroups[0]!.currencies.reduce((total, row) => total + row.amount, 0),
    10
  )
  assert.deepEqual(
    after.source.state.currency,
    before.source.state.currency.filter((group) => group.containerId !== bag.id)
  )
  assert.deepEqual(after.destination.state.currency, [
    ...before.destination.state.currency,
    ...movedGroups
  ])
  assert.equal(
    sourceEquipment.equipped.some(({ itemId }) => itemId === child.id),
    false
  )
  assert.equal(sourceEquipment.attuned.includes(child.id), false)
  assert.equal(
    destinationEquipment.equipped.some(({ itemId }) => itemId === child.id),
    false
  )
  assert.equal(destinationEquipment.attuned.includes(child.id), false)
  assert.deepEqual(after.source.intent, before.source.intent)
  assert.deepEqual(after.destination.intent, before.destination.intent)
  const receipt = after.events.find((event) => event.id === result.eventId)
  assert.ok(receipt)
  assert.equal(receipt.actorUserId, cohort.playerUserIds[0])
  assert.equal(receipt.visibility, 'OWNER')
  assert.equal(receipt.kind, 'CUSTODY_TRANSFER')
  assert.deepEqual(
    await first.client.mutation(api.campaigns.inventoryTransfers.transfer, { input }),
    result
  )
  assert.deepEqual(
    await read(),
    after,
    'Exact replay must not change either Character or audit history.'
  )
  await assert.rejects(
    () =>
      first.client.mutation(api.campaigns.inventoryTransfers.transfer, {
        input: { ...input, amount: 2 }
      }),
    /different input/i
  )
  assert.deepEqual(await read(), after, 'Changed replay must not write.')
  await assert.rejects(
    () =>
      first.client.mutation(api.campaigns.inventoryTransfers.transfer, {
        input: { ...input, idempotencyKey: crypto.randomUUID() }
      }),
    /changed|stale|version|unavailable|not found/i
  )
  assert.deepEqual(await read(), after, 'Stale transfer must not write.')
  const characterOwner = (characterId: string) => ({ kind: 'CHARACTER' as const, characterId })
  const partyOwner = { kind: 'CAMPAIGN' as const, campaignId: cohort.campaignId }
  const vehicleOwner = { kind: 'VEHICLE' as const, vehicleId }
  const quantity = (snapshot: Awaited<ReturnType<typeof read>>) =>
    [
      ...snapshot.source.state.equipment.inventory,
      ...snapshot.destination.state.equipment.inventory,
      ...snapshot.partyItems.page,
      ...snapshot.vehicleItems.page
    ].reduce((total, item) => total + BigInt(item.quantity), 0n)
  const coins = (snapshot: Awaited<ReturnType<typeof read>>) =>
    [
      ...snapshot.source.state.currency.flatMap((group) => group.currencies),
      ...snapshot.destination.state.currency.flatMap((group) => group.currencies),
      ...snapshot.partyCurrencies.page,
      ...snapshot.vehicleCurrencies.page
    ].reduce((total, row) => total + BigInt(row.amount), 0n)
  for (const step of [
    { actor: second.client, source: characterOwner(destinationId), destination: partyOwner },
    { actor: cohort.owner, source: partyOwner, destination: characterOwner(sourceId) },
    { actor: first.client, source: characterOwner(sourceId), destination: vehicleOwner },
    { actor: cohort.owner, source: vehicleOwner, destination: characterOwner(destinationId) }
  ]) {
    const current = await step.actor.query(api.campaigns.inventoryOwners.transferVersions, {
      input: { campaignId: cohort.campaignId, source: step.source, destination: step.destination }
    })
    const prior = await read()
    const command: TransferCampaignInventoryInput = {
      kind: 'ITEM' as const,
      campaignId: cohort.campaignId,
      source: step.source,
      destination: step.destination,
      itemId: bag.id,
      amount: 1,
      expectedSourceVersion: current.sourceVersion,
      expectedDestinationVersion: current.destinationVersion,
      idempotencyKey: crypto.randomUUID()
    }
    const settled: CampaignInventoryTransferResultDto = await step.actor.mutation(
      api.campaigns.inventoryTransfers.transfer,
      {
        input: command
      }
    )
    const next = await read()
    assert.equal(quantity(next), quantity(prior))
    assert.equal(coins(next), coins(prior))
    const nextFences = await step.actor.query(api.campaigns.inventoryOwners.transferVersions, {
      input: { campaignId: cohort.campaignId, source: step.source, destination: step.destination }
    })
    assert.equal(nextFences.sourceVersion, current.sourceVersion + 1)
    assert.equal(nextFences.destinationVersion, current.destinationVersion + 1)
    assert.deepEqual(
      await step.actor.mutation(api.campaigns.inventoryTransfers.transfer, { input: command }),
      settled
    )
    assert.deepEqual(await read(), next, 'Every owner combination must replay without writes.')
  }
  const returned = await read()
  for (const itemId of [bag.id, child.id])
    assert.deepEqual(
      returned.destination.state.equipment.inventory.find((item) => item.id === itemId),
      after.destination.state.equipment.inventory.find((item) => item.id === itemId)
    )
  assert.deepEqual(
    returned.destination.state.currency.filter((group) => group.containerId === bag.id),
    movedGroups
  )
  assert.equal(
    returned.partyItems.page.some((item) => item.id === bag.id || item.id === child.id),
    false
  )
  assert.equal(
    returned.vehicleItems.page.some((item) => item.id === bag.id || item.id === child.id),
    false
  )
  console.log(
    'Character custody: public Sheet producers moved a filled physical backpack, exact child IDs and currency groups; retained the empty spare; advanced both fences once; removed only departed equip references; denied destination reads; and preserved exact replay and atomic refusals.'
  )
}

export async function verifyCampaignCustody(
  cohort: CampaignCustodyCohort,
  anonymous: DevelopmentClient
) {
  await verifyCampaignInventory({
    owner: cohort.owner,
    player: cohort.players[0].client,
    anonymous,
    campaignId: cohort.campaignId
  })
  await verifyCharacterCustody(cohort)
  await verifyCampaignVehicleLifecycle(cohort, anonymous)
  await verifyCampaignSharedEquipmentRetention(cohort)
  for (const [index, player] of cohort.players.entries()) {
    const sheet = await player.client.query(api.campaigns.characterSheet.get, {
      campaignId: cohort.campaignId,
      characterId: cohort.characterIds[index]!
    })
    assert.ok(sheet, 'Assigned Character sheet is unavailable.')
    await assert.rejects(
      () =>
        anonymous.query(api.campaigns.characterSheet.get, {
          campaignId: cohort.campaignId,
          characterId: cohort.characterIds[index]!
        }),
      /identity|authenticated|authorized|permission/i
    )
  }
}
