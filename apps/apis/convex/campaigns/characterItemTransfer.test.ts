import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignAssignmentResult,
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignInventoryTransferResultDto,
  TransferCampaignInventoryInput,
  InventoryOwnerRefDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import type {
  CampaignVehicleDto,
  CampaignVehicleLifecycleInput,
  CampaignVehicleLifecycleResult,
  CreateCampaignVehicleInput
} from '@artificer-toolkit/schema/api/campaignVehicles'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { pouch } from '@artificer-toolkit/source-data/srd/equipment/pouch.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api, components, internal } from '../_generated/api'
import { readCharacterRecord } from '../characters/stateDocuments'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const assign = makeFunctionReference<
  'mutation',
  { campaignId: string; characterId: string },
  CampaignAssignmentResult
>('campaigns/assignments:assign')
const transfer = makeFunctionReference<
  'mutation',
  { input: TransferCampaignInventoryInput },
  CampaignInventoryTransferResultDto
>('campaigns/inventoryTransfers:transfer')
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
const ownerVersion = makeFunctionReference<
  'query',
  { input: { campaignId: string; owner: InventoryOwnerRefDto } },
  unknown
>('campaigns/inventoryOwners:version')

const idFor = (index: number) => `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`

async function setup() {
  const base = await readySheetFixture()
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [backpack, pouch].map((equipment) =>
      importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment })
    )
  })
  const campaign = await base.other.caller.mutation(create, {
    name: 'Character item custody',
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
  await base.owner.caller.mutation(assign, {
    campaignId: campaign.id,
    characterId: base.character.id
  })
  const readStored = () =>
    base.t.run(async (ctx) => ({
      character: await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
        .unique(),
      inventories: await ctx.db.query('campaignPartyInventories').collect(),
      items: await ctx.db.query('campaignPartyItems').collect(),
      groups: await ctx.db.query('campaignPartyCurrencyGroups').collect(),
      balances: await ctx.db.query('campaignPartyCurrencies').collect(),
      events: await ctx.db.query('campaignEvents').collect()
    }))
  return { ...base, campaign, readStored }
}

type Fixture = Awaited<ReturnType<typeof setup>>

async function setCharacterState(
  base: Fixture,
  update: (
    character: ReturnType<typeof readCharacterRecord>
  ) => ReturnType<typeof readCharacterRecord>
) {
  await base.t.run(async (ctx) => {
    const record = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique()
    if (!record) throw new Error('Missing Character fixture.')
    const character = update(readCharacterRecord(record))
    await ctx.db.patch(record._id, {
      documentJson: canonicalizeRuleDocument(character),
      checksum: checksumRuleDocument(character)
    })
  })
}

function itemCommand(
  base: Fixture,
  source: TransferCampaignInventoryInput['source'],
  destination: TransferCampaignInventoryInput['destination'],
  itemId: string,
  expectedSourceVersion: number,
  expectedDestinationVersion: number,
  amount = 1
): Extract<TransferCampaignInventoryInput, { kind: 'ITEM' }> {
  return {
    kind: 'ITEM',
    campaignId: base.campaign.id,
    source,
    destination,
    itemId,
    amount,
    expectedSourceVersion,
    expectedDestinationVersion,
    idempotencyKey: crypto.randomUUID()
  }
}

async function addThirdAssignedPlayer(base: Fixture) {
  const user = await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Third',
          email: 'third-item@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = base.t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Missing third-player identity.')
  const draft = await base.createCharacter()
  const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.draft.id,
    mode: 'create',
    character: draft.character
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: base.campaign.id,
      userId: identity.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: base.campaign.createdAt,
      joinedAt: base.campaign.createdAt,
      leftAt: null
    })
    const record = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', committed.character.id))
      .unique()
    const route = await ctx.db
      .query('authoredRouteIds')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', committed.character.id))
      .unique()
    if (!record || !route) throw new Error('Missing third-player Character.')
    const character = { ...readCharacterRecord(record), userId: identity.userId }
    await ctx.db.patch(record._id, {
      userId: identity.userId,
      documentJson: canonicalizeRuleDocument(character),
      checksum: checksumRuleDocument(character)
    })
    await ctx.db.patch(route._id, { ownerUserId: identity.userId })
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: base.campaign.id,
      characterId: committed.character.id,
      userId: identity.userId,
      assignedAt: new Date().toISOString()
    })
  })
  return { caller, characterId: committed.character.id, streamVersion: committed.streamVersion }
}

async function readCharacter(base: Fixture, characterId: string) {
  return base.t.run((ctx) =>
    ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', characterId))
      .unique()
  )
}
describe('native Character item custody', () => {
  it('moves a filled Character bag with exact item fields and currency groups, cleans only departed equipment references, and rolls back late aborts', async () => {
    const base = await setup()
    const bagId = idFor(1)
    const pouchId = idFor(2)
    const clubId = idFor(3)
    const groupId = idFor(4)
    const denominationId = srdSystemRecord.currencies[0]!.id
    await setCharacterState(base, (character) => ({
      ...character,
      state: {
        ...character.state,
        equipment: {
          ...character.state.equipment,
          inventory: [
            {
              id: bagId,
              equipmentId: backpack.id,
              quantity: 3,
              customName: 'Field bag',
              notes: 'Waterproofed'
            },
            {
              id: pouchId,
              equipmentId: pouch.id,
              quantity: 1,
              containerId: bagId,
              customName: 'Coin pouch',
              notes: 'Wax seal'
            },
            { id: clubId, equipmentId: club.id, quantity: 2, containerId: pouchId }
          ],
          equipped: [bagId, pouchId],
          attuned: [pouchId]
        },
        currency: [
          {
            id: groupId,
            containerId: pouchId,
            currencies: [{ currencyId: denominationId, kind: 'RULESET', amount: 17 }]
          }
        ],
        creatureEquipment: { [idFor(5)]: [{ equipmentItemId: pouchId }] },
        vehicleEquipment: { [idFor(6)]: [{ equipmentItemId: bagId }] }
      }
    }))
    const before = await base.readStored()
    const input = itemCommand(
      base,
      { kind: 'CHARACTER', characterId: base.character.id },
      { kind: 'CAMPAIGN', campaignId: base.campaign.id },
      bagId,
      before.character!.streamVersion,
      0,
      2
    )
    await expect(
      base.owner.caller.run(async (ctx) => {
        await ctx.runMutation(transfer, { input })
        throw new Error('Abort after Character item custody')
      })
    ).rejects.toThrow('Abort after Character item custody')
    expect(await base.readStored()).toEqual(before)

    await base.owner.caller.mutation(transfer, { input })
    const after = await base.readStored()
    const state = readCharacterRecord(after.character!).state
    expect(after.character!.streamVersion).toBe(before.character!.streamVersion + 1)
    expect(after.inventories).toContainEqual(
      expect.objectContaining({ campaignId: base.campaign.id, version: 1 })
    )
    expect(state.equipment.inventory).toHaveLength(1)
    expect(state.equipment.inventory[0]).toMatchObject({
      equipmentId: backpack.id,
      quantity: 1,
      customName: 'Field bag',
      notes: 'Waterproofed'
    })
    expect(state.equipment.inventory[0]?.id).not.toBe(bagId)
    expect(state.equipment.equipped).toEqual([])
    expect(state.equipment.attuned).toEqual([])
    expect(state.creatureEquipment?.[idFor(5)]).toEqual([])
    expect(state.vehicleEquipment?.[idFor(6)]).toEqual([])
    expect(after.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([bagId, pouchId, clubId])
    )
    expect(
      after.items.filter((item) => item.equipmentId === backpack.id && item.containerId === null)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: bagId, quantity: 1 }),
        expect.objectContaining({ quantity: 1 })
      ])
    )
    expect(after.items.find((item) => item.id === bagId)).toMatchObject({
      customName: 'Field bag',
      notes: 'Waterproofed',
      containerId: null
    })
    expect(after.items.find((item) => item.id === pouchId)).toMatchObject({
      customName: 'Coin pouch',
      notes: 'Wax seal',
      containerId: bagId
    })
    expect(after.groups).toContainEqual(
      expect.objectContaining({ id: groupId, containerId: pouchId })
    )
    expect(after.balances).toContainEqual(
      expect.objectContaining({ groupId, denominationId, amount: 17, containerId: pouchId })
    )
    const replaySnapshot = structuredClone(after)
    const replay = await base.owner.caller.mutation(transfer, { input })
    expect(replay).toEqual(expect.objectContaining({ eventId: after.events[0]?.id }))
    expect(await base.readStored()).toEqual(replaySnapshot)
    await expect(
      base.owner.caller.mutation(transfer, { input: { ...input, amount: 1 } })
    ).rejects.toThrow('different input')
    await expect(
      base.owner.caller.mutation(transfer, {
        input: {
          ...input,
          idempotencyKey: crypto.randomUUID(),
          expectedSourceVersion: input.expectedSourceVersion
        }
      })
    ).rejects.toThrow('changed')
    expect(await base.readStored()).toEqual(replaySnapshot)
  })

  it('maps Shared groups and direct balances into retained Character group identities', async () => {
    const base = await setup()
    const bagId = idFor(21)
    const pouchId = idFor(22)
    const groupId = idFor(23)
    const balanceId = idFor(24)
    const directBalanceId = idFor(25)
    const denominationId = srdSystemRecord.currencies[0]!.id
    await base.t.run(async (ctx) => {
      await ctx.db.insert('campaignPartyInventories', { campaignId: base.campaign.id, version: 0 })
      await ctx.db.insert('campaignPartyItems', {
        campaignId: base.campaign.id,
        id: bagId,
        equipmentId: backpack.id,
        quantity: 1,
        containerId: null
      })
      await ctx.db.insert('campaignPartyItems', {
        campaignId: base.campaign.id,
        id: pouchId,
        equipmentId: pouch.id,
        quantity: 1,
        containerId: bagId
      })
      await ctx.db.insert('campaignPartyCurrencyGroups', {
        campaignId: base.campaign.id,
        id: groupId,
        containerId: pouchId
      })
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: base.campaign.id,
        id: balanceId,
        groupId,
        denominationId,
        amount: 9,
        containerId: pouchId
      })
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: base.campaign.id,
        id: directBalanceId,
        denominationId,
        amount: 4,
        containerId: bagId
      })
    })
    const before = await base.readStored()
    const input = itemCommand(
      base,
      { kind: 'CAMPAIGN', campaignId: base.campaign.id },
      { kind: 'CHARACTER', characterId: base.character.id },
      bagId,
      0,
      before.character!.streamVersion
    )
    await base.owner.caller.mutation(transfer, { input })
    const after = await base.readStored()
    const groups = readCharacterRecord(after.character!).state.currency
    expect(after.items).toEqual([])
    expect(after.groups).toEqual([])
    expect(after.balances).toEqual([])
    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: groupId,
          containerId: pouchId,
          currencies: [
            expect.objectContaining({ currencyId: denominationId, kind: 'RULESET', amount: 9 })
          ]
        }),
        expect.objectContaining({
          id: directBalanceId,
          containerId: bagId,
          currencies: [
            expect.objectContaining({ currencyId: denominationId, kind: 'RULESET', amount: 4 })
          ]
        })
      ])
    )
  })
  it('settles Character cargo through unavailable Vehicle rules and keeps player Vehicle sourcing owner-only', async () => {
    const base = await setup()
    const itemId = idFor(41)
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
    })
    const vehicle = await base.other.caller.mutation(createVehicle, {
      campaignId: base.campaign.id,
      vehicleDefinitionId: cart.id
    })
    await setCharacterState(base, (character) => ({
      ...character,
      state: {
        ...character.state,
        equipment: {
          ...character.state.equipment,
          inventory: [{ id: itemId, equipmentId: club.id, quantity: 1 }],
          equipped: [itemId],
          attuned: [itemId]
        }
      }
    }))
    const before = await base.readStored()
    await base.other.caller.mutation(lifecycle, {
      input: {
        action: 'MAKE_UNAVAILABLE',
        campaignId: base.campaign.id,
        vehicleId: vehicle.id,
        expectedVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const unavailable = itemCommand(
      base,
      { kind: 'CHARACTER', characterId: base.character.id },
      { kind: 'VEHICLE', vehicleId: vehicle.id },
      itemId,
      before.character!.streamVersion,
      0
    )
    const unavailableSnapshot = await base.readStored()
    await expect(base.owner.caller.mutation(transfer, { input: unavailable })).rejects.toThrow(
      'unavailable'
    )
    expect(await base.readStored()).toEqual(unavailableSnapshot)
    await base.other.caller.mutation(lifecycle, {
      input: {
        action: 'RESTORE',
        campaignId: base.campaign.id,
        vehicleId: vehicle.id,
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const source = itemCommand(
      base,
      { kind: 'CHARACTER', characterId: base.character.id },
      { kind: 'VEHICLE', vehicleId: vehicle.id },
      itemId,
      before.character!.streamVersion,
      0
    )
    await base.owner.caller.mutation(transfer, { input: source })
    const loaded = await base.readStored()
    expect(loaded.items).toContainEqual(
      expect.objectContaining({ id: itemId, vehicleId: vehicle.id })
    )
    await expect(
      base.owner.caller.mutation(transfer, {
        input: itemCommand(
          base,
          { kind: 'VEHICLE', vehicleId: vehicle.id },
          { kind: 'CHARACTER', characterId: base.character.id },
          itemId,
          1,
          loaded.character!.streamVersion
        )
      })
    ).rejects.toThrow('Campaign owner')
    expect(await base.readStored()).toEqual(loaded)
    await base.other.caller.mutation(transfer, {
      input: itemCommand(
        base,
        { kind: 'VEHICLE', vehicleId: vehicle.id },
        { kind: 'CHARACTER', characterId: base.character.id },
        itemId,
        1,
        loaded.character!.streamVersion
      )
    })
    const returned = await base.readStored()
    expect(returned.items).toEqual([])
    expect(readCharacterRecord(returned.character!).state.equipment.inventory).toContainEqual(
      expect.objectContaining({ id: itemId, equipmentId: club.id, quantity: 1 })
    )
    expect(
      returned.inventories.find((inventory) => inventory.vehicleId === vehicle.id)?.version
    ).toBe(2)
  })
  it('allows a player to give an item to another assigned Character without reading their cargo, then replays the original receipt exactly', async () => {
    const base = await setup()
    const third = await addThirdAssignedPlayer(base)
    const itemId = idFor(61)
    await setCharacterState(base, (character) => ({
      ...character,
      state: {
        ...character.state,
        equipment: {
          ...character.state.equipment,
          inventory: [{ id: itemId, equipmentId: club.id, quantity: 1 }],
          equipped: [itemId],
          attuned: [itemId]
        }
      }
    }))
    const sourceBefore = await base.readStored()
    const destinationBefore = await readCharacter(base, third.characterId)
    if (!destinationBefore) throw new Error('Missing third-player Character.')
    const input = itemCommand(
      base,
      { kind: 'CHARACTER', characterId: base.character.id },
      { kind: 'CHARACTER', characterId: third.characterId },
      itemId,
      sourceBefore.character!.streamVersion,
      destinationBefore.streamVersion
    )
    const result = await base.owner.caller.mutation(transfer, { input })
    const sourceAfter = await base.readStored()
    const destinationAfter = await readCharacter(base, third.characterId)
    if (!destinationAfter) throw new Error('Missing third-player Character.')
    expect(
      readCharacterRecord(sourceAfter.character!).state.equipment.inventory
    ).not.toContainEqual(expect.objectContaining({ id: itemId }))
    expect(readCharacterRecord(sourceAfter.character!).state.equipment.equipped).not.toContain(
      itemId
    )
    expect(readCharacterRecord(sourceAfter.character!).state.equipment.attuned).not.toContain(
      itemId
    )
    expect(readCharacterRecord(destinationAfter).state.equipment.inventory).toContainEqual(
      expect.objectContaining({ id: itemId, equipmentId: club.id, quantity: 1 })
    )
    expect(readCharacterRecord(destinationAfter).state.equipment.equipped).not.toContain(itemId)
    expect(readCharacterRecord(destinationAfter).state.equipment.attuned).not.toContain(itemId)
    expect(destinationAfter.streamVersion).toBe(destinationBefore.streamVersion + 1)
    const replaySnapshot = await base.readStored()
    expect(await base.owner.caller.mutation(transfer, { input })).toEqual(result)
    expect(await base.readStored()).toEqual(replaySnapshot)
    await expect(
      base.owner.caller.mutation(transfer, { input: { ...input, amount: 2 } })
    ).rejects.toThrow('different input')
    await expect(
      base.owner.caller.query(ownerVersion, {
        input: {
          campaignId: base.campaign.id,
          owner: { kind: 'CHARACTER', characterId: third.characterId }
        }
      })
    ).rejects.toThrow('assigned player')
  })
  it('rejects destination item and group ID collisions without changing either custody owner', async () => {
    const itemCollision = await setup()
    const itemId = idFor(71)
    await setCharacterState(itemCollision, (character) => ({
      ...character,
      state: {
        ...character.state,
        equipment: {
          ...character.state.equipment,
          inventory: [{ id: itemId, equipmentId: club.id, quantity: 1 }]
        }
      }
    }))
    await itemCollision.t.run(async (ctx) => {
      await ctx.db.insert('campaignPartyInventories', {
        campaignId: itemCollision.campaign.id,
        version: 0
      })
      await ctx.db.insert('campaignPartyItems', {
        campaignId: itemCollision.campaign.id,
        id: itemId,
        equipmentId: club.id,
        quantity: 1,
        containerId: null
      })
    })
    const itemBefore = await itemCollision.readStored()
    await expect(
      itemCollision.owner.caller.mutation(transfer, {
        input: itemCommand(
          itemCollision,
          { kind: 'CHARACTER', characterId: itemCollision.character.id },
          { kind: 'CAMPAIGN', campaignId: itemCollision.campaign.id },
          itemId,
          itemBefore.character!.streamVersion,
          0
        )
      })
    ).rejects.toThrow('already holds this item')
    expect(await itemCollision.readStored()).toEqual(itemBefore)

    const groupCollision = await setup()
    const bagId = idFor(72)
    const groupId = idFor(73)
    await setCharacterState(groupCollision, (character) => ({
      ...character,
      state: {
        ...character.state,
        equipment: {
          ...character.state.equipment,
          inventory: [{ id: bagId, equipmentId: backpack.id, quantity: 1 }]
        },
        currency: [{ id: groupId, containerId: bagId, currencies: [] }]
      }
    }))
    await groupCollision.t.run(async (ctx) => {
      await ctx.db.insert('campaignPartyInventories', {
        campaignId: groupCollision.campaign.id,
        version: 0
      })
      await ctx.db.insert('campaignPartyCurrencyGroups', {
        campaignId: groupCollision.campaign.id,
        id: groupId,
        containerId: null
      })
    })
    const groupBefore = await groupCollision.readStored()
    await expect(
      groupCollision.owner.caller.mutation(transfer, {
        input: itemCommand(
          groupCollision,
          { kind: 'CHARACTER', characterId: groupCollision.character.id },
          { kind: 'CAMPAIGN', campaignId: groupCollision.campaign.id },
          bagId,
          groupBefore.character!.streamVersion,
          0
        )
      })
    ).rejects.toThrow('currency group')
    expect(await groupCollision.readStored()).toEqual(groupBefore)
  })

  it('rejects a selected Character cycle and duplicate Shared full-currency identities without writes', async () => {
    const cyclic = await setup()
    const bagId = idFor(81)
    const pouchId = idFor(82)
    await setCharacterState(cyclic, (character) => ({
      ...character,
      state: {
        ...character.state,
        equipment: {
          ...character.state.equipment,
          inventory: [
            { id: bagId, equipmentId: backpack.id, quantity: 1, containerId: pouchId },
            { id: pouchId, equipmentId: pouch.id, quantity: 1, containerId: bagId }
          ]
        }
      }
    }))
    const cycleBefore = await cyclic.readStored()
    await expect(
      cyclic.owner.caller.mutation(transfer, {
        input: itemCommand(
          cyclic,
          { kind: 'CHARACTER', characterId: cyclic.character.id },
          { kind: 'CAMPAIGN', campaignId: cyclic.campaign.id },
          bagId,
          cycleBefore.character!.streamVersion,
          0
        )
      })
    ).rejects.toThrow('cycle')
    expect(await cyclic.readStored()).toEqual(cycleBefore)

    const duplicate = await setup()
    const sharedBagId = idFor(83)
    const sharedGroupId = idFor(84)
    const denominationId = srdSystemRecord.currencies[0]!.id
    await duplicate.t.run(async (ctx) => {
      await ctx.db.insert('campaignPartyInventories', {
        campaignId: duplicate.campaign.id,
        version: 0
      })
      await ctx.db.insert('campaignPartyItems', {
        campaignId: duplicate.campaign.id,
        id: sharedBagId,
        equipmentId: backpack.id,
        quantity: 1,
        containerId: null
      })
      await ctx.db.insert('campaignPartyCurrencyGroups', {
        campaignId: duplicate.campaign.id,
        id: sharedGroupId,
        containerId: sharedBagId
      })
      for (const id of [idFor(85), idFor(86)]) {
        await ctx.db.insert('campaignPartyCurrencies', {
          campaignId: duplicate.campaign.id,
          id,
          groupId: sharedGroupId,
          denominationId,
          amount: 1,
          containerId: sharedBagId
        })
      }
    })
    const duplicateBefore = await duplicate.readStored()
    await expect(
      duplicate.owner.caller.mutation(transfer, {
        input: itemCommand(
          duplicate,
          { kind: 'CAMPAIGN', campaignId: duplicate.campaign.id },
          { kind: 'CHARACTER', characterId: duplicate.character.id },
          sharedBagId,
          0,
          duplicateBefore.character!.streamVersion
        )
      })
    ).rejects.toThrow('duplicate balances')
    expect(await duplicate.readStored()).toEqual(duplicateBefore)
  })
})
