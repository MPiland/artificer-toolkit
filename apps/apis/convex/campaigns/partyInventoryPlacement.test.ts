// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { CampaignPartyInventoryMutationInput } from '@artificer-toolkit/schema/api/campaignInventory'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api, internal } from '../_generated/api'

type Command = CampaignPartyInventoryMutationInput extends infer Input
  ? Input extends { kind: string }
    ? Omit<Input, 'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey' | 'vehicleId'>
    : never
  : never

async function setup() {
  if (fighter.category !== 'BASE') throw new Error('Expected the base Fighter.')
  const base = await readySheetFixture()
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart }),
      importedSubject({ subjectKind: 'EQUIPMENT', ...backpack, document: backpack })
    ]
  })
  const campaign = await base.other.caller.mutation(api.campaigns.create.create, {
    name: 'Inventory placement',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
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
  const vehicle = await base.other.caller.mutation(api.campaigns.vehicles.create, {
    campaignId: campaign.id,
    vehicleDefinitionId: cart.id
  })
  const read = () =>
    base.t.run(async (ctx) => ({
      owners: await ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      items: await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      groups: await ctx.db
        .query('campaignPartyCurrencyGroups')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      balances: await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      events: await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect()
    }))
  const inputFor = async (
    command: Command,
    vehicleId?: string
  ): Promise<CampaignPartyInventoryMutationInput> => {
    const stored = await read()
    return {
      ...command,
      campaignId: campaign.id,
      ...(vehicleId === undefined ? {} : { vehicleId }),
      expectedOwnerVersion:
        stored.owners.find((owner) => owner.vehicleId === vehicleId?.toLowerCase())?.version ?? 0,
      idempotencyKey: crypto.randomUUID()
    }
  }
  const execute = async (command: Command, vehicleId?: string) =>
    base.other.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: await inputFor(command, vehicleId)
    })
  const addBag = async (vehicleId?: string) => {
    const result = await execute(
      { kind: 'ITEM_ADD', equipmentId: backpack.id, quantity: 1 },
      vehicleId
    )
    const after = await read()
    const event = after.events.find((row) => row.id === result.eventId)
    if (!event) throw new Error('Bag receipt is missing.')
    const payload: unknown = JSON.parse(event.payloadJson)
    if (payload === null || typeof payload !== 'object' || !('itemId' in payload))
      throw new Error('Bag receipt is invalid.')
    const bag = after.items.find((row) => row.id === payload.itemId)
    if (!bag) throw new Error('Bag item is missing.')
    return bag
  }
  return {
    ...base,
    campaign,
    vehicle,
    read,
    inputFor,
    execute,
    addBag,
    goldId: fighter.startingGold.currencyId
  }
}

describe('native party and Vehicle inventory placement', () => {
  it('isolates Vehicle item and coin placement, preserves no-op rows, normalizes replay IDs, and rolls back late failure', async () => {
    const base = await setup()
    const partyBag = await base.addBag()
    const vehicleBag = await base.addBag(base.vehicle.id)
    await base.execute(
      {
        kind: 'ITEM_ADD',
        equipmentId: club.id,
        quantity: 1,
        containerId: vehicleBag.id.toUpperCase()
      },
      base.vehicle.id.toUpperCase()
    )
    const child = (await base.read()).items.find((item) => item.containerId === vehicleBag.id)
    expect(child?.vehicleId).toBe(base.vehicle.id)
    await base.execute(
      {
        kind: 'CURRENCY_ADJUST',
        denominationId: base.goldId,
        campaignCurrencySystemId: null,
        amount: 7,
        containerId: vehicleBag.id
      },
      base.vehicle.id
    )
    await base.execute(
      {
        kind: 'CURRENCY_MOVE',
        denominationId: base.goldId,
        campaignCurrencySystemId: null,
        amount: 3,
        fromContainerId: vehicleBag.id,
        toContainerId: null
      },
      base.vehicle.id
    )
    const beforeNoop = await base.read()
    const noop = await base.inputFor(
      {
        kind: 'CURRENCY_MOVE',
        denominationId: base.goldId,
        campaignCurrencySystemId: null,
        amount: 1000,
        fromContainerId: vehicleBag.id,
        toContainerId: vehicleBag.id
      },
      base.vehicle.id
    )
    if (noop.kind !== 'CURRENCY_MOVE') throw new Error('Expected the no-op coin move.')
    const receipt = await base.other.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: noop
    })
    const afterNoop = await base.read()
    expect(afterNoop.items).toEqual(beforeNoop.items)
    expect(afterNoop.groups).toEqual(beforeNoop.groups)
    expect(afterNoop.balances).toEqual(beforeNoop.balances)
    expect(afterNoop.owners.find((row) => row.vehicleId === base.vehicle.id)?.version).toBe(
      noop.expectedOwnerVersion + 1
    )
    expect(afterNoop.owners.find((row) => row.vehicleId === undefined)?.version).toBe(1)
    expect(afterNoop.items.find((row) => row.id === partyBag.id)?.vehicleId).toBeUndefined()
    expect(afterNoop.balances.every((row) => row.vehicleId === base.vehicle.id)).toBe(true)
    expect(
      await base.other.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: {
          ...noop,
          vehicleId: base.vehicle.id.toUpperCase(),
          fromContainerId: vehicleBag.id.toUpperCase(),
          toContainerId: vehicleBag.id.toUpperCase()
        }
      })
    ).toEqual(receipt)
    expect(await base.read()).toEqual(afterNoop)
    await expect(
      base.other.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: { ...noop, amount: 999 }
      })
    ).rejects.toThrow('different input')
    await expect(
      base.owner.caller.mutation(api.campaigns.partyInventoryCommands.mutate, { input: noop })
    ).rejects.toThrow('owner')
    expect(await base.read()).toEqual(afterNoop)
    if (!child) throw new Error('Vehicle child item is missing.')
    await base.execute(
      { kind: 'ITEM_UPDATE', itemId: child.id, quantity: 1, containerId: null },
      base.vehicle.id
    )
    expect((await base.read()).items.find((row) => row.id === child.id)?.containerId).toBeNull()
    const update = await base.inputFor(
      { kind: 'ITEM_UPDATE', itemId: child.id, quantity: 1, containerId: vehicleBag.id },
      base.vehicle.id
    )
    const beforeAbort = await base.read()
    await expect(
      base.other.caller.run(async (ctx) => {
        await ctx.runMutation(api.campaigns.partyInventoryCommands.mutate, { input: update })
        throw new Error('Abort after placement and audit')
      })
    ).rejects.toThrow('Abort after placement and audit')
    expect(await base.read()).toEqual(beforeAbort)
  })

  it('rejects self, nested, non-container and foreign-owner destinations without publishing rows or receipts', async () => {
    const base = await setup()
    const bag = await base.addBag()
    const vehicleBag = await base.addBag(base.vehicle.id)
    await base.execute({ kind: 'ITEM_ADD', equipmentId: club.id, quantity: 1 })
    const item = (await base.read()).items.find((row) => row.equipmentId === club.id)
    if (!item) throw new Error('Loose item is missing.')
    for (const command of [
      { kind: 'ITEM_ADD' as const, equipmentId: club.id, quantity: 1, containerId: vehicleBag.id },
      { kind: 'ITEM_ADD' as const, equipmentId: club.id, quantity: 1, containerId: item.id },
      { kind: 'ITEM_ADD' as const, equipmentId: backpack.id, quantity: 1, containerId: bag.id },
      { kind: 'ITEM_UPDATE' as const, itemId: bag.id, quantity: 1, containerId: bag.id },
      {
        kind: 'CURRENCY_ADJUST' as const,
        denominationId: base.goldId,
        amount: 1,
        containerId: vehicleBag.id
      }
    ]) {
      const before = await base.read()
      await expect(base.execute(command)).rejects.toThrow(/unavailable|not a container|itself/)
      expect(await base.read()).toEqual(before)
    }
  })

  it('drains all 49 groups while preserving qualified collisions, empty group identities, and overflow rollback', async () => {
    const base = await setup()
    const bag = await base.addBag()
    const system = await base.other.caller.mutation(api.campaigns.currencySystems.save, {
      campaignId: base.campaign.id,
      label: 'Colliding gold',
      isReference: true,
      denominations: [
        { id: base.goldId, label: 'Campaign gold', abbreviation: 'cg', scaleInReference: 1 }
      ]
    })
    await base.t.run(async (ctx) => {
      for (let index = 0; index < 49; index++) {
        const groupId = crypto.randomUUID()
        await ctx.db.insert('campaignPartyCurrencyGroups', {
          campaignId: base.campaign.id,
          id: groupId,
          containerId: bag.id
        })
        await ctx.db.insert('campaignPartyCurrencies', {
          campaignId: base.campaign.id,
          id: crypto.randomUUID(),
          groupId,
          containerId: bag.id,
          denominationId: base.goldId,
          amount: 1
        })
        if (index === 0)
          await ctx.db.insert('campaignPartyCurrencies', {
            campaignId: base.campaign.id,
            id: crypto.randomUUID(),
            groupId,
            containerId: bag.id,
            denominationId: base.goldId,
            campaignCurrencySystemId: system.id,
            amount: 9
          })
      }
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: base.campaign.id,
        id: crypto.randomUUID(),
        containerId: null,
        denominationId: base.goldId,
        amount: 3
      })
    })
    const before = await base.read()
    await base.execute({
      kind: 'CURRENCY_MOVE',
      denominationId: base.goldId,
      campaignCurrencySystemId: null,
      fromContainerId: bag.id,
      toContainerId: null,
      amount: 49
    })
    const after = await base.read()
    expect(after.groups).toEqual(before.groups)
    expect(after.balances.filter((row) => row.campaignCurrencySystemId === system.id)).toEqual(
      before.balances.filter((row) => row.campaignCurrencySystemId === system.id)
    )
    const loose = after.balances.find(
      (row) => row.campaignCurrencySystemId === undefined && row.containerId === null
    )
    expect(loose?.amount).toBe(52)
    expect(after.balances).toHaveLength(2)
    if (!loose) throw new Error('Loose balance is missing.')
    await base.t.run(async (ctx) => {
      await ctx.db.patch(loose._id, { amount: Number.MAX_SAFE_INTEGER })
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: base.campaign.id,
        id: crypto.randomUUID(),
        denominationId: base.goldId,
        amount: 1,
        containerId: bag.id
      })
    })
    const overflow = await base.read()
    const command = {
      kind: 'CURRENCY_MOVE' as const,
      denominationId: base.goldId,
      campaignCurrencySystemId: null,
      fromContainerId: bag.id,
      toContainerId: null,
      amount: 1
    }
    await expect(base.execute(command)).rejects.toThrow('supported range')
    expect(await base.read()).toEqual(overflow)
    await base.t.run((ctx) => ctx.db.patch(loose._id, { amount: 52 }))
    const input = await base.inputFor(command)
    const beforeAbort = await base.read()
    await expect(
      base.other.caller.run(async (ctx) => {
        await ctx.runMutation(api.campaigns.partyInventoryCommands.mutate, { input })
        throw new Error('Abort after coin move and audit')
      })
    ).rejects.toThrow('Abort after coin move and audit')
    expect(await base.read()).toEqual(beforeAbort)
    await expect(base.execute({ kind: 'ITEM_REMOVE', itemId: bag.id })).rejects.toThrow(
      'Empty a container'
    )
    expect(await base.read()).toEqual(beforeAbort)
    await base.execute(command)
    await base.execute({
      kind: 'CURRENCY_MOVE',
      denominationId: base.goldId,
      campaignCurrencySystemId: system.id,
      fromContainerId: bag.id,
      toContainerId: null,
      amount: 9
    })
    const empty = await base.read()
    expect(empty.groups).toHaveLength(49)
    const remove = await base.inputFor({ kind: 'ITEM_REMOVE', itemId: bag.id })
    await expect(
      base.other.caller.run(async (ctx) => {
        await ctx.runMutation(api.campaigns.partyInventoryCommands.mutate, { input: remove })
        throw new Error('Abort after empty group placement and container removal')
      })
    ).rejects.toThrow('Abort after empty group placement and container removal')
    expect(await base.read()).toEqual(empty)
    const removed = await base.other.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: remove
    })
    const final = await base.read()
    expect(final.groups).toEqual(empty.groups.map((group) => ({ ...group, containerId: null })))
    expect(final.items.some((item) => item.id === bag.id)).toBe(false)
    expect(final.balances).toEqual(empty.balances)
    expect(
      await base.other.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: remove
      })
    ).toEqual(removed)
    expect(await base.read()).toEqual(final)
  })
})
