import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules'
import assert from 'node:assert/strict'
import type { FunctionReturnType } from 'convex/server'
import type {
  CampaignPartyInventoryMutationInput,
  InventoryOwnerRefDto,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import { inventoryItemDtoSchema } from '@artificer-toolkit/schema/api/campaignInventory'
import { decodeCampaignInventoryAuditPage } from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { campaignContentRemovalReceiptDtoSchema } from '@artificer-toolkit/schema/api/campaignCore'
import { decodeCampaignEventPage } from '@artificer-toolkit/schema/api/campaignEventTransport'
import type { CampaignEventDto } from '@artificer-toolkit/schema/api/campaignLiveState'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { api } from '../convex/_generated/api.js'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'
import type { DevelopmentClient } from './developmentClient'

type Currency = FunctionReturnType<typeof api.campaigns.partyInventory.currencies>['page'][number]
type Item = FunctionReturnType<typeof api.campaigns.partyInventory.items>['page'][number]
type SharedCommand =
  | Omit<
      Extract<CampaignPartyInventoryMutationInput, { kind: 'ITEM_ADD' }>,
      'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey'
    >
  | Omit<
      Extract<CampaignPartyInventoryMutationInput, { kind: 'CURRENCY_ADJUST' }>,
      'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey'
    >

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
      assert.deepEqual(current, fence, 'Every inventory page must retain the same owner and fence.')
    else fence = current
    return result
  })
  assert.ok(fence)
  return { ...fence, page }
}

const sorted = <T>(rows: T[]) =>
  [...rows].sort((left, right) =>
    canonicalizeRuleDocument(left).localeCompare(canonicalizeRuleDocument(right))
  )
function currencyKey(
  currency: {
    kind?: 'RULESET' | 'CAMPAIGN'
    campaignCurrencySystemId?: string
  },
  denominationId: string
) {
  const kind = currency.kind ?? 'RULESET'
  if (kind === 'CAMPAIGN') assert.ok(currency.campaignCurrencySystemId)
  else assert.equal(currency.campaignCurrencySystemId, undefined)
  return JSON.stringify([kind, currency.campaignCurrencySystemId ?? null, denominationId])
}
function exactAmount(amount: number) {
  assert.ok(Number.isSafeInteger(amount) && amount >= 0)
  return BigInt(amount)
}
function eventPayload(event: CampaignEventDto) {
  assert.ok(event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload))
  return event.payload
}

/** Public authored deletion must retain acquired containers and atomically evacuate every affected cart. */
export async function verifyCampaignAuthoredCustodyDeletion(
  cohort: CampaignCustodyCohort,
  anonymous: DevelopmentClient
) {
  assert.equal(fighter.category, 'BASE')
  const { owner, players, campaignId, characterIds } = cohort
  const player = players[0].client
  const denominationId = fighter.startingGold.currencyId
  const sources: Array<{
    subjectKind: 'EQUIPMENT' | 'VEHICLE'
    subjectId: string
  }> = []
  const pagination = (cursor: string | null) => ({
    campaignId,
    paginationOpts: { cursor, numItems: 2 }
  })
  const readItems = (vehicleId?: string) =>
    collectInventory((cursor) =>
      vehicleId === undefined
        ? owner.query(api.campaigns.partyInventory.items, pagination(cursor))
        : owner.query(api.campaigns.vehicleInventory.items, {
            ...pagination(cursor),
            vehicleId
          })
    )
  const readCurrencies = (vehicleId?: string) =>
    collectInventory((cursor) =>
      vehicleId === undefined
        ? owner.query(api.campaigns.partyInventory.currencies, pagination(cursor))
        : owner.query(api.campaigns.vehicleInventory.currencies, {
            ...pagination(cursor),
            vehicleId
          })
    )
  const readHistory = async (client: DevelopmentClient, characterId: string) => {
    const events: CampaignEventDto[] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    while (true) {
      const result = decodeCampaignEventPage(
        await client.query(api.campaigns.events.list, {
          campaignId,
          characterId,
          limit: 8,
          ...(cursor === undefined ? {} : { cursor })
        })
      )
      events.push(...result.events)
      if (result.nextCursor === null) {
        assert.equal(new Set(events.map((event) => event.id)).size, events.length)
        return events
      }
      assert.ok(result.nextCursor)
      assert.equal(cursors.has(result.nextCursor), false, 'History pagination must advance.')
      cursors.add(result.nextCursor)
      cursor = result.nextCursor
    }
  }
  const readAudit = async () => {
    const events: FunctionReturnType<typeof api.campaigns.inventoryAudit.list>['events'] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    while (true) {
      const result = await owner.query(api.campaigns.inventoryAudit.list, {
        campaignId,
        limit: 8,
        ...(cursor === undefined ? {} : { cursor })
      })
      events.push(...result.events)
      if (result.nextCursor === null) return events
      assert.ok(result.nextCursor)
      assert.equal(cursors.has(result.nextCursor), false, 'Audit pagination must advance.')
      cursors.add(result.nextCursor)
      cursor = result.nextCursor
    }
  }
  const read = async () => {
    const [
      campaign,
      vehicles,
      systems,
      shares,
      partyItems,
      partyCurrencies,
      characters,
      history,
      playerHistory,
      audit,
      content
    ] = await Promise.all([
      owner.query(api.campaigns.queries.get, { id: campaignId }),
      collectPages((cursor) => owner.query(api.campaigns.vehicles.list, pagination(cursor))),
      collectPages((cursor) => owner.query(api.campaigns.currencySystems.list, pagination(cursor))),
      collectPages((cursor) => owner.query(api.campaigns.contentShares.list, pagination(cursor))),
      readItems(),
      readCurrencies(),
      Promise.all(
        characterIds.map(async (id, index) => {
          const author = players[index]
          assert.ok(author)
          const [character, sheet, fence] = await Promise.all([
            author.client.query(api.characters.builder.activeCharacter, { id }),
            author.client.query(api.characters.sheet.get, { id }),
            author.client.query(api.campaigns.inventoryOwners.version, {
              input: {
                campaignId,
                owner: { kind: 'CHARACTER', characterId: id }
              }
            })
          ])
          assert.ok(character && sheet)
          assert.equal(sheet.meta.viewer, 'CHARACTER_OWNER')
          assert.equal(sheet.meta.streamVersion, fence.version)
          return { id, character, sheet, fence }
        })
      ),
      readHistory(owner, characterIds[0]),
      Promise.all(players.map((author, index) => readHistory(author.client, characterIds[index]!))),
      readAudit(),
      Promise.all(
        sources.map(async (source) => ({
          ...source,
          active: await owner.query(api.content.details.get, {
            subjectKind: source.subjectKind,
            id: source.subjectId,
            view: 'active'
          }),
          draft: await owner.query(api.content.drafts.get, source)
        }))
      )
    ])
    assert.ok(campaign)
    const shared = async (vehicleId?: string) => {
      const [items, currencies, fence] = await Promise.all([
        vehicleId === undefined ? Promise.resolve(partyItems) : readItems(vehicleId),
        vehicleId === undefined ? Promise.resolve(partyCurrencies) : readCurrencies(vehicleId),
        owner.query(api.campaigns.inventoryOwners.version, {
          input: {
            campaignId,
            owner:
              vehicleId === undefined
                ? { kind: 'CAMPAIGN', campaignId }
                : { kind: 'VEHICLE', vehicleId }
          }
        })
      ])
      assert.equal(items.version, currencies.version)
      assert.equal(items.version, fence.version)
      assert.equal(new Set(items.page.map((item) => item.id)).size, items.page.length)
      for (const item of items.page)
        assert.deepEqual(Object.keys(item).sort(), [
          'containerId',
          'id',
          'isContainer',
          'label',
          'quantity'
        ])
      return { items, currencies, fence }
    }
    const party = await shared()
    const cargo = await Promise.all(
      vehicles.map(async (vehicle) => ({
        id: vehicle.id,
        ...(await shared(vehicle.id))
      }))
    )
    return {
      campaign,
      vehicles,
      systems,
      shares,
      party,
      cargo,
      characters,
      history,
      playerHistory,
      audit,
      content
    }
  }
  type Snapshot = Awaited<ReturnType<typeof read>>
  const totals = (snapshot: Snapshot) => {
    const sums = new Map<string, bigint>()
    const add = (key: string, amount: number) =>
      sums.set(key, (sums.get(key) ?? 0n) + exactAmount(amount))
    for (const inventory of [snapshot.party, ...snapshot.cargo])
      for (const currency of inventory.currencies.page)
        add(currencyKey(currency, currency.denominationId), currency.amount)
    for (const entry of snapshot.characters)
      for (const group of entry.character.state.currency)
        for (const currency of group.currencies)
          add(currencyKey(currency, currency.currencyId), currency.amount)
    return [...sums].sort(([left], [right]) => left.localeCompare(right))
  }
  const initial = await read()
  assert.ok(initial.vehicles.length + 3 <= 4)
  assert.ok(initial.systems.length + 1 <= 3)
  assert.ok(
    initial.systems.reduce((count, system) => count + system.denominations.length, 0) + 1 <= 8
  )
  assert.ok(
    initial.audit.length + 40 <= 100,
    'This standalone proof must fit the existing event bound.'
  )
  const publishSource = async (subjectKind: 'EQUIPMENT' | 'VEHICLE', subjectId: string) => {
    const duplicated = await owner.mutation(api.content.drafts.duplicate, {
      subjectKind,
      subjectId
    })
    const label = `Custody deletion ${subjectKind.toLowerCase()} ${duplicated.subjectId}`
    const saved = await owner.mutation(api.content.drafts.save, {
      subjectKind,
      subjectId: duplicated.subjectId,
      systemId: duplicated.systemId,
      label,
      payload: duplicated.payload
    })
    assert.ok(saved.updatedAt)
    const publication = await owner.mutation(api.content.publication.publishDraft, {
      subjectKind,
      subjectId: saved.subjectId,
      expectedDraftUpdatedAt: saved.updatedAt
    })
    await owner.mutation(api.campaigns.contentShares.share, {
      campaignId,
      subjectKind,
      subjectId: publication.subjectId
    })
    // Keep an author's real working draft so active deletion must preserve it.
    const working = await owner.mutation(api.content.drafts.save, {
      subjectKind,
      subjectId: saved.subjectId,
      systemId: saved.systemId,
      label,
      payload: saved.payload
    })
    assert.equal(working.draftState, 'ACTIVE_WITH_DRAFT')
    sources.push({ subjectKind, subjectId: publication.subjectId })
    return publication.subjectId
  }
  const equipmentId = await publishSource('EQUIPMENT', backpack.id)
  const vehicleDefinitionId = await publishSource('VEHICLE', cart.id)
  const system = await owner.mutation(api.campaigns.currencySystems.save, {
    campaignId,
    label: 'Authored deletion qualified coins',
    isReference: !initial.systems.some((entry) => entry.isReference),
    denominations: [
      {
        id: denominationId,
        label: 'Custody coins',
        abbreviation: 'cc',
        scaleInReference: 1
      }
    ]
  })
  const vehicles = []
  for (const [index, definition] of [vehicleDefinitionId, vehicleDefinitionId, cart.id].entries())
    vehicles.push(
      await owner.mutation(api.campaigns.vehicles.create, {
        campaignId,
        vehicleDefinitionId: definition,
        label: `Authored deletion cart ${index + 1}`
      })
    )
  const [availableSource, unavailableSource, unrelated] = vehicles
  assert.ok(availableSource && unavailableSource && unrelated)
  assert.equal(new Set(vehicles.map((vehicle) => vehicle.id)).size, 3)
  const ownerRef = (vehicleId?: string): InventoryOwnerRefDto =>
    vehicleId === undefined ? { kind: 'CAMPAIGN', campaignId } : { kind: 'VEHICLE', vehicleId }
  const mutateShared = async (fields: SharedCommand, vehicleId?: string) => {
    const beforeItems = await readItems(vehicleId)
    const beforeCurrencies = await readCurrencies(vehicleId)
    const fence = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: ownerRef(vehicleId) }
    })
    assert.equal(fence.version, beforeItems.version)
    assert.equal(fence.version, beforeCurrencies.version)
    const input: CampaignPartyInventoryMutationInput = {
      ...fields,
      campaignId,
      ...(vehicleId === undefined ? {} : { vehicleId }),
      expectedOwnerVersion: fence.version,
      idempotencyKey: crypto.randomUUID()
    }
    await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input
    })
    const [items, currencies] = await Promise.all([readItems(vehicleId), readCurrencies(vehicleId)])
    assert.equal(items.version, fence.version + 1)
    assert.equal(currencies.version, fence.version + 1)
    for (const item of beforeItems.page)
      assert.deepEqual(
        items.page.find((row) => row.id === item.id),
        item
      )
    if (fields.kind === 'ITEM_ADD') {
      assert.deepEqual(currencies.page, beforeCurrencies.page)
      const added = items.page.filter((row) => !beforeItems.page.some((old) => old.id === row.id))
      assert.equal(added.length, 1)
      const item = added[0]
      assert.ok(item)
      assert.equal(item.containerId, fields.containerId ?? null)
      assert.equal(item.quantity, fields.quantity)
      return item
    }
    assert.deepEqual(items.page, beforeItems.page)
    const key = JSON.stringify([
      fields.campaignCurrencySystemId === null ? 'RULESET' : 'CAMPAIGN',
      fields.campaignCurrencySystemId,
      fields.denominationId
    ])
    const balance = (rows: Currency[]) =>
      rows
        .filter(
          (row) =>
            currencyKey(row, row.denominationId) === key &&
            row.containerId === (fields.containerId ?? null)
        )
        .reduce((sum, row) => sum + exactAmount(row.amount), 0n)
    assert.equal(balance(currencies.page), balance(beforeCurrencies.page) + BigInt(fields.amount))
    assert.deepEqual(
      currencies.page.filter(
        (row) =>
          currencyKey(row, row.denominationId) !== key ||
          row.containerId !== (fields.containerId ?? null)
      ),
      beforeCurrencies.page.filter(
        (row) =>
          currencyKey(row, row.denominationId) !== key ||
          row.containerId !== (fields.containerId ?? null)
      )
    )
    return null
  }
  const bags: Array<{ item: Item; vehicleId?: string }> = []
  for (const vehicleId of [undefined, ...vehicles.map((vehicle) => vehicle.id)]) {
    const item = await mutateShared({ kind: 'ITEM_ADD', equipmentId, quantity: 1 }, vehicleId)
    assert.ok(item?.isContainer)
    bags.push({ item, ...(vehicleId === undefined ? {} : { vehicleId }) })
    await mutateShared(
      {
        kind: 'ITEM_ADD',
        equipmentId: club.id,
        quantity: 1,
        containerId: item.id
      },
      vehicleId
    )
    for (const campaignCurrencySystemId of [null, system.id])
      for (const containerId of [item.id, null])
        await mutateShared(
          {
            kind: 'CURRENCY_ADJUST',
            denominationId,
            campaignCurrencySystemId,
            amount:
              campaignCurrencySystemId === null
                ? containerId === null
                  ? 7
                  : 3
                : containerId === null
                  ? 11
                  : 5,
            containerId
          },
          vehicleId
        )
  }
  const executeCharacter = async (
    fields:
      | Omit<
          Extract<CharacterSheetCommandInputDto, { type: 'ADD_INVENTORY_ITEM' }>,
          'commandId' | 'expectedVersion'
        >
      | Omit<
          Extract<CharacterSheetCommandInputDto, { type: 'ADJUST_CURRENCY' }>,
          'commandId' | 'expectedVersion'
        >
  ) => {
    const sheet = await player.query(api.characters.sheet.get, {
      id: characterIds[0]
    })
    assert.ok(sheet)
    await player.mutation(api.characters.sheetCommands.execute, {
      id: characterIds[0],
      command: {
        ...fields,
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion
      }
    })
    const next = await player.query(api.characters.sheet.get, {
      id: characterIds[0]
    })
    assert.ok(next)
    assert.equal(next.meta.streamVersion, sheet.meta.streamVersion + 1)
  }
  await executeCharacter({
    type: 'ADD_INVENTORY_ITEM',
    equipmentId,
    quantity: 1,
    customName: 'Acquired authored deletion pack',
    notes: 'Private acquired custody notes.'
  })
  const acquired = await read()
  const own = acquired.characters.find((entry) => entry.id === characterIds[0])
  assert.ok(own)
  const held = own.character.state.equipment.inventory.find(
    (item) => item.equipmentId === equipmentId
  )
  assert.ok(held?.retainedRulesJson)
  const rawRules = acquiredEquipmentRulesSchema.parse(JSON.parse(held.retainedRulesJson))
  assert.equal(rawRules.equipmentId, equipmentId)
  assert.equal(rawRules.systemId, fighter.systemId)
  const pinnedSource = rawRules.sources.find(
    (source) => source.subjectKind === 'EQUIPMENT' && source.subjectId === equipmentId
  )
  assert.ok(pinnedSource)
  assert.ok(pinnedSource.compilation.projectionJson)
  assert.ok(pinnedSource.presentation.label)
  assert.equal(held.notes, 'Private acquired custody notes.')
  const transferredGroupIds = new Map<string, string[]>()
  for (const vehicleId of [availableSource.id, unavailableSource.id]) {
    const previous = await player.query(api.characters.builder.activeCharacter, {
      id: characterIds[0]
    })
    assert.ok(previous)
    await executeCharacter({
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: backpack.id,
      quantity: 1,
      customName: 'Physical group provenance pack',
      notes: 'Private transferred physical pack notes.'
    })
    const added = await player.query(api.characters.builder.activeCharacter, {
      id: characterIds[0]
    })
    assert.ok(added)
    const newItems = added.state.equipment.inventory.filter(
      (item) => !previous.state.equipment.inventory.some((old) => old.id === item.id)
    )
    assert.equal(newItems.length, 1)
    const unit = newItems[0]
    assert.ok(unit)
    assert.equal(unit.equipmentId, backpack.id)
    await executeCharacter({
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: club.id,
      quantity: 1,
      containerId: unit.id,
      notes: 'Private transferred child notes.'
    })
    await executeCharacter({
      type: 'ADJUST_CURRENCY',
      kind: 'RULESET',
      currencyId: denominationId,
      amount: 13,
      containerId: unit.id
    })
    await executeCharacter({
      type: 'ADJUST_CURRENCY',
      kind: 'CAMPAIGN',
      campaignCurrencySystemId: system.id,
      currencyId: denominationId,
      amount: 17,
      containerId: unit.id
    })
    const beforeTransfer = await read()
    const source = beforeTransfer.characters.find((entry) => entry.id === characterIds[0])
    const destination = beforeTransfer.cargo.find((entry) => entry.id === vehicleId)
    assert.ok(source && destination)
    const sourceContainers = source.sheet.inventory.containers
    assert.ok(sourceContainers && sourceContainers.some((container) => container.id === unit.id))
    const movedItems = source.character.state.equipment.inventory.filter(
      (item) => item.id === unit.id || item.containerId === unit.id
    )
    assert.equal(movedItems.length, 2)
    assert.equal(
      movedItems.filter(
        (item) =>
          item.id !== unit.id && item.equipmentId === club.id && item.containerId === unit.id
      ).length,
      1
    )
    const movedIds = new Set(movedItems.map((item) => item.id))
    const groups = source.character.state.currency.filter(
      (group) => group.containerId !== undefined && movedIds.has(group.containerId)
    )
    const groupIds = groups.map((group) => group.id).sort()
    assert.ok(
      groupIds.length > 0,
      'Each source cart must receive real Character currency-group provenance.'
    )
    assert.equal(new Set(groupIds).size, groupIds.length)
    assert.deepEqual(
      sorted(
        groups.flatMap((group) =>
          group.currencies.map((currency) => ({
            key: currencyKey(currency, currency.currencyId),
            amount: currency.amount
          }))
        )
      ),
      sorted([
        { key: JSON.stringify(['RULESET', null, denominationId]), amount: 13 },
        { key: JSON.stringify(['CAMPAIGN', system.id, denominationId]), amount: 17 }
      ])
    )
    for (const ids of transferredGroupIds.values())
      for (const id of groupIds)
        assert.equal(
          ids.includes(id),
          false,
          'The two source carts must receive distinct original groups.'
        )
    for (const item of movedItems) {
      assert.ok(item.retainedRulesJson)
      const rules = acquiredEquipmentRulesSchema.parse(JSON.parse(item.retainedRulesJson))
      assert.equal(rules.equipmentId, item.equipmentId)
      assert.equal(rules.systemId, fighter.systemId)
    }
    const sourceRef: InventoryOwnerRefDto = { kind: 'CHARACTER', characterId: characterIds[0] }
    const destinationRef: InventoryOwnerRefDto = { kind: 'VEHICLE', vehicleId }
    const fences = await player.query(api.campaigns.inventoryOwners.transferVersions, {
      input: { campaignId, source: sourceRef, destination: destinationRef }
    })
    assert.equal(fences.sourceVersion, source.sheet.meta.streamVersion)
    assert.equal(fences.destinationVersion, destination.items.version)
    const input: Extract<TransferCampaignInventoryInput, { kind: 'ITEM' }> = {
      kind: 'ITEM',
      campaignId,
      source: sourceRef,
      destination: destinationRef,
      itemId: unit.id,
      amount: 1,
      expectedSourceVersion: fences.sourceVersion,
      expectedDestinationVersion: fences.destinationVersion,
      idempotencyKey: crypto.randomUUID()
    }
    const result = await player.mutation(api.campaigns.inventoryTransfers.transfer, { input })
    const afterTransfer = await read()
    const remaining = afterTransfer.characters.find((entry) => entry.id === characterIds[0])
    const received = afterTransfer.cargo.find((entry) => entry.id === vehicleId)
    assert.ok(remaining && received)
    const expectedCharacter = structuredClone(source.character)
    expectedCharacter.state.equipment.inventory =
      expectedCharacter.state.equipment.inventory.filter((item) => !movedIds.has(item.id))
    expectedCharacter.state.currency = expectedCharacter.state.currency.filter(
      (group) => !groupIds.includes(group.id)
    )
    assert.deepEqual(
      remaining.character,
      expectedCharacter,
      'Whole-unit transfer must remove only those original items and groups from raw private Character state.'
    )
    assert.deepEqual(remaining.sheet.notes, source.sheet.notes)
    assert.deepEqual(
      remaining.sheet.inventory.items,
      source.sheet.inventory.items.filter((item) => !movedIds.has(item.id))
    )
    assert.deepEqual(
      remaining.sheet.inventory.currencies,
      source.sheet.inventory.currencies.filter(
        (currency) => currency.containerId === undefined || !movedIds.has(currency.containerId)
      )
    )
    assert.deepEqual(
      remaining.sheet.inventory.containers,
      sourceContainers.filter((container) => !movedIds.has(container.id))
    )
    const expectedItems = movedItems.map((item) => {
      const presented = source.sheet.inventory.items.find((row) => row.id === item.id)
      assert.ok(presented)
      return inventoryItemDtoSchema.parse({
        id: item.id,
        label: presented.label,
        quantity: item.quantity,
        containerId: item.containerId ?? null,
        isContainer: sourceContainers.some((container) => container.id === item.id)
      })
    })
    assert.deepEqual(
      sorted(received.items.page),
      sorted([...destination.items.page, ...expectedItems]),
      'Transferred parent and child IDs and complete public placement must remain literal.'
    )
    const expectedCoins = groups.flatMap((group) =>
      group.currencies.map((currency) => {
        const template = destination.currencies.page.find(
          (row) =>
            currencyKey(row, row.denominationId) === currencyKey(currency, currency.currencyId)
        )
        assert.ok(
          template,
          'Each namespace already has authoritative presented denomination metadata.'
        )
        return { ...template, amount: currency.amount, containerId: group.containerId ?? null }
      })
    )
    assert.deepEqual(
      sorted(received.currencies.page),
      sorted([...destination.currencies.page, ...expectedCoins]),
      'Original group placement and both qualified balance rows must settle exactly.'
    )
    assert.equal(remaining.sheet.meta.streamVersion, fences.sourceVersion + 1)
    assert.deepEqual(remaining.fence, { ...source.fence, version: source.fence.version + 1 })
    assert.equal(received.items.version, fences.destinationVersion + 1)
    assert.equal(received.currencies.version, fences.destinationVersion + 1)
    assert.deepEqual(received.fence, {
      ...destination.fence,
      version: destination.fence.version + 1
    })
    assert.deepEqual(
      afterTransfer.characters.filter((entry) => entry.id !== characterIds[0]),
      beforeTransfer.characters.filter((entry) => entry.id !== characterIds[0])
    )
    assert.deepEqual(
      afterTransfer.cargo.filter((entry) => entry.id !== vehicleId),
      beforeTransfer.cargo.filter((entry) => entry.id !== vehicleId)
    )
    assert.deepEqual(afterTransfer.party, beforeTransfer.party)
    assert.deepEqual(afterTransfer.campaign, beforeTransfer.campaign)
    assert.deepEqual(afterTransfer.vehicles, beforeTransfer.vehicles)
    assert.deepEqual(afterTransfer.systems, beforeTransfer.systems)
    assert.deepEqual(afterTransfer.shares, beforeTransfer.shares)
    assert.deepEqual(afterTransfer.content, beforeTransfer.content)
    assert.deepEqual(afterTransfer.playerHistory, beforeTransfer.playerHistory)
    assert.deepEqual(totals(afterTransfer), totals(beforeTransfer))
    assert.equal(afterTransfer.audit.length, beforeTransfer.audit.length + 1)
    assert.deepEqual(
      afterTransfer.audit.filter((event) => event.id !== result.eventId),
      beforeTransfer.audit
    )
    const events = afterTransfer.audit.filter((event) => event.id === result.eventId)
    assert.equal(events.length, 1)
    const event = events[0]
    assert.ok(event)
    assert.equal(event.kind, 'CUSTODY_TRANSFER')
    assert.equal(event.actorUserId, cohort.playerUserIds[0])
    assert.equal(event.subjectCharacterId, characterIds[0])
    assert.equal(event.visibility, 'OWNER')
    const payload = decodeCampaignInventoryAuditPage({ events: [event], nextCursor: null })
      .events[0]?.payload
    assert.deepEqual(payload, {
      kind: 'ITEM',
      action: 'CUSTODY_TRANSFER',
      source: sourceRef,
      destination: destinationRef,
      custodyContext: { sourceOwnerId: characterIds[0], destinationOwnerId: vehicleId },
      itemId: unit.id,
      itemLabel: unit.customName,
      amount: 1,
      beforeQuantity: 1,
      afterSourceQuantity: 0,
      afterDestinationQuantity: 1
    })
    assert.deepEqual(
      await player.query(api.campaigns.inventoryOwners.transferVersions, {
        input: { campaignId, source: sourceRef, destination: destinationRef }
      }),
      { sourceVersion: fences.sourceVersion + 1, destinationVersion: fences.destinationVersion + 1 }
    )
    assert.deepEqual(
      await player.mutation(api.campaigns.inventoryTransfers.transfer, { input }),
      result
    )
    assert.deepEqual(
      await read(),
      afterTransfer,
      'Exact filled-unit transfer replay must not write any fixture state.'
    )
    transferredGroupIds.set(vehicleId, groupIds)
  }
  assert.equal(transferredGroupIds.size, 2)
  const beforeUnavailable = await read()
  const unavailableMetadata = beforeUnavailable.vehicles.find(
    (vehicle) => vehicle.id === unavailableSource.id
  )
  assert.ok(unavailableMetadata)
  await owner.mutation(api.campaigns.vehicles.lifecycle, {
    input: {
      campaignId,
      vehicleId: unavailableSource.id,
      action: 'MAKE_UNAVAILABLE',
      expectedVersion: unavailableMetadata.version,
      idempotencyKey: crypto.randomUUID()
    }
  })
  const before = await read()
  assert.equal(
    before.vehicles.find((vehicle) => vehicle.id === unavailableSource.id)?.availability,
    'UNAVAILABLE'
  )
  assert.deepEqual(
    before.cargo,
    beforeUnavailable.cargo,
    'Availability changes must preserve DM cargo access and literal cargo.'
  )
  for (const author of players) {
    for (const reference of [
      api.campaigns.vehicleInventory.items,
      api.campaigns.vehicleInventory.currencies
    ])
      await assert.rejects(
        () =>
          author.client.query(reference, {
            ...pagination(null),
            vehicleId: unavailableSource.id
          }),
        /unavailable|permission|authorized/i
      )
    const accessibleItems = await collectInventory((cursor) =>
      author.client.query(api.campaigns.vehicleInventory.items, {
        ...pagination(cursor),
        vehicleId: availableSource.id
      })
    )
    const accessibleCurrencies = await collectInventory((cursor) =>
      author.client.query(api.campaigns.vehicleInventory.currencies, {
        ...pagination(cursor),
        vehicleId: availableSource.id
      })
    )
    const dmCargo = before.cargo.find((entry) => entry.id === availableSource.id)
    assert.ok(dmCargo)
    assert.deepEqual(accessibleItems, dmCargo.items)
    assert.deepEqual(accessibleCurrencies, dmCargo.currencies)
  }
  const refuseDelete = async (
    client: DevelopmentClient,
    subjectKind: 'EQUIPMENT' | 'VEHICLE',
    subjectId: string
  ) => {
    const snapshot = await read()
    await assert.rejects(
      () =>
        client.mutation(api.content.deletion.deleteActive, {
          subjectKind,
          subjectId
        }),
      /deleted|identity|authenticated|authorized|permission/i
    )
    assert.deepEqual(
      await read(),
      snapshot,
      'Unauthorized root deletion must preserve the complete fixture snapshot.'
    )
  }
  for (const source of sources) {
    await refuseDelete(player, source.subjectKind, source.subjectId)
    await refuseDelete(anonymous, source.subjectKind, source.subjectId)
  }
  await refuseDelete(owner, 'EQUIPMENT', backpack.id)
  await refuseDelete(owner, 'VEHICLE', cart.id)
  const assertCampaignAdvance = (previous: Snapshot, next: Snapshot) => {
    const {
      version: previousVersion,
      updatedAt: previousUpdatedAt,
      ...previousCampaign
    } = previous.campaign
    const { version: nextVersion, updatedAt: nextUpdatedAt, ...nextCampaign } = next.campaign
    assert.deepEqual(nextCampaign, previousCampaign)
    assert.equal(nextVersion, previousVersion + 1)
    assert.ok(Date.parse(nextUpdatedAt) > Date.parse(previousUpdatedAt))
  }
  const assertDraftRetained = (previous: Snapshot, next: Snapshot, subjectId: string) => {
    const old = previous.content.find((entry) => entry.subjectId === subjectId)
    const current = next.content.find((entry) => entry.subjectId === subjectId)
    assert.ok(old?.active && old.draft && current?.draft)
    assert.equal(current.active, null)
    assert.equal(current.draft.draftState, 'DRAFT_ONLY')
    assert.equal(current.draft.baseActiveUpdatedAt, null)
    assert.ok(current.draft.updatedAt && old.draft.updatedAt)
    assert.ok(Date.parse(current.draft.updatedAt) > Date.parse(old.draft.updatedAt))
    assert.deepEqual(
      {
        ...current.draft,
        draftState: old.draft.draftState,
        baseActiveUpdatedAt: old.draft.baseActiveUpdatedAt,
        updatedAt: old.draft.updatedAt
      },
      old.draft
    )
  }
  const assertRemoval = (
    previous: Snapshot,
    next: Snapshot,
    subjectKind: 'EQUIPMENT' | 'VEHICLE',
    subjectId: string
  ) => {
    for (const event of previous.history)
      assert.deepEqual(
        next.history.find((row) => row.id === event.id),
        event
      )
    const added = next.history.filter(
      (event) => !previous.history.some((old) => old.id === event.id)
    )
    const parents = added.filter((event) => event.type === 'CAMPAIGN_CONTENT_SHARES_REMOVED')
    assert.equal(parents.length, 1)
    const parent = parents[0]
    assert.ok(parent)
    assert.equal(parent.visibility, 'TABLE')
    assert.equal(parent.campaignId, campaignId)
    assert.equal(parent.subjectCharacterId, null)
    const payload = eventPayload(parent)
    assert.equal(payload.reason, 'AUTHORED_DELETED')
    const receipt = campaignContentRemovalReceiptDtoSchema.parse(payload.receipt)
    assert.equal(receipt.eventId, parent.id)
    assert.equal(receipt.campaignVersion, previous.campaign.version + 1)
    assert.deepEqual(receipt.removedShares, [
      { subjectKind, subjectId, sharedBy: cohort.ownerUserId }
    ])
    for (const events of next.playerHistory) {
      assert.deepEqual(
        events.find((event) => event.id === parent.id),
        parent
      )
      assert.equal(
        events.some((event) =>
          added.some(
            (ownerEvent) => ownerEvent.visibility === 'OWNER' && ownerEvent.id === event.id
          )
        ),
        false
      )
    }
    assert.deepEqual(
      next.audit,
      previous.audit,
      'Source-removal history is excluded from the public inventory-audit page.'
    )
    return { parent, receipt, added }
  }
  assert.equal(
    await owner.mutation(api.content.deletion.deleteActive, {
      subjectKind: 'EQUIPMENT',
      subjectId: equipmentId
    }),
    null
  )
  const retained = await read()
  assertCampaignAdvance(before, retained)
  assertDraftRetained(before, retained, equipmentId)
  assert.deepEqual(retained.party, before.party)
  assert.deepEqual(retained.cargo, before.cargo)
  assert.deepEqual(retained.vehicles, before.vehicles)
  assert.deepEqual(retained.systems, before.systems)
  assert.deepEqual(
    retained.shares,
    before.shares.filter((share) => share.subjectId !== equipmentId)
  )
  for (const entry of before.characters) {
    const next = retained.characters.find((candidate) => candidate.id === entry.id)
    assert.ok(next)
    assert.deepEqual(
      next.character,
      entry.character,
      'Equipment source deletion must preserve raw acquired state and private fields literally.'
    )
    assert.deepEqual(next.fence, entry.fence)
    assert.deepEqual(next.sheet.inventory, entry.sheet.inventory)
    assert.equal(
      next.sheet.reference.equipmentOptions.some((option) => option.id === equipmentId),
      entry.character.state.equipment.inventory.some((item) => item.equipmentId === equipmentId)
    )
  }
  const retainedOwn = retained.characters.find((entry) => entry.id === characterIds[0])
  assert.ok(retainedOwn)
  const retainedHeld = retainedOwn.character.state.equipment.inventory.find(
    (item) => item.id === held.id
  )
  assert.deepEqual(retainedHeld, held)
  assert.ok(retainedHeld?.retainedRulesJson)
  assert.deepEqual(
    acquiredEquipmentRulesSchema.parse(JSON.parse(retainedHeld.retainedRulesJson)),
    rawRules
  )
  assert.ok(retainedOwn.sheet.inventory.containers?.some((container) => container.id === held.id))
  const equipmentRemoval = assertRemoval(before, retained, 'EQUIPMENT', equipmentId)
  assert.deepEqual(equipmentRemoval.receipt.evacuatedVehicles, [])
  const noNewCopies = await read()
  await assert.rejects(
    () =>
      executeCharacter({
        type: 'ADD_INVENTORY_ITEM',
        equipmentId,
        quantity: 1
      }),
    /unavailable|not available|source access/i
  )
  for (const { vehicleId } of bags) {
    const fence = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: ownerRef(vehicleId) }
    })
    await assert.rejects(
      () =>
        owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
          input: {
            kind: 'ITEM_ADD',
            campaignId,
            ...(vehicleId === undefined ? {} : { vehicleId }),
            equipmentId,
            quantity: 1,
            expectedOwnerVersion: fence.version,
            idempotencyKey: crypto.randomUUID()
          }
        }),
      /unavailable|not available|source/i
    )
  }
  assert.deepEqual(
    await read(),
    noNewCopies,
    'Unavailable Equipment cannot create additional physical copies or grow any owner.'
  )
  for (const { item, vehicleId } of bags) {
    await mutateShared(
      {
        kind: 'ITEM_ADD',
        equipmentId: club.id,
        quantity: 1,
        containerId: item.id
      },
      vehicleId
    )
    await mutateShared(
      {
        kind: 'CURRENCY_ADJUST',
        denominationId,
        campaignCurrencySystemId: null,
        amount: 1,
        containerId: item.id
      },
      vehicleId
    )
  }
  await executeCharacter({
    type: 'ADD_INVENTORY_ITEM',
    equipmentId: club.id,
    quantity: 1,
    containerId: held.id,
    notes: 'Private child after authored deletion.'
  })
  await executeCharacter({
    type: 'ADJUST_CURRENCY',
    kind: 'RULESET',
    currencyId: denominationId,
    amount: 2,
    containerId: held.id
  })
  const beforeVehicleDeletion = await read()
  const usableOwn = beforeVehicleDeletion.characters.find((entry) => entry.id === characterIds[0])
  assert.ok(usableOwn)
  assert.deepEqual(
    usableOwn.character.state.equipment.inventory.find((item) => item.id === held.id),
    held
  )
  assert.ok(
    usableOwn.character.state.equipment.inventory.some(
      (item) =>
        item.equipmentId === club.id &&
        item.containerId === held.id &&
        item.notes === 'Private child after authored deletion.'
    )
  )
  assert.equal(
    usableOwn.character.state.currency
      .filter((group) => group.containerId === held.id)
      .flatMap((group) => group.currencies)
      .filter(
        (currency) =>
          currencyKey(currency, currency.currencyId) ===
          JSON.stringify(['RULESET', null, denominationId])
      )
      .reduce((sum, currency) => sum + exactAmount(currency.amount), 0n),
    2n
  )
  assert.equal(
    await owner.mutation(api.content.deletion.deleteActive, {
      subjectKind: 'VEHICLE',
      subjectId: vehicleDefinitionId
    }),
    null
  )
  const evacuated = await read()
  assertCampaignAdvance(beforeVehicleDeletion, evacuated)
  assertDraftRetained(beforeVehicleDeletion, evacuated, vehicleDefinitionId)
  const sourceIds = [availableSource.id, unavailableSource.id].sort()
  assert.deepEqual(
    evacuated.vehicles,
    beforeVehicleDeletion.vehicles.filter((vehicle) => !sourceIds.includes(vehicle.id))
  )
  assert.deepEqual(
    evacuated.cargo,
    beforeVehicleDeletion.cargo.filter((entry) => !sourceIds.includes(entry.id))
  )
  assert.ok(evacuated.vehicles.some((vehicle) => vehicle.id === unrelated.id))
  assert.deepEqual(evacuated.characters, beforeVehicleDeletion.characters)
  assert.deepEqual(evacuated.systems, beforeVehicleDeletion.systems)
  assert.deepEqual(
    evacuated.shares,
    beforeVehicleDeletion.shares.filter((share) => share.subjectId !== vehicleDefinitionId)
  )
  const evacuatedCargo = sourceIds.map((id) => {
    const entry = beforeVehicleDeletion.cargo.find((cargo) => cargo.id === id)
    assert.ok(entry)
    return entry
  })
  assert.deepEqual(
    sorted(evacuated.party.items.page),
    sorted([
      ...beforeVehicleDeletion.party.items.page,
      ...evacuatedCargo.flatMap((cargo) => cargo.items.page)
    ]),
    'Both complete item trees must return with original IDs, descendants, labels and placement.'
  )
  const expectedCurrencies = structuredClone(beforeVehicleDeletion.party.currencies.page)
  for (const cargo of evacuatedCargo)
    for (const currency of cargo.currencies.page) {
      const destination =
        currency.containerId === null
          ? expectedCurrencies.find(
              (row) =>
                row.containerId === null &&
                currencyKey(row, row.denominationId) ===
                  currencyKey(currency, currency.denominationId)
            )
          : undefined
      if (destination) {
        assert.deepEqual({ ...currency, amount: 0 }, { ...destination, amount: 0 })
        const amount = exactAmount(destination.amount) + exactAmount(currency.amount)
        assert.ok(amount <= BigInt(Number.MAX_SAFE_INTEGER))
        destination.amount = Number(amount)
      } else expectedCurrencies.push(structuredClone(currency))
    }
  assert.deepEqual(
    sorted(evacuated.party.currencies.page),
    sorted(expectedCurrencies),
    'Placed rows must remain literal and loose merges must preserve exact namespace metadata.'
  )
  assert.equal(evacuated.party.items.version, beforeVehicleDeletion.party.items.version + 2)
  assert.equal(
    evacuated.party.currencies.version,
    beforeVehicleDeletion.party.currencies.version + 2
  )
  assert.deepEqual(evacuated.party.fence, {
    ...beforeVehicleDeletion.party.fence,
    version: beforeVehicleDeletion.party.fence.version + 2
  })
  assert.deepEqual(evacuated.party.items.owner, beforeVehicleDeletion.party.items.owner)
  assert.deepEqual(evacuated.party.currencies.owner, beforeVehicleDeletion.party.currencies.owner)
  assert.deepEqual(
    totals(evacuated),
    totals(beforeVehicleDeletion),
    'BigInt totals must conserve every qualified denomination across all owners.'
  )
  const vehicleRemoval = assertRemoval(
    beforeVehicleDeletion,
    evacuated,
    'VEHICLE',
    vehicleDefinitionId
  )
  assert.deepEqual(vehicleRemoval.receipt.affectedCharacters, [])
  assert.deepEqual(
    vehicleRemoval.receipt.evacuatedVehicles,
    evacuatedCargo.map((cargo) => {
      const groupIds = transferredGroupIds.get(cargo.id)
      assert.ok(groupIds && groupIds.length > 0)
      return {
        vehicleId: cargo.id,
        vehicleDefinitionId,
        transferredTopLevelItemIds: cargo.items.page
          .filter((item) => item.containerId === null)
          .map((item) => item.id)
          .sort(),
        transferredCurrencyGroupIds: groupIds
      }
    })
  )
  assert.equal(vehicleRemoval.added.length, 3)
  const evacuationEvents = vehicleRemoval.added.filter(
    (event) => event.type === 'CAMPAIGN_VEHICLE_EVACUATED'
  )
  assert.equal(evacuationEvents.length, 2)
  for (const [index, cargo] of evacuatedCargo.entries()) {
    const groupIds = transferredGroupIds.get(cargo.id)
    assert.ok(groupIds && groupIds.length > 0)
    const matching = evacuationEvents.filter(
      (event) => eventPayload(event).formerCampaignVehicleId === cargo.id
    )
    assert.equal(matching.length, 1)
    const event = matching[0]
    assert.ok(event)
    assert.equal(event.visibility, 'OWNER')
    assert.equal(event.campaignId, campaignId)
    assert.equal(event.subjectCharacterId, null)
    assert.deepEqual(eventPayload(event), {
      reason: 'AUTHORED_DELETED',
      removalEventId: vehicleRemoval.parent.id,
      formerCampaignVehicleId: cargo.id,
      authoredVehicleId: vehicleDefinitionId,
      transferredTopLevelItemIds: cargo.items.page
        .filter((item) => item.containerId === null)
        .map((item) => item.id)
        .sort(),
      transferredCurrencyGroupIds: groupIds,
      sourceInventoryVersion: cargo.items.version + 1,
      destinationInventoryVersion: beforeVehicleDeletion.party.items.version + index + 1,
      resultingCampaignVersion: beforeVehicleDeletion.campaign.version + 1
    })
  }
  for (const id of sourceIds)
    for (const reference of [
      api.campaigns.vehicleInventory.items,
      api.campaigns.vehicleInventory.currencies
    ])
      await assert.rejects(
        () => owner.query(reference, { ...pagination(null), vehicleId: id }),
        /Vehicle|unavailable|content/i
      )
  assert.deepEqual(
    await read(),
    evacuated,
    'Post-deletion reads and privacy checks must not mutate state.'
  )
  assert.ok(evacuated.audit.length <= 100)
  return {
    equipmentId,
    vehicleDefinitionId,
    sourceVehicleIds: sourceIds,
    unrelatedVehicleId: unrelated.id,
    campaignCurrencySystemId: system.id,
    equipmentRemoval: equipmentRemoval.receipt,
    vehicleRemoval: vehicleRemoval.receipt,
    evacuationEvents,
    conservedTotals: totals(evacuated).map(([key, amount]) => ({
      key,
      amount: amount.toString()
    }))
  }
}
