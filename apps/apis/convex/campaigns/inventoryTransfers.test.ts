import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignInventoryTransferResultDto,
  CampaignPartyInventoryMutationInput,
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import type {
  CampaignVehicleDto,
  CreateCampaignVehicleInput,
  CampaignVehicleLifecycleInput,
  CampaignVehicleLifecycleResult
} from '@artificer-toolkit/schema/api/campaignVehicles'
import {
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { pouch } from '@artificer-toolkit/source-data/srd/equipment/pouch.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { internal } from '../_generated/api'
import { importedSubject } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createVehicle = makeFunctionReference<
  'mutation',
  CreateCampaignVehicleInput,
  CampaignVehicleDto
>('campaigns/vehicles:create')
const lifecycle = makeFunctionReference<
  'mutation',
  { input: CampaignVehicleLifecycleInput },
  CampaignVehicleLifecycleResult
>('campaigns/vehicles:lifecycle')
const archiveCampaign = makeFunctionReference<
  'mutation',
  { campaignId: string; expectedVersion: number },
  CampaignDetailDto
>('campaigns/archive:archive')
const mutateParty = makeFunctionReference<
  'mutation',
  { input: CampaignPartyInventoryMutationInput },
  { eventId: string }
>('campaigns/partyInventoryCommands:mutate')
const saveSystem = makeFunctionReference<
  'mutation',
  SaveCampaignCurrencySystemInput,
  CurrencySystemDto
>('campaigns/currencySystems:save')
const transfer = makeFunctionReference<
  'mutation',
  { input: TransferCampaignInventoryInput },
  CampaignInventoryTransferResultDto
>('campaigns/inventoryTransfers:transfer')

const campaignInput: CreateCampaignInput = {
  name: 'Native inventory transfer',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}
const idFor = (index: number) => `50000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const party = (campaignId: string) => ({ kind: 'CAMPAIGN' as const, campaignId })
const vehicle = (vehicleId: string) => ({ kind: 'VEHICLE' as const, vehicleId })

async function setup() {
  const base = await readySheetFixture()
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
  })
  const campaign = await base.other.caller.mutation(createCampaign, campaignInput)
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const firstVehicle = await base.other.caller.mutation(createVehicle, {
    campaignId: campaign.id,
    vehicleDefinitionId: cart.id
  })
  const secondVehicle = await base.other.caller.mutation(createVehicle, {
    campaignId: campaign.id,
    vehicleDefinitionId: cart.id
  })
  const readStored = () =>
    base.t.run(async (ctx) => ({
      inventories: await ctx.db.query('campaignPartyInventories').collect(),
      items: await ctx.db.query('campaignPartyItems').collect(),
      currencies: await ctx.db.query('campaignPartyCurrencies').collect(),
      groups: await ctx.db.query('campaignPartyCurrencyGroups').collect(),
      events: await ctx.db.query('campaignEvents').collect()
    }))
  return { ...base, campaign, firstVehicle, secondVehicle, readStored }
}

function itemAdd(campaignId: string, expectedOwnerVersion: number, quantity: number) {
  return {
    campaignId,
    expectedOwnerVersion,
    idempotencyKey: crypto.randomUUID(),
    kind: 'ITEM_ADD' as const,
    equipmentId: club.id,
    quantity
  }
}

async function ownerVersion(base: Awaited<ReturnType<typeof setup>>, vehicleId?: string) {
  return base.t.run(async (ctx) => {
    const owner = await ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId_vehicleId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('vehicleId', vehicleId)
      )
      .unique()
    return owner?.version ?? 0
  })
}

describe('native Campaign party and Vehicle custody transfers', () => {
  it('blocks new player transfers into unavailable cargo, allows the owner, and replays after Vehicle removal', async () => {
    const base = await setup()
    await base.other.caller.mutation(mutateParty, {
      input: itemAdd(base.campaign.id, 0, 1)
    })
    const item = (await base.readStored()).items[0]!
    await base.other.caller.mutation(lifecycle, {
      input: {
        action: 'MAKE_UNAVAILABLE',
        campaignId: base.campaign.id,
        vehicleId: base.firstVehicle.id,
        expectedVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const input: TransferCampaignInventoryInput = {
      kind: 'ITEM',
      campaignId: base.campaign.id,
      source: party(base.campaign.id),
      destination: vehicle(base.firstVehicle.id),
      itemId: item.id,
      amount: 1,
      expectedSourceVersion: 1,
      expectedDestinationVersion: 0,
      idempotencyKey: crypto.randomUUID()
    }
    const before = await base.readStored()
    await expect(base.owner.caller.mutation(transfer, { input })).rejects.toThrow(
      'owner is unavailable'
    )
    expect(await base.readStored()).toEqual(before)
    const result = await base.other.caller.mutation(transfer, { input })
    await base.other.caller.mutation(lifecycle, {
      input: {
        action: 'REMOVE_RETURN_CARGO',
        campaignId: base.campaign.id,
        vehicleId: base.firstVehicle.id,
        expectedVersion: 1,
        expectedInventoryVersion: 1,
        expectedPartyInventoryVersion: 2,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const after = await base.readStored()
    expect(after.items).toContainEqual(expect.objectContaining({ id: item.id, quantity: 1 }))
    expect(after.items.find((row) => row.id === item.id)?.vehicleId).toBeUndefined()
    expect(await base.other.caller.mutation(transfer, { input })).toEqual(result)
    expect(await base.readStored()).toEqual(after)
    await expect(
      base.other.caller.mutation(transfer, {
        input: { ...input, idempotencyKey: crypto.randomUUID() }
      })
    ).rejects.toThrow('owner is unavailable')
    expect(await base.readStored()).toEqual(after)
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing owner membership.')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    await expect(base.other.caller.mutation(transfer, { input })).rejects.toThrow()
    expect(await base.readStored()).toEqual(after)
  })

  it('moves a nested bag with its complete item and currency contents while preserving exact custody and rollback', async () => {
    const base = await setup()
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [backpack, pouch].map((equipment) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment })
      )
    })
    await base.other.caller.mutation(mutateParty, {
      input: { ...itemAdd(base.campaign.id, 0, 1), equipmentId: backpack.id }
    })
    const bag = (await base.readStored()).items[0]!
    const parentId = idFor(800)
    const pouchId = idFor(801)
    const contentsId = idFor(802)
    const emptyGroupId = idFor(803)
    const coinGroupId = idFor(804)
    const denominationId = srdSystemRecord.currencies[0]!.id
    await base.t.run(async (ctx) => {
      for (const item of [
        { id: parentId, equipmentId: backpack.id, containerId: null, quantity: 1 },
        { id: pouchId, equipmentId: pouch.id, containerId: bag.id, quantity: 1 },
        { id: contentsId, equipmentId: club.id, containerId: pouchId, quantity: 3 }
      ])
        await ctx.db.insert('campaignPartyItems', { ...item, campaignId: base.campaign.id })
      await ctx.db.patch(bag._id, { containerId: parentId })
      await ctx.db.insert('campaignPartyCurrencyGroups', {
        campaignId: base.campaign.id,
        id: emptyGroupId,
        containerId: bag.id
      })
      await ctx.db.insert('campaignPartyCurrencyGroups', {
        campaignId: base.campaign.id,
        id: coinGroupId,
        containerId: pouchId
      })
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: base.campaign.id,
        id: idFor(805),
        denominationId,
        groupId: coinGroupId,
        amount: 17,
        containerId: pouchId
      })
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: base.campaign.id,
        id: idFor(806),
        denominationId,
        amount: 3,
        containerId: bag.id
      })
    })
    const input: TransferCampaignInventoryInput = {
      kind: 'ITEM',
      campaignId: base.campaign.id,
      source: party(base.campaign.id),
      destination: vehicle(base.firstVehicle.id),
      itemId: bag.id,
      amount: 1,
      expectedSourceVersion: 1,
      expectedDestinationVersion: 0,
      idempotencyKey: crypto.randomUUID()
    }
    const before = await base.readStored()
    await expect(
      base.owner.caller.run(async (ctx) => {
        await ctx.runMutation(transfer, { input })
        expect((await ctx.db.get(bag._id))?.vehicleId).toBe(base.firstVehicle.id)
        throw new Error('Abort after complete bag transfer')
      })
    ).rejects.toThrow('Abort after complete bag transfer')
    expect(await base.readStored()).toEqual(before)

    await base.t.run((ctx) => ctx.db.patch(bag._id, { containerId: pouchId }))
    const cyclic = await base.readStored()
    await expect(base.owner.caller.mutation(transfer, { input })).rejects.toThrow('cycle')
    expect(await base.readStored()).toEqual(cyclic)
    await base.t.run((ctx) => ctx.db.patch(bag._id, { containerId: parentId }))
    const grouped = before.currencies.find((balance) => balance.groupId === coinGroupId)!
    await base.t.run((ctx) => ctx.db.patch(grouped._id, { containerId: parentId }))
    const misplaced = await base.readStored()
    await expect(base.owner.caller.mutation(transfer, { input })).rejects.toThrow(
      'placement mismatch'
    )
    expect(await base.readStored()).toEqual(misplaced)
    await base.t.run((ctx) => ctx.db.patch(grouped._id, { containerId: pouchId }))

    const result = await base.owner.caller.mutation(transfer, { input })
    const after = await base.readStored()
    expect(after.items.find((item) => item.id === parentId)).toEqual(
      before.items.find((item) => item.id === parentId)
    )
    for (const item of before.items.filter((item) => item.id !== parentId)) {
      const moved = after.items.find((row) => row.id === item.id)
      if (!moved?.retainedRulesJson) throw new Error('Missing acquired rules on transferred item.')
      const rules = acquiredEquipmentRulesSchema.parse(JSON.parse(moved.retainedRulesJson))
      expect(rules.equipmentId).toBe(item.equipmentId)
      expect(rules.systemId).toBe(srdSystemRecord.id)
      expect(
        rules.sources.some(
          (source) => source.subjectKind === 'EQUIPMENT' && source.subjectId === item.equipmentId
        )
      ).toBe(true)
      expect(moved).toEqual({
        ...item,
        retainedRulesJson: moved.retainedRulesJson,
        vehicleId: base.firstVehicle.id,
        containerId: item.id === bag.id ? null : item.containerId
      })
    }
    expect(after.groups).toEqual(
      before.groups.map((group) => ({ ...group, vehicleId: base.firstVehicle.id }))
    )
    expect(after.currencies).toEqual(
      before.currencies.map((balance) => ({ ...balance, vehicleId: base.firstVehicle.id }))
    )
    expect(await ownerVersion(base)).toBe(2)
    expect(await ownerVersion(base, base.firstVehicle.id)).toBe(1)
    expect(after.events.filter((event) => event.type === 'CUSTODY_TRANSFER')).toHaveLength(1)

    for (const [sourceId, destinationId] of [
      [base.firstVehicle.id, base.secondVehicle.id],
      [base.secondVehicle.id, undefined]
    ] as const) {
      const sourceVersion = await ownerVersion(base, sourceId)
      const destinationVersion = await ownerVersion(base, destinationId)
      await base.other.caller.mutation(transfer, {
        input: {
          ...input,
          source: vehicle(sourceId),
          destination:
            destinationId === undefined ? party(base.campaign.id) : vehicle(destinationId),
          expectedSourceVersion: sourceVersion,
          expectedDestinationVersion: destinationVersion,
          idempotencyKey: crypto.randomUUID()
        }
      })
      expect(await ownerVersion(base, sourceId)).toBe(sourceVersion + 1)
      expect(await ownerVersion(base, destinationId)).toBe(destinationVersion + 1)
    }
    const returned = await base.readStored()
    expect(returned.items.every((item) => item.vehicleId === undefined)).toBe(true)
    expect(returned.groups).toEqual(before.groups)
    expect(returned.currencies).toEqual(before.currencies)
    expect(returned.items.find((item) => item.id === bag.id)?.containerId).toBeNull()
    expect(returned.items.find((item) => item.id === pouchId)?.containerId).toBe(bag.id)
    expect(returned.items.find((item) => item.id === contentsId)?.containerId).toBe(pouchId)
    expect(returned.events.filter((event) => event.type === 'CUSTODY_TRANSFER')).toHaveLength(3)
    expect(await base.owner.caller.mutation(transfer, { input })).toEqual(result)
    expect(await base.readStored()).toEqual(returned)
  }, 30000)

  it('moves each selected populated bag unit with its contents and leaves only empty stack units behind', async () => {
    for (const amount of [1, 2, 4]) {
      const base = await setup()
      await base.t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [backpack, pouch].map((equipment) =>
          importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment })
        )
      })
      await base.other.caller.mutation(mutateParty, {
        input: { ...itemAdd(base.campaign.id, 0, 4), equipmentId: backpack.id }
      })
      const bag = (await base.readStored()).items[0]!
      const parentId = idFor(900)
      const pouchId = idFor(901)
      const contentsId = idFor(902)
      const unrelatedBagId = idFor(903)
      const unrelatedContentsId = idFor(904)
      const emptyGroupId = idFor(905)
      const coinGroupId = idFor(906)
      const unrelatedGroupId = idFor(907)
      const rootBalanceId = idFor(908)
      const coinBalanceId = idFor(909)
      const unrelatedBalanceId = idFor(910)
      const denominationId = srdSystemRecord.currencies[0]!.id
      await base.t.run(async (ctx) => {
        for (const item of [
          { id: parentId, equipmentId: backpack.id, containerId: null, quantity: 1 },
          { id: pouchId, equipmentId: pouch.id, containerId: bag.id, quantity: 3 },
          { id: contentsId, equipmentId: club.id, containerId: pouchId, quantity: 1 },
          { id: unrelatedBagId, equipmentId: backpack.id, containerId: null, quantity: 1 },
          {
            id: unrelatedContentsId,
            equipmentId: club.id,
            containerId: unrelatedBagId,
            quantity: 2
          }
        ])
          await ctx.db.insert('campaignPartyItems', { ...item, campaignId: base.campaign.id })
        await ctx.db.patch(bag._id, { containerId: parentId })
        for (const group of [
          { id: emptyGroupId, containerId: bag.id },
          { id: coinGroupId, containerId: pouchId },
          { id: unrelatedGroupId, containerId: unrelatedBagId }
        ])
          await ctx.db.insert('campaignPartyCurrencyGroups', {
            ...group,
            campaignId: base.campaign.id
          })
        for (const balance of [
          { id: rootBalanceId, amount: 3, containerId: bag.id },
          {
            id: coinBalanceId,
            amount: 17,
            groupId: coinGroupId,
            containerId: pouchId
          },
          {
            id: unrelatedBalanceId,
            amount: 5,
            groupId: unrelatedGroupId,
            containerId: unrelatedBagId
          }
        ])
          await ctx.db.insert('campaignPartyCurrencies', {
            ...balance,
            campaignId: base.campaign.id,
            denominationId
          })
      })
      const input: TransferCampaignInventoryInput = {
        kind: 'ITEM',
        campaignId: base.campaign.id,
        source: party(base.campaign.id),
        destination: vehicle(base.firstVehicle.id),
        itemId: bag.id,
        amount,
        expectedSourceVersion: 1,
        expectedDestinationVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
      const before = await base.readStored()
      await expect(
        base.owner.caller.run(async (ctx) => {
          await ctx.runMutation(transfer, { input })
          expect((await ctx.db.get(bag._id))?.vehicleId).toBe(base.firstVehicle.id)
          throw new Error('Abort populated bag transfer')
        })
      ).rejects.toThrow('Abort populated bag transfer')
      expect(await base.readStored()).toEqual(before)

      const result = await base.owner.caller.mutation(transfer, { input })
      const after = await base.readStored()
      expect(after.items.find((row) => row.id === bag.id)).toMatchObject({
        vehicleId: base.firstVehicle.id,
        quantity: 1,
        containerId: null
      })
      expect(
        after.items
          .filter(
            (row) =>
              row.equipmentId === backpack.id && row.id !== parentId && row.id !== unrelatedBagId
          )
          .reduce((total, row) => total + row.quantity, 0)
      ).toBe(4)
      expect(after.items.find((row) => row.id === pouchId)).toMatchObject({
        vehicleId: base.firstVehicle.id,
        quantity: 1,
        containerId: bag.id
      })
      expect(
        after.items
          .filter((row) => row.equipmentId === pouch.id)
          .reduce((total, row) => total + row.quantity, 0)
      ).toBe(3)
      expect(
        after.items.filter(
          (row) =>
            row.equipmentId === pouch.id &&
            row.id !== pouchId &&
            row.vehicleId === base.firstVehicle.id &&
            row.containerId === bag.id
        )
      ).toEqual([expect.objectContaining({ quantity: 2 })])
      const sourceSpare = after.items.filter(
        (row) =>
          row.equipmentId === backpack.id &&
          row.id !== bag.id &&
          row.vehicleId === undefined &&
          row.containerId === parentId
      )
      expect(sourceSpare).toEqual(
        amount === 4 ? [] : [expect.objectContaining({ quantity: 4 - amount })]
      )
      const destinationSpare = after.items.filter(
        (row) =>
          row.equipmentId === backpack.id &&
          row.id !== bag.id &&
          row.vehicleId === base.firstVehicle.id &&
          row.containerId === null
      )
      expect(destinationSpare).toEqual(
        amount === 1 ? [] : [expect.objectContaining({ quantity: amount - 1 })]
      )
      for (const id of [contentsId, emptyGroupId, coinGroupId, rootBalanceId, coinBalanceId])
        expect(
          [...after.items, ...after.groups, ...after.currencies].find((row) => row.id === id)
        ).toMatchObject({ vehicleId: base.firstVehicle.id })
      for (const id of [
        parentId,
        unrelatedBagId,
        unrelatedContentsId,
        unrelatedGroupId,
        unrelatedBalanceId
      ])
        expect(
          [...after.items, ...after.groups, ...after.currencies].find((row) => row.id === id)
        ).toEqual(
          [...before.items, ...before.groups, ...before.currencies].find((row) => row.id === id)
        )
      expect(await ownerVersion(base)).toBe(2)
      expect(await ownerVersion(base, base.firstVehicle.id)).toBe(1)
      expect(after.events.filter((event) => event.type === 'CUSTODY_TRANSFER')).toEqual([
        expect.objectContaining({ actorUserId: base.owner.userId, inventoryAudit: true })
      ])
      await expect(base.owner.caller.mutation(transfer, { input })).resolves.toEqual(result)
      expect(await base.readStored()).toEqual(after)
    }
  }, 30000)
  it('moves a party item partially to a Vehicle then fully onward with exact replay and one custody audit', async () => {
    const base = await setup()
    await base.other.caller.mutation(mutateParty, { input: itemAdd(base.campaign.id, 0, 5) })
    const sourceItem = (await base.readStored()).items.find((row) => row.vehicleId === undefined)
    if (!sourceItem) throw new Error('Missing party item fixture.')
    const partial: TransferCampaignInventoryInput = {
      kind: 'ITEM',
      campaignId: base.campaign.id.toUpperCase(),
      source: party(base.campaign.id.toUpperCase()),
      destination: vehicle(base.firstVehicle.id.toUpperCase()),
      itemId: sourceItem.id.toUpperCase(),
      amount: 2,
      expectedSourceVersion: 1,
      expectedDestinationVersion: 0,
      idempotencyKey: crypto.randomUUID()
    }
    const first = await base.owner.caller.mutation(transfer, { input: partial })
    expect(first.eventId).toMatch(/^[0-9a-f-]{36}$/)
    await expect(base.owner.caller.mutation(transfer, { input: partial })).resolves.toEqual(first)
    await expect(
      base.owner.caller.mutation(transfer, { input: { ...partial, amount: 1 } })
    ).rejects.toThrow('different input')

    const afterPartial = await base.readStored()
    const partyItem = afterPartial.items.find((row) => row.id === sourceItem.id)
    const vehicleItem = afterPartial.items.find((row) => row.vehicleId === base.firstVehicle.id)
    expect(partyItem).toMatchObject({ quantity: 3, containerId: null })
    expect(vehicleItem).toMatchObject({ quantity: 2, containerId: null })
    expect(vehicleItem?.id).not.toBe(sourceItem.id)
    expect(await ownerVersion(base)).toBe(2)
    expect(await ownerVersion(base, base.firstVehicle.id)).toBe(1)
    const custodyEvents = afterPartial.events.filter((event) => event.type === 'CUSTODY_TRANSFER')
    expect(custodyEvents).toHaveLength(1)
    expect(custodyEvents[0]).toMatchObject({
      id: first.eventId,
      actorUserId: base.owner.userId,
      visibility: 'OWNER',
      inventoryAudit: true
    })
    expect(custodyEvents[0]?.inputFingerprint).toBeTruthy()
    const replaySnapshot = await base.readStored()
    await expect(base.other.caller.mutation(transfer, { input: partial })).rejects.toThrow(
      'different input'
    )
    await base.t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
        )
        .unique()
      if (!member) throw new Error('Missing active player membership.')
      await ctx.db.patch(member._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    await expect(base.owner.caller.mutation(transfer, { input: partial })).rejects.toThrow(
      'Campaign not found'
    )
    expect(await base.readStored()).toEqual(replaySnapshot)

    const returned: TransferCampaignInventoryInput = {
      kind: 'ITEM',
      campaignId: base.campaign.id,
      source: vehicle(base.firstVehicle.id),
      destination: party(base.campaign.id),
      itemId: vehicleItem!.id,
      amount: 2,
      expectedSourceVersion: 1,
      expectedDestinationVersion: 2,
      idempotencyKey: crypto.randomUUID()
    }
    await base.other.caller.mutation(transfer, { input: returned })
    const returnItem = (await base.readStored()).items.find((row) => row.id === vehicleItem!.id)
    if (!returnItem) throw new Error('Missing returned item fixture.')
    await base.other.caller.mutation(transfer, {
      input: {
        kind: 'ITEM',
        campaignId: base.campaign.id,
        source: party(base.campaign.id),
        destination: vehicle(base.secondVehicle.id),
        itemId: returnItem.id,
        amount: 2,
        expectedSourceVersion: 3,
        expectedDestinationVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const final = await base.readStored()
    expect(final.items.find((row) => row.id === vehicleItem!.id)).toMatchObject({
      vehicleId: base.secondVehicle.id,
      quantity: 2,
      containerId: null
    })
    expect(
      final.items
        .filter((row) => row.equipmentId === club.id)
        .reduce((sum, row) => sum + row.quantity, 0)
    ).toBe(5)
  }, 15000)

  it('permits an active player to source party custody, and refuses Vehicle sources and invalid custody without writes', async () => {
    const base = await setup()
    await base.other.caller.mutation(mutateParty, { input: itemAdd(base.campaign.id, 0, 2) })
    const sourceItem = (await base.readStored()).items.find((row) => row.vehicleId === undefined)
    if (!sourceItem) throw new Error('Missing party item fixture.')
    await base.owner.caller.mutation(transfer, {
      input: {
        kind: 'ITEM',
        campaignId: base.campaign.id,
        source: party(base.campaign.id),
        destination: vehicle(base.firstVehicle.id),
        itemId: sourceItem.id,
        amount: 1,
        expectedSourceVersion: 1,
        expectedDestinationVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const before = await base.readStored()
    const vehicleItem = before.items.find((row) => row.vehicleId === base.firstVehicle.id)
    if (!vehicleItem) throw new Error('Missing Vehicle item fixture.')
    await expect(
      base.other.caller.mutation(transfer, {
        input: {
          kind: 'ITEM',
          campaignId: base.campaign.id,
          source: party(base.campaign.id),
          destination: vehicle(idFor(98)),
          itemId: sourceItem.id,
          amount: 1,
          expectedSourceVersion: 2,
          expectedDestinationVersion: 0,
          idempotencyKey: crypto.randomUUID()
        }
      })
    ).rejects.toThrow('unavailable')
    await expect(
      base.other.caller.mutation(transfer, {
        input: {
          kind: 'ITEM',
          campaignId: base.campaign.id,
          source: party(base.campaign.id),
          destination: vehicle(base.secondVehicle.id),
          itemId: sourceItem.id,
          amount: 1,
          expectedSourceVersion: 2,
          expectedDestinationVersion: 1,
          idempotencyKey: crypto.randomUUID()
        }
      })
    ).rejects.toThrow('changed')
    await expect(
      base.owner.caller.mutation(transfer, {
        input: {
          kind: 'ITEM',
          campaignId: base.campaign.id,
          source: vehicle(base.firstVehicle.id),
          destination: party(base.campaign.id),
          itemId: vehicleItem.id,
          amount: 1,
          expectedSourceVersion: 1,
          expectedDestinationVersion: 2,
          idempotencyKey: crypto.randomUUID()
        }
      })
    ).rejects.toThrow()
    await expect(
      base.owner.caller.mutation(transfer, {
        input: {
          kind: 'ITEM',
          campaignId: base.campaign.id,
          source: { kind: 'CHARACTER', characterId: base.character.id },
          destination: party(base.campaign.id),
          itemId: sourceItem.id,
          amount: 1,
          expectedSourceVersion: 0,
          expectedDestinationVersion: 2,
          idempotencyKey: crypto.randomUUID()
        }
      })
    ).rejects.toThrow()
    expect(await base.readStored()).toEqual(before)
  }, 15000)

  it('moves an item directly between Vehicles with one replayable custody audit', async () => {
    const base = await setup()
    await base.other.caller.mutation(mutateParty, { input: itemAdd(base.campaign.id, 0, 2) })
    const partyItem = (await base.readStored()).items.find((row) => row.vehicleId === undefined)
    if (!partyItem) throw new Error('Missing party item fixture.')
    await base.other.caller.mutation(transfer, {
      input: {
        kind: 'ITEM',
        campaignId: base.campaign.id,
        source: party(base.campaign.id),
        destination: vehicle(base.firstVehicle.id),
        itemId: partyItem.id,
        amount: 2,
        expectedSourceVersion: 1,
        expectedDestinationVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const vehicleItem = (await base.readStored()).items.find(
      (row) => row.vehicleId === base.firstVehicle.id
    )
    if (!vehicleItem) throw new Error('Missing first Vehicle item fixture.')
    const direct: TransferCampaignInventoryInput = {
      kind: 'ITEM',
      campaignId: base.campaign.id,
      source: vehicle(base.firstVehicle.id),
      destination: vehicle(base.secondVehicle.id),
      itemId: vehicleItem.id,
      amount: 2,
      expectedSourceVersion: 1,
      expectedDestinationVersion: 0,
      idempotencyKey: crypto.randomUUID()
    }
    const before = await base.readStored()
    const result = await base.other.caller.mutation(transfer, { input: direct })
    await expect(base.other.caller.mutation(transfer, { input: direct })).resolves.toEqual(result)
    const after = await base.readStored()
    expect(after.items.find((row) => row.id === vehicleItem.id)).toMatchObject({
      vehicleId: base.secondVehicle.id,
      quantity: 2,
      containerId: null
    })
    expect(after.items.filter((row) => row.equipmentId === club.id)).toHaveLength(1)
    expect(await ownerVersion(base, base.firstVehicle.id)).toBe(2)
    expect(await ownerVersion(base, base.secondVehicle.id)).toBe(1)
    expect(after.events.filter((event) => event.type === 'CUSTODY_TRANSFER')).toHaveLength(
      before.events.filter((event) => event.type === 'CUSTODY_TRANSFER').length + 1
    )
  }, 15000)

  it('fails unavailable, stale, foreign, and archived transfers atomically', async () => {
    const base = await setup()
    await base.other.caller.mutation(mutateParty, { input: itemAdd(base.campaign.id, 0, 2) })
    const sourceItem = (await base.readStored()).items.find((row) => row.vehicleId === undefined)
    if (!sourceItem) throw new Error('Missing party item fixture.')
    await base.t.run(async (ctx) => {
      const child = campaignStoredPartyItemSchema.parse({
        campaignId: base.campaign.id,
        id: idFor(1),
        equipmentId: club.id,
        quantity: 1,
        containerId: sourceItem.id
      })
      await ctx.db.insert('campaignPartyItems', child)
    })
    const before = await base.readStored()
    const input: TransferCampaignInventoryInput = {
      kind: 'ITEM',
      campaignId: base.campaign.id,
      source: party(base.campaign.id),
      destination: vehicle(base.firstVehicle.id),
      itemId: sourceItem.id,
      amount: 2,
      expectedSourceVersion: 1,
      expectedDestinationVersion: 0,
      idempotencyKey: crypto.randomUUID()
    }
    await expect(
      base.other.caller.mutation(transfer, { input: { ...input, itemId: idFor(99) } })
    ).rejects.toThrow()
    await expect(
      base.other.caller.mutation(transfer, { input: { ...input, expectedSourceVersion: 0 } })
    ).rejects.toThrow('changed')
    expect(await base.readStored()).toEqual(before)
    const foreign = await base.owner.caller.mutation(createCampaign, {
      ...campaignInput,
      name: 'Foreign custody'
    })
    const foreignVehicle = await base.owner.caller.mutation(createVehicle, {
      campaignId: foreign.id,
      vehicleDefinitionId: cart.id
    })
    await expect(
      base.other.caller.mutation(transfer, {
        input: { ...input, destination: vehicle(foreignVehicle.id) }
      })
    ).rejects.toThrow()
    await base.other.caller.mutation(archiveCampaign, {
      campaignId: base.campaign.id,
      expectedVersion: 0
    })
    await expect(base.other.caller.mutation(transfer, { input })).rejects.toThrow('Archived')
  })

  it('uses campaign currency before same-id rules currency, drains multiple balances, and rolls back overflow', async () => {
    const base = await setup()
    const denominationId = srdSystemRecord.currencies[0]!.id
    const system = await base.other.caller.mutation(saveSystem, {
      campaignId: base.campaign.id,
      label: 'Custom coins',
      isReference: true,
      denominations: [
        { id: denominationId, label: 'Custom', abbreviation: 'cu', scaleInReference: 1 }
      ]
    })
    await base.t.run(async (ctx) => {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({ campaignId: base.campaign.id, version: 0 })
      )
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.firstVehicle.id,
          version: 0
        })
      )
      for (const [id, vehicleId] of [
        [idFor(13), undefined],
        [idFor(14), base.firstVehicle.id]
      ] as const)
        await ctx.db.insert(
          'campaignPartyCurrencyGroups',
          campaignStoredPartyCurrencyGroupSchema.parse({
            campaignId: base.campaign.id,
            ...(vehicleId === undefined ? {} : { vehicleId }),
            id,
            containerId: null
          })
        )
      for (const [id, amount, campaignCurrencySystemId, groupId, vehicleId] of [
        [idFor(10), 2, system.id, undefined, undefined],
        [idFor(11), 3, system.id, idFor(13), undefined],
        [idFor(12), 9, undefined, undefined, undefined],
        [idFor(15), 2, system.id, idFor(14), base.firstVehicle.id]
      ] as const)
        await ctx.db.insert(
          'campaignPartyCurrencies',
          campaignStoredPartyCurrencySchema.parse({
            campaignId: base.campaign.id,
            ...(vehicleId === undefined ? {} : { vehicleId }),
            id,
            denominationId,
            amount,
            campaignCurrencySystemId,
            ...(groupId === undefined ? {} : { groupId }),
            containerId: null
          })
        )
    })
    await base.other.caller.mutation(transfer, {
      input: {
        kind: 'CURRENCY',
        campaignId: base.campaign.id,
        source: party(base.campaign.id),
        destination: vehicle(base.firstVehicle.id),
        denominationId,
        amount: 4,
        expectedSourceVersion: 0,
        expectedDestinationVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const after = await base.readStored()
    expect(
      after.currencies
        .filter((row) => row.vehicleId === undefined && row.campaignCurrencySystemId === system.id)
        .reduce((sum, row) => sum + row.amount, 0)
    ).toBe(1)
    expect(
      after.currencies.find(
        (row) => row.vehicleId === undefined && row.campaignCurrencySystemId === undefined
      )?.amount
    ).toBe(9)
    expect(
      after.currencies
        .filter(
          (row) =>
            row.vehicleId === base.firstVehicle.id && row.campaignCurrencySystemId === system.id
        )
        .reduce((sum, row) => sum + row.amount, 0)
    ).toBe(6)
    expect(
      after.currencies.find(
        (row) => row.vehicleId === base.firstVehicle.id && row.groupId === undefined
      )
    ).toMatchObject({ amount: 4, containerId: null })
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_owner_system_denomination_container', (q) =>
          q
            .eq('campaignId', base.campaign.id)
            .eq('vehicleId', base.firstVehicle.id)
            .eq('campaignCurrencySystemId', system.id)
            .eq('denominationId', denominationId)
            .eq('groupId', undefined)
            .eq('containerId', null)
        )
        .unique()
      if (!row) throw new Error('Missing Vehicle currency fixture.')
      await ctx.db.patch(row._id, { amount: Number.MAX_SAFE_INTEGER })
    })
    const beforeOverflow = await base.readStored()
    await expect(
      base.other.caller.mutation(transfer, {
        input: {
          kind: 'CURRENCY',
          campaignId: base.campaign.id,
          source: party(base.campaign.id),
          destination: vehicle(base.firstVehicle.id),
          denominationId,
          amount: 1,
          expectedSourceVersion: 1,
          expectedDestinationVersion: 1,
          idempotencyKey: crypto.randomUUID()
        }
      })
    ).rejects.toThrow('supported range')
    expect(await base.readStored()).toEqual(beforeOverflow)
  })

  it('pages Vehicle currency balances and conserves complete Vehicle transfers', async () => {
    const base = await setup()
    const denominationId = srdSystemRecord.currencies[0]!.id
    const system = await base.other.caller.mutation(saveSystem, {
      campaignId: base.campaign.id,
      label: 'Paged coins',
      isReference: true,
      denominations: [
        { id: denominationId, label: 'Paged', abbreviation: 'pg', scaleInReference: 1 }
      ]
    })
    await base.t.run(async (ctx) => {
      for (const vehicleId of [base.firstVehicle.id, base.secondVehicle.id])
        await ctx.db.insert(
          'campaignPartyInventories',
          campaignStoredPartyInventorySchema.parse({
            campaignId: base.campaign.id,
            vehicleId,
            version: 0
          })
        )
      for (let index = 0; index < 49; index += 1)
        await ctx.db.insert(
          'campaignPartyCurrencies',
          campaignStoredPartyCurrencySchema.parse({
            campaignId: base.campaign.id,
            vehicleId: base.firstVehicle.id,
            id: idFor(100 + index),
            denominationId,
            campaignCurrencySystemId: system.id,
            amount: 1,
            containerId: null
          })
        )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.secondVehicle.id,
          id: idFor(200),
          denominationId,
          campaignCurrencySystemId: system.id,
          amount: 5,
          containerId: null
        })
      )
    })
    const direct: TransferCampaignInventoryInput = {
      kind: 'CURRENCY',
      campaignId: base.campaign.id,
      source: vehicle(base.firstVehicle.id),
      destination: vehicle(base.secondVehicle.id),
      denominationId,
      amount: 49,
      expectedSourceVersion: 0,
      expectedDestinationVersion: 0,
      idempotencyKey: crypto.randomUUID()
    }
    const before = await base.readStored()
    const first = await base.other.caller.mutation(transfer, { input: direct })
    await expect(base.other.caller.mutation(transfer, { input: direct })).resolves.toEqual(first)
    const afterDirect = await base.readStored()
    expect(
      afterDirect.currencies.filter((row) => row.vehicleId === base.firstVehicle.id)
    ).toHaveLength(0)
    expect(
      afterDirect.currencies
        .filter((row) => row.vehicleId === base.secondVehicle.id)
        .reduce((total, row) => total + row.amount, 0)
    ).toBe(54)
    expect(await ownerVersion(base, base.firstVehicle.id)).toBe(1)
    expect(await ownerVersion(base, base.secondVehicle.id)).toBe(1)
    expect(afterDirect.events.filter((event) => event.type === 'CUSTODY_TRANSFER')).toHaveLength(
      before.events.filter((event) => event.type === 'CUSTODY_TRANSFER').length + 1
    )
    const toParty: TransferCampaignInventoryInput = {
      kind: 'CURRENCY',
      campaignId: base.campaign.id,
      source: vehicle(base.secondVehicle.id),
      destination: party(base.campaign.id),
      denominationId,
      amount: 54,
      expectedSourceVersion: 1,
      expectedDestinationVersion: 0,
      idempotencyKey: crypto.randomUUID()
    }
    const second = await base.other.caller.mutation(transfer, { input: toParty })
    await expect(base.other.caller.mutation(transfer, { input: toParty })).resolves.toEqual(second)
    const afterParty = await base.readStored()
    expect(
      afterParty.currencies.filter((row) => row.vehicleId === base.secondVehicle.id)
    ).toHaveLength(0)
    expect(
      afterParty.currencies
        .filter((row) => row.vehicleId === undefined)
        .reduce((total, row) => total + row.amount, 0)
    ).toBe(54)
    expect(await ownerVersion(base)).toBe(1)
    expect(await ownerVersion(base, base.secondVehicle.id)).toBe(2)
    expect(afterParty.events.filter((event) => event.type === 'CUSTODY_TRANSFER')).toHaveLength(
      before.events.filter((event) => event.type === 'CUSTODY_TRANSFER').length + 2
    )
  }, 30000)

  it('rolls back both owners, inventory rows, and the custody event when an enclosing mutation fails', async () => {
    const base = await setup()
    await base.other.caller.mutation(mutateParty, { input: itemAdd(base.campaign.id, 0, 1) })
    const item = (await base.readStored()).items.find((row) => row.vehicleId === undefined)
    if (!item) throw new Error('Missing party item fixture.')
    const before = await base.readStored()
    await expect(
      base.owner.caller.run(async (ctx) => {
        await ctx.runMutation(transfer, {
          input: {
            kind: 'ITEM',
            campaignId: base.campaign.id,
            source: party(base.campaign.id),
            destination: vehicle(base.firstVehicle.id),
            itemId: item.id,
            amount: 1,
            expectedSourceVersion: 1,
            expectedDestinationVersion: 0,
            idempotencyKey: crypto.randomUUID()
          }
        })
        throw new Error('late enclosing rollback')
      })
    ).rejects.toThrow('late enclosing rollback')
    expect(await base.readStored()).toEqual(before)
  })

  it('uses explicit namespaces for colliding Party and Vehicle currency and binds replay to that choice', async () => {
    const base = await setup()
    const denominationId = srdSystemRecord.currencies[0]!.id
    const system = await base.other.caller.mutation(saveSystem, {
      campaignId: base.campaign.id,
      label: 'Custom collision',
      isReference: true,
      denominations: [
        { id: denominationId, label: 'Custom', abbreviation: 'cu', scaleInReference: 1 }
      ]
    })
    await base.other.caller.mutation(mutateParty, {
      input: {
        kind: 'CURRENCY_ADJUST',
        campaignId: base.campaign.id,
        denominationId,
        campaignCurrencySystemId: null,
        amount: 7,
        expectedOwnerVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    await base.other.caller.mutation(mutateParty, {
      input: {
        kind: 'CURRENCY_ADJUST',
        campaignId: base.campaign.id,
        denominationId,
        campaignCurrencySystemId: system.id,
        amount: 5,
        expectedOwnerVersion: 1,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const rulesInput = {
      kind: 'CURRENCY' as const,
      campaignId: base.campaign.id,
      denominationId,
      campaignCurrencySystemId: null,
      source: party(base.campaign.id),
      destination: vehicle(base.firstVehicle.id),
      amount: 3,
      expectedSourceVersion: 2,
      expectedDestinationVersion: 0,
      idempotencyKey: crypto.randomUUID()
    }
    const first = await base.other.caller.mutation(transfer, { input: rulesInput })
    const afterRules = await base.readStored()
    expect(
      afterRules.currencies.find(
        (row) => row.vehicleId === undefined && row.campaignCurrencySystemId === undefined
      )?.amount
    ).toBe(4)
    expect(
      afterRules.currencies.find(
        (row) => row.vehicleId === undefined && row.campaignCurrencySystemId === system.id
      )?.amount
    ).toBe(5)
    expect(
      afterRules.currencies.find(
        (row) =>
          row.vehicleId === base.firstVehicle.id && row.campaignCurrencySystemId === undefined
      )?.amount
    ).toBe(3)
    const customInput = {
      ...rulesInput,
      campaignCurrencySystemId: system.id.toUpperCase(),
      amount: 2,
      expectedSourceVersion: 3,
      expectedDestinationVersion: 1,
      idempotencyKey: crypto.randomUUID()
    }
    const custom = await base.other.caller.mutation(transfer, { input: customInput })
    const afterCustom = await base.readStored()
    expect(
      afterCustom.currencies.find(
        (row) =>
          row.vehicleId === base.firstVehicle.id && row.campaignCurrencySystemId === system.id
      )?.amount
    ).toBe(2)
    expect(
      JSON.parse(afterCustom.events.find((event) => event.id === custom.eventId)!.payloadJson)
    ).toMatchObject({
      denominationId,
      campaignCurrencySystemId: system.id
    })
    await expect(base.other.caller.mutation(transfer, { input: rulesInput })).resolves.toEqual(
      first
    )
    await expect(
      base.other.caller.mutation(transfer, {
        input: { ...customInput, campaignCurrencySystemId: system.id }
      })
    ).resolves.toEqual(custom)
    await expect(
      base.other.caller.mutation(transfer, {
        input: { ...rulesInput, campaignCurrencySystemId: system.id }
      })
    ).rejects.toThrow('different input')
    await expect(
      base.other.caller.mutation(transfer, {
        input: {
          ...rulesInput,
          campaignCurrencySystemId: crypto.randomUUID(),
          expectedSourceVersion: 4,
          expectedDestinationVersion: 2,
          idempotencyKey: crypto.randomUUID()
        }
      })
    ).rejects.toThrow('unavailable')
    expect(await base.readStored()).toEqual(afterCustom)
  })
})
