import assert from 'node:assert/strict'
import { ConvexHttpClient } from 'convex/browser'
import type { CampaignPartyInventoryMutationInput } from '@artificer-toolkit/schema/api/campaignInventory'
import type {
  CampaignContentRemovalReceiptDto,
  UnshareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { api } from '../convex/_generated/api.js'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'

export async function verifyCampaignSharedEquipmentRetention(
  cohort: CampaignCustodyCohort
): Promise<void> {
  const { owner, campaignId } = cohort
  const player = cohort.players[0].client
  const characterId = cohort.characterIds[0]
  if (fighter.category !== 'BASE') throw new Error('Retention requires the base Fighter.')
  const currencyId = fighter.startingGold.currencyId
  const draft = await owner.mutation(api.content.drafts.duplicate, {
    subjectKind: 'EQUIPMENT',
    subjectId: backpack.id
  })
  assert.ok(draft.updatedAt)
  const publication = await owner.mutation(api.content.publication.publishDraft, {
    subjectKind: 'EQUIPMENT',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  await owner.mutation(api.campaigns.contentShares.share, {
    campaignId,
    subjectKind: 'EQUIPMENT',
    subjectId: publication.subjectId
  })
  const vehicle = await owner.mutation(api.campaigns.vehicles.create, {
    campaignId,
    vehicleDefinitionId: cart.id,
    label: 'Retained cargo fixture'
  })
  const paginationOpts = { cursor: null, numItems: 48 }
  const completeItems = async (vehicleOwnerId?: string) => {
    const load = (cursor: string | null) =>
      vehicleOwnerId === undefined
        ? owner.query(api.campaigns.partyInventory.items, {
            campaignId,
            paginationOpts: { cursor, numItems: 8 }
          })
        : owner.query(api.campaigns.vehicleInventory.items, {
            campaignId,
            vehicleId: vehicleOwnerId,
            paginationOpts: { cursor, numItems: 8 }
          })
    let result = await load(null)
    const version = result.version
    const ownerRef = result.owner
    const rows = [...result.page]
    const cursors = new Set<string>()
    while (!result.isDone) {
      assert.equal(result.version, version)
      assert.deepEqual(result.owner, ownerRef)
      assert.ok(result.continueCursor)
      assert.equal(cursors.has(result.continueCursor), false, 'Inventory cursor must advance.')
      cursors.add(result.continueCursor)
      result = await load(result.continueCursor)
      rows.push(...result.page)
    }
    assert.equal(result.version, version)
    assert.deepEqual(result.owner, ownerRef)
    return { ...result, page: rows }
  }
  const read = async () => {
    const [
      partyItems,
      partyCurrencies,
      vehicleItems,
      vehicleCurrencies,
      character,
      sheet,
      campaign
    ] = await Promise.all([
      completeItems(),
      owner.query(api.campaigns.partyInventory.currencies, { campaignId, paginationOpts }),
      completeItems(vehicle.id),
      owner.query(api.campaigns.vehicleInventory.currencies, {
        campaignId,
        vehicleId: vehicle.id,
        paginationOpts
      }),
      player.query(api.characters.builder.activeCharacter, { id: characterId }),
      player.query(api.characters.sheet.get, { id: characterId }),
      owner.query(api.campaigns.queries.get, { id: campaignId })
    ])
    assert.ok(character && sheet && campaign)
    for (const page of [partyItems, partyCurrencies, vehicleItems, vehicleCurrencies])
      assert.equal(page.isDone, true)
    return {
      partyItems,
      partyCurrencies,
      vehicleItems,
      vehicleCurrencies,
      character,
      sheet,
      campaign
    }
  }
  const addBag = async (vehicleId?: string) => {
    const ownerRef = vehicleId
      ? { kind: 'VEHICLE' as const, vehicleId }
      : { kind: 'CAMPAIGN' as const, campaignId }
    const version = (
      await owner.query(api.campaigns.inventoryOwners.version, {
        input: { campaignId, owner: ownerRef }
      })
    ).version
    const previous = await read()
    const previousItemIds = new Set(
      (vehicleId ? previous.vehicleItems : previous.partyItems).page.map((row) => row.id)
    )
    await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'ITEM_ADD',
        campaignId,
        ...(vehicleId ? { vehicleId } : {}),
        equipmentId: publication.subjectId,
        quantity: 1,
        expectedOwnerVersion: version,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const current = await read()
    const added = (vehicleId ? current.vehicleItems : current.partyItems).page.filter(
      (row) => !previousItemIds.has(row.id)
    )
    assert.equal(added.length, 1)
    const bag = added[0]
    assert.ok(bag?.isContainer)
    for (const fields of [
      { kind: 'ITEM_ADD' as const, equipmentId: club.id, quantity: 1, containerId: bag.id },
      {
        kind: 'CURRENCY_ADJUST' as const,
        denominationId: currencyId,
        campaignCurrencySystemId: null,
        amount: 3,
        containerId: bag.id
      }
    ]) {
      const fence = await owner.query(api.campaigns.inventoryOwners.version, {
        input: { campaignId, owner: ownerRef }
      })
      const input: CampaignPartyInventoryMutationInput = {
        ...fields,
        campaignId,
        ...(vehicleId ? { vehicleId } : {}),
        expectedOwnerVersion: fence.version,
        idempotencyKey: crypto.randomUUID()
      }
      await owner.mutation(api.campaigns.partyInventoryCommands.mutate, { input })
    }
    return bag
  }
  const partyBag = await addBag()
  const vehicleBag = await addBag(vehicle.id)
  const initial = await player.query(api.characters.sheet.get, { id: characterId })
  assert.ok(initial)
  await player.mutation(api.characters.sheetCommands.execute, {
    id: characterId,
    command: {
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: publication.subjectId,
      quantity: 1,
      customName: 'Retained shared pack',
      commandId: crypto.randomUUID(),
      expectedVersion: initial.meta.streamVersion
    }
  })
  const before = await read()
  const input: UnshareCampaignContentInput = {
    campaignId,
    subjectKind: 'EQUIPMENT',
    subjectId: publication.subjectId,
    sharedBy: cohort.ownerUserId,
    expectedCampaignVersion: before.campaign.version,
    commandId: crypto.randomUUID()
  }
  const receipt: CampaignContentRemovalReceiptDto = await owner.mutation(
    api.campaigns.contentShares.unshare,
    input
  )
  const after = await read()
  assert.deepEqual(after.partyItems, before.partyItems)
  assert.deepEqual(after.partyCurrencies, before.partyCurrencies)
  assert.deepEqual(after.vehicleItems, before.vehicleItems)
  assert.deepEqual(after.vehicleCurrencies, before.vehicleCurrencies)
  assert.equal(after.campaign.version, before.campaign.version + 1)
  assert.deepEqual(receipt.affectedCharacters, [])
  assert.equal(after.character.status, 'ACTIVE')
  assert.deepEqual(
    after.character,
    before.character,
    'Already acquired rules must not rewrite the Character on source loss.'
  )
  const held = after.character.state.equipment.inventory.find(
    (item) => item.equipmentId === publication.subjectId
  )
  assert.ok(held?.retainedRulesJson)
  const raw = acquiredEquipmentRulesSchema.parse(JSON.parse(held.retainedRulesJson))
  assert.equal(raw.equipmentId, publication.subjectId)
  assert.equal(raw.systemId, fighter.systemId)
  assert.ok(after.sheet.inventory.containers?.some((row) => row.id === held.id))
  assert.equal(
    after.sheet.reference.equipmentOptions.some((row) => row.id === publication.subjectId),
    true
  )
  assert.deepEqual(await owner.mutation(api.campaigns.contentShares.unshare, input), receipt)
  assert.deepEqual(await read(), after)
  await assert.rejects(
    () =>
      player.mutation(api.characters.sheetCommands.execute, {
        id: characterId,
        command: {
          type: 'ADD_INVENTORY_ITEM',
          equipmentId: publication.subjectId,
          quantity: 1,
          commandId: crypto.randomUUID(),
          expectedVersion: after.sheet.meta.streamVersion
        }
      }),
    /unavailable|not available|source access/i
  )
  for (const vehicleId of [undefined, vehicle.id]) {
    const ownerRef = vehicleId
      ? { kind: 'VEHICLE' as const, vehicleId }
      : { kind: 'CAMPAIGN' as const, campaignId }
    const fence = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: ownerRef }
    })
    await assert.rejects(
      () =>
        owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
          input: {
            kind: 'ITEM_ADD',
            campaignId,
            ...(vehicleId ? { vehicleId } : {}),
            equipmentId: publication.subjectId,
            quantity: 1,
            expectedOwnerVersion: fence.version,
            idempotencyKey: crypto.randomUUID()
          }
        }),
      /unavailable|not available|source/i
    )
  }
  assert.deepEqual(await read(), after)
  // Existing held containers continue accepting authorized contents after their definition is unshared.
  for (const [bag, vehicleId] of [
    [partyBag, undefined],
    [vehicleBag, vehicle.id]
  ] as const) {
    const ownerRef = vehicleId
      ? { kind: 'VEHICLE' as const, vehicleId }
      : { kind: 'CAMPAIGN' as const, campaignId }
    const fence = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: ownerRef }
    })
    const commands: CampaignPartyInventoryMutationInput[] = [0, 1].map(() => ({
      kind: 'CURRENCY_ADJUST',
      campaignId,
      ...(vehicleId ? { vehicleId } : {}),
      denominationId: currencyId,
      campaignCurrencySystemId: null,
      amount: 1,
      containerId: bag.id,
      expectedOwnerVersion: fence.version,
      idempotencyKey: crypto.randomUUID()
    }))
    const results = await Promise.allSettled(
      commands.map((input) =>
        owner instanceof ConvexHttpClient
          ? owner.mutation(
              api.campaigns.partyInventoryCommands.mutate,
              { input },
              { skipQueue: true }
            )
          : owner.mutation(api.campaigns.partyInventoryCommands.mutate, { input })
      )
    )
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    const rejected = results.find((result) => result.status === 'rejected')
    assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof Error)
    assert.match(rejected.reason.message, /changed|version|stale/i)
    assert.equal(
      (
        await owner.query(api.campaigns.inventoryOwners.version, {
          input: { campaignId, owner: ownerRef }
        })
      ).version,
      fence.version + 1
    )
    const balances = vehicleId ? (await read()).vehicleCurrencies : (await read()).partyCurrencies
    assert.equal(
      balances.page
        .filter((row) => row.containerId === bag.id)
        .reduce((sum, row) => sum + row.amount, 0),
      4
    )
  }
  const current = await read()
  const cargoVersion = await owner.query(api.campaigns.inventoryOwners.version, {
    input: { campaignId, owner: { kind: 'VEHICLE', vehicleId: vehicle.id } }
  })
  const partyVersion = await owner.query(api.campaigns.inventoryOwners.version, {
    input: { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
  })
  await owner.mutation(api.campaigns.vehicles.lifecycle, {
    input: {
      campaignId,
      vehicleId: vehicle.id,
      action: 'REMOVE_RETURN_CARGO',
      expectedVersion: vehicle.version,
      expectedInventoryVersion: cargoVersion.version,
      expectedPartyInventoryVersion: partyVersion.version,
      idempotencyKey: crypto.randomUUID()
    }
  })
  const returned = await owner.query(api.campaigns.partyInventory.items, {
    campaignId,
    paginationOpts
  })
  const returnedItems = [...returned.page]
  const cursors = new Set<string>()
  let page = returned
  while (!page.isDone) {
    assert.equal(cursors.has(page.continueCursor), false, 'Inventory cursor must advance.')
    cursors.add(page.continueCursor)
    page = await owner.query(api.campaigns.partyInventory.items, {
      campaignId,
      paginationOpts: { ...paginationOpts, cursor: page.continueCursor }
    })
    assert.equal(page.version, returned.version)
    assert.deepEqual(page.owner, returned.owner)
    returnedItems.push(...page.page)
  }
  assert.equal(new Set(returnedItems.map((row) => row.id)).size, returnedItems.length)
  for (const item of current.vehicleItems.page)
    assert.deepEqual(
      returnedItems.find((row) => row.id === item.id),
      item
    )
  const vehicles = await owner.query(api.campaigns.vehicles.list, { campaignId, paginationOpts })
  assert.equal(vehicles.isDone, true)
  assert.equal(vehicles.page.length, 0)
  console.log(
    'Shared Equipment loss: acquired Character, party and Vehicle containers retained usable rules, original IDs, contents and qualified coins after unshare; new copies were denied; concurrent writes advanced each owner once; Vehicle cargo returned intact.'
  )
}
