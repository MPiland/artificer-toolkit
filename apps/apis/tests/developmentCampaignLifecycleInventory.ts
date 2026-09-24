import assert from 'node:assert/strict'
import type { DevelopmentClient } from './developmentClient'
import type { FunctionReturnType } from 'convex/server'
import type {
  CampaignPartyInventoryMutationInput,
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import type { CampaignVehicleDto } from '@artificer-toolkit/schema/api/campaignVehicles'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'

type PartyCommand =
  | Omit<
      Extract<CampaignPartyInventoryMutationInput, { kind: 'ITEM_ADD' }>,
      'campaignId' | 'vehicleId' | 'expectedOwnerVersion' | 'idempotencyKey'
    >
  | Omit<
      Extract<CampaignPartyInventoryMutationInput, { kind: 'CURRENCY_ADJUST' }>,
      'campaignId' | 'vehicleId' | 'expectedOwnerVersion' | 'idempotencyKey'
    >

type CampaignDenominationIds = { populated: string; unused: string; systemId: string }
type VehicleCreateResult = FunctionReturnType<typeof api.campaigns.vehicles.create>

export type CampaignLifecycleInventory = {
  currencySystem: CurrencySystemDto
  vehicles: [VehicleCreateResult, VehicleCreateResult]
  unavailableVehicle: CampaignVehicleDto
  denominationIds: { populated: string; unused: string }
}

const highAmount = 4_294_967_297

async function readItems(owner: DevelopmentClient, campaignId: string, vehicleId?: string) {
  const page =
    vehicleId === undefined
      ? await owner.query(api.campaigns.partyInventory.items, {
          campaignId,
          paginationOpts: { cursor: null, numItems: 48 }
        })
      : await owner.query(api.campaigns.vehicleInventory.items, {
          campaignId,
          vehicleId,
          paginationOpts: { cursor: null, numItems: 48 }
        })
  assert.equal(page.isDone, true, 'Fixture inventory must fit in one complete public page.')
  assert.deepEqual(
    page.owner,
    vehicleId === undefined ? { kind: 'CAMPAIGN', campaignId } : { kind: 'VEHICLE', vehicleId }
  )
  const fence = await owner.query(api.campaigns.inventoryOwners.version, {
    input:
      vehicleId === undefined
        ? { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
        : { campaignId, owner: { kind: 'VEHICLE', vehicleId } }
  })
  assert.equal(page.version, fence.version, 'Public inventory page and owner fence must agree.')
  return page
}

async function readCurrencies(
  owner: DevelopmentClient,
  campaignId: string,
  denominationIds: CampaignDenominationIds,
  bagId: string,
  vehicleId?: string
) {
  const page =
    vehicleId === undefined
      ? await owner.query(api.campaigns.partyInventory.currencies, {
          campaignId,
          paginationOpts: { cursor: null, numItems: 48 }
        })
      : await owner.query(api.campaigns.vehicleInventory.currencies, {
          campaignId,
          vehicleId,
          paginationOpts: { cursor: null, numItems: 48 }
        })
  assert.equal(page.isDone, true, 'Fixture currencies must fit in one complete public page.')
  assert.deepEqual(
    page.owner,
    vehicleId === undefined ? { kind: 'CAMPAIGN', campaignId } : { kind: 'VEHICLE', vehicleId }
  )
  const fence = await owner.query(api.campaigns.inventoryOwners.version, {
    input:
      vehicleId === undefined
        ? { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
        : { campaignId, owner: { kind: 'VEHICLE', vehicleId } }
  })
  assert.equal(page.version, fence.version, 'Public currency page and owner fence must agree.')
  assert.equal(
    page.page.length,
    4,
    'Each fixture owner must contain exactly four currency balances.'
  )
  const actual = page.page
    .map((row) => ({
      kind: row.kind,
      campaignCurrencySystemId: row.campaignCurrencySystemId,
      denominationId: row.denominationId,
      amount: row.amount,
      containerId: row.containerId
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const expected = [
    {
      kind: 'RULESET',
      campaignCurrencySystemId: undefined,
      denominationId: srdSystemRecord.currencies[0]!.id,
      amount: highAmount,
      containerId: null
    },
    {
      kind: 'RULESET',
      campaignCurrencySystemId: undefined,
      denominationId: srdSystemRecord.currencies[0]!.id,
      amount: highAmount,
      containerId: bagId
    },
    {
      kind: 'CAMPAIGN',
      campaignCurrencySystemId: denominationIds.systemId,
      denominationId: denominationIds.populated,
      amount: highAmount,
      containerId: null
    },
    {
      kind: 'CAMPAIGN',
      campaignCurrencySystemId: denominationIds.systemId,
      denominationId: denominationIds.populated,
      amount: highAmount,
      containerId: bagId
    }
  ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  assert.deepEqual(actual, expected)
  return page
}
async function ownerVersion(owner: DevelopmentClient, campaignId: string, vehicleId?: string) {
  const result = await owner.query(api.campaigns.inventoryOwners.version, {
    input:
      vehicleId === undefined
        ? { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
        : { campaignId, owner: { kind: 'VEHICLE', vehicleId } }
  })
  return result.version
}

async function mutateParty(
  owner: DevelopmentClient,
  campaignId: string,
  command: PartyCommand,
  vehicleId?: string
) {
  const expectedOwnerVersion = await ownerVersion(owner, campaignId, vehicleId)
  return owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
    input: {
      ...command,
      campaignId,
      ...(vehicleId === undefined ? {} : { vehicleId }),
      expectedOwnerVersion,
      idempotencyKey: crypto.randomUUID()
    }
  })
}

async function addContainedClub(owner: DevelopmentClient, campaignId: string, vehicleId?: string) {
  const before = await readItems(owner, campaignId, vehicleId)
  const receipt = await mutateParty(
    owner,
    campaignId,
    { kind: 'ITEM_ADD', equipmentId: backpack.id, quantity: 1 },
    vehicleId
  )
  const after = await readItems(owner, campaignId, vehicleId)
  const priorIds = new Set(before.page.map((item) => item.id))
  const bags = after.page.filter(
    (item) => !priorIds.has(item.id) && item.label === backpack.label && item.isContainer
  )
  assert.equal(bags.length, 1, 'ITEM_ADD must create exactly one new backpack.')
  assert.ok(after.page.some((item) => item.id === bags[0]!.id))
  assert.ok(receipt.eventId)
  const bagId = bags[0]!.id
  await mutateParty(
    owner,
    campaignId,
    { kind: 'ITEM_ADD', equipmentId: club.id, quantity: 1, containerId: bagId },
    vehicleId
  )
  const complete = await readItems(owner, campaignId, vehicleId)
  const clubRows = complete.page.filter(
    (item) => item.label === club.label && item.containerId === bagId
  )
  assert.equal(
    clubRows.length,
    1,
    'Contained Club placement must be visible in the complete public page.'
  )
  return bagId
}

async function populateOwner(
  owner: DevelopmentClient,
  campaignId: string,
  denominationIds: CampaignDenominationIds,
  vehicleId?: string
) {
  const bagId = await addContainedClub(owner, campaignId, vehicleId)
  const commands: PartyCommand[] = [
    {
      kind: 'CURRENCY_ADJUST',
      denominationId: srdSystemRecord.currencies[0]!.id,
      amount: highAmount
    },
    {
      kind: 'CURRENCY_ADJUST',
      denominationId: srdSystemRecord.currencies[0]!.id,
      amount: highAmount,
      containerId: bagId
    },
    {
      kind: 'CURRENCY_ADJUST',
      denominationId: denominationIds.populated,
      campaignCurrencySystemId: denominationIds.systemId,
      amount: highAmount
    },
    {
      kind: 'CURRENCY_ADJUST',
      denominationId: denominationIds.populated,
      campaignCurrencySystemId: denominationIds.systemId,
      amount: highAmount,
      containerId: bagId
    }
  ]
  // CURRENCY_ADJUST creates balances; stable coin groups are outside this producer's claimed coverage.
  for (const command of commands) await mutateParty(owner, campaignId, command, vehicleId)
  const complete = await readItems(owner, campaignId, vehicleId)
  assert.ok(complete.page.some((item) => item.id === bagId && item.isContainer))
  await readCurrencies(owner, campaignId, denominationIds, bagId, vehicleId)
}

export async function populateCampaignLifecycleInventory(
  owner: DevelopmentClient,
  campaignId: string
): Promise<CampaignLifecycleInventory> {
  const populatedId = crypto.randomUUID()
  const unusedId = crypto.randomUUID()
  const currencySystemInput: SaveCampaignCurrencySystemInput = {
    campaignId,
    label: 'P09 custody currency',
    isReference: false,
    denominations: [
      { id: populatedId, label: 'P09 populated', abbreviation: 'p9', scaleInReference: 1 },
      { id: unusedId, label: 'P09 unused', abbreviation: 'u9', scaleInReference: 2 }
    ]
  }
  const currencySystem = await owner.mutation(
    api.campaigns.currencySystems.save,
    currencySystemInput
  )
  const systemIds = { populated: populatedId, unused: unusedId, systemId: currencySystem.id }
  const vehicleA = await owner.mutation(api.campaigns.vehicles.create, {
    campaignId,
    vehicleDefinitionId: cart.id,
    label: 'P09 available cart'
  })
  const vehicleB = await owner.mutation(api.campaigns.vehicles.create, {
    campaignId,
    vehicleDefinitionId: cart.id,
    label: 'P09 unavailable cart'
  })
  await populateOwner(owner, campaignId, systemIds)
  await populateOwner(owner, campaignId, systemIds, vehicleA.id)
  await populateOwner(owner, campaignId, systemIds, vehicleB.id)
  const unavailable = await owner.mutation(api.campaigns.vehicles.lifecycle, {
    input: {
      action: 'MAKE_UNAVAILABLE',
      campaignId,
      vehicleId: vehicleB.id,
      expectedVersion: vehicleB.version,
      idempotencyKey: crypto.randomUUID()
    }
  })
  assert.ok(unavailable.eventId)
  const vehiclePage = await owner.query(api.campaigns.vehicles.list, {
    campaignId,
    paginationOpts: { cursor: null, numItems: 48 }
  })
  assert.equal(vehiclePage.isDone, true, 'Fixture Vehicles must fit in one complete public page.')
  assert.equal(vehiclePage.page.length, 2)
  assert.deepEqual(
    new Set(vehiclePage.page.map((vehicle) => vehicle.id)),
    new Set([vehicleA.id, vehicleB.id])
  )
  const currentUnavailable = vehiclePage.page.find((vehicle) => vehicle.id === vehicleB.id)
  const currentAvailable = vehiclePage.page.find((vehicle) => vehicle.id === vehicleA.id)
  assert.ok(currentUnavailable)
  assert.ok(currentAvailable)
  assert.equal(currentUnavailable.availability, 'UNAVAILABLE')
  assert.equal(currentAvailable.availability, 'AVAILABLE')
  assert.equal(currentUnavailable.version, vehicleB.version + 1)
  assert.equal(currentAvailable.version, vehicleA.version)
  return {
    currencySystem,
    vehicles: [vehicleA, vehicleB],
    unavailableVehicle: currentUnavailable,
    denominationIds: { populated: populatedId, unused: unusedId }
  }
}
