import assert from 'node:assert/strict'
import type { FunctionReturnType } from 'convex/server'
import type {
  CampaignPartyInventoryMutationInput,
  CurrencySystemDto,
  InventoryOwnerRefDto,
  SaveCampaignCurrencySystemInput,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { characterDraftSaveInputSchema } from '@artificer-toolkit/schema/api/characterDrafts'
import { decodeCampaignEventPage } from '@artificer-toolkit/schema/api/campaignEventTransport'
import type { CampaignEventDto } from '@artificer-toolkit/schema/api/campaignLiveState'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'

type Identity = { kind?: 'RULESET' | 'CAMPAIGN'; campaignCurrencySystemId?: string }
type SheetCommand =
  | Omit<
      Extract<CharacterSheetCommandInputDto, { type: 'ADD_INVENTORY_ITEM' }>,
      'commandId' | 'expectedVersion'
    >
  | Omit<
      Extract<CharacterSheetCommandInputDto, { type: 'ADJUST_CURRENCY' }>,
      'commandId' | 'expectedVersion'
    >
  | Omit<
      Extract<CharacterSheetCommandInputDto, { type: 'CREATE_NOTE_GROUP' }>,
      'commandId' | 'expectedVersion'
    >
  | Omit<
      Extract<CharacterSheetCommandInputDto, { type: 'CREATE_NOTE' }>,
      'commandId' | 'expectedVersion'
    >
type SharedCommand =
  | Omit<
      Extract<CampaignPartyInventoryMutationInput, { kind: 'ITEM_ADD' }>,
      'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey'
    >
  | Omit<
      Extract<CampaignPartyInventoryMutationInput, { kind: 'CURRENCY_ADJUST' }>,
      'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey'
    >
const sorted = <T>(rows: T[]): T[] =>
  [...rows].sort((a, b) => canonicalizeRuleDocument(a).localeCompare(canonicalizeRuleDocument(b)))
function exact(amount: number) {
  assert.ok(Number.isSafeInteger(amount) && amount >= 0)
  return BigInt(amount)
}
function key(row: Identity, denominationId: string) {
  const kind = row.kind ?? 'RULESET'
  if (kind === 'CAMPAIGN') assert.ok(row.campaignCurrencySystemId)
  else assert.equal(row.campaignCurrencySystemId, undefined)
  return JSON.stringify([kind, row.campaignCurrencySystemId ?? null, denominationId])
}
const belongs = (row: Identity, id: string) =>
  row.kind === 'CAMPAIGN' && row.campaignCurrencySystemId === id
async function pages<T>(
  load: (cursor: string | null) => Promise<{ page: T[]; isDone: boolean; continueCursor: string }>
) {
  const rows: T[] = [],
    seen = new Set<string>()
  let cursor: string | null = null
  while (true) {
    const result = await load(cursor)
    rows.push(...result.page)
    if (result.isDone) return rows
    assert.ok(result.continueCursor)
    assert.equal(seen.has(result.continueCursor), false, 'Pagination must advance.')
    seen.add(result.continueCursor)
    cursor = result.continueCursor
  }
}
async function inventory<T>(
  load: (cursor: string | null) => Promise<{
    owner: InventoryOwnerRefDto
    version: number
    page: T[]
    isDone: boolean
    continueCursor: string
  }>
) {
  let captured: { owner: InventoryOwnerRefDto; version: number } | undefined
  const page = await pages(async (cursor) => {
    const result = await load(cursor),
      fence = { owner: result.owner, version: result.version }
    if (captured) assert.deepEqual(fence, captured)
    else captured = fence
    return result
  })
  assert.ok(captured)
  return { ...captured, page }
}

/** Standalone public currency lifecycle journey; the ordinary custody prelude is skipped. */
export async function verifyCampaignCurrencyLifecycle(
  cohort: CampaignCustodyCohort,
  anonymous: DevelopmentClient
) {
  assert.equal(fighter.category, 'BASE')
  const { owner, players, campaignId, characterIds } = cohort
  const goldId = fighter.startingGold.currencyId
  const pagination = (cursor: string | null) => ({
    campaignId,
    paginationOpts: { cursor, numItems: 2 }
  })
  const systems = () =>
    pages((cursor) => owner.query(api.campaigns.currencySystems.list, pagination(cursor)))
  const vehicles = () =>
    pages((cursor) => owner.query(api.campaigns.vehicles.list, pagination(cursor)))
  const items = (vehicleId?: string) =>
    inventory((cursor) =>
      vehicleId === undefined
        ? owner.query(api.campaigns.partyInventory.items, pagination(cursor))
        : owner.query(api.campaigns.vehicleInventory.items, { ...pagination(cursor), vehicleId })
    )
  const coins = (vehicleId?: string) =>
    inventory((cursor) =>
      vehicleId === undefined
        ? owner.query(api.campaigns.partyInventory.currencies, pagination(cursor))
        : owner.query(api.campaigns.vehicleInventory.currencies, {
            ...pagination(cursor),
            vehicleId
          })
    )
  const ref = (vehicleId?: string): InventoryOwnerRefDto =>
    vehicleId === undefined ? { kind: 'CAMPAIGN', campaignId } : { kind: 'VEHICLE', vehicleId }
  const audit = async () => {
    const rows: FunctionReturnType<typeof api.campaigns.inventoryAudit.list>['events'] = [],
      seen = new Set<string>()
    let cursor: string | undefined
    while (true) {
      const result = await owner.query(api.campaigns.inventoryAudit.list, {
        campaignId,
        limit: 8,
        ...(cursor === undefined ? {} : { cursor })
      })
      rows.push(...result.events)
      if (result.nextCursor === null) {
        assert.equal(new Set(rows.map((row) => row.id)).size, rows.length)
        return rows
      }
      assert.ok(result.nextCursor)
      assert.equal(seen.has(result.nextCursor), false)
      seen.add(result.nextCursor)
      cursor = result.nextCursor
    }
  }
  const history = async () => {
    const rows: CampaignEventDto[] = [],
      seen = new Set<string>()
    let cursor: string | undefined
    while (true) {
      const result = decodeCampaignEventPage(
        await owner.query(api.campaigns.events.list, {
          campaignId,
          characterId: characterIds[0],
          limit: 8,
          ...(cursor === undefined ? {} : { cursor })
        })
      )
      rows.push(...result.events)
      if (result.nextCursor === null) {
        assert.equal(new Set(rows.map((row) => row.id)).size, rows.length)
        return rows
      }
      assert.ok(result.nextCursor)
      assert.equal(seen.has(result.nextCursor), false)
      seen.add(result.nextCursor)
      cursor = result.nextCursor
    }
  }
  const read = async () => {
    const [campaign, catalogue, fleet, characters, inventoryAudit, events] = await Promise.all([
      owner.query(api.campaigns.queries.get, { id: campaignId }),
      systems(),
      vehicles(),
      Promise.all(
        characterIds.map(async (id, index) => {
          const player = players[index]
          assert.ok(player)
          const [active, sheet, draft, fence] = await Promise.all([
            player.client.query(api.characters.builder.activeCharacter, { id }),
            player.client.query(api.characters.sheet.get, { id }),
            player.client.query(api.characters.drafts.get, { id }),
            player.client.query(api.campaigns.inventoryOwners.version, {
              input: { campaignId, owner: { kind: 'CHARACTER', characterId: id } }
            })
          ])
          assert.ok(active && sheet)
          assert.equal(sheet.meta.viewer, 'CHARACTER_OWNER')
          assert.equal(sheet.meta.streamVersion, fence.version)
          return { id, active, sheet, draft, fence }
        })
      ),
      audit(),
      history()
    ])
    assert.ok(campaign)
    const shared = async (vehicleId?: string) => {
      const [heldItems, currencies, fence] = await Promise.all([
        items(vehicleId),
        coins(vehicleId),
        owner.query(api.campaigns.inventoryOwners.version, {
          input: { campaignId, owner: ref(vehicleId) }
        })
      ])
      assert.equal(heldItems.version, currencies.version)
      assert.equal(heldItems.version, fence.version)
      assert.equal(new Set(heldItems.page.map((item) => item.id)).size, heldItems.page.length)
      return { items: heldItems, currencies, fence }
    }
    return {
      campaign,
      systems: catalogue,
      vehicles: fleet,
      characters,
      audit: inventoryAudit,
      history: events,
      party: await shared(),
      cargo: await Promise.all(
        fleet.map(async (vehicle) => ({ id: vehicle.id, ...(await shared(vehicle.id)) }))
      )
    }
  }
  type Snapshot = Awaited<ReturnType<typeof read>>
  const character = (snapshot: Snapshot, index: number) => {
    const entry = snapshot.characters[index]
    assert.ok(entry)
    return entry
  }
  const sharedState = (snapshot: Snapshot, vehicleId?: string) => {
    if (vehicleId === undefined) return snapshot.party
    const entry = snapshot.cargo.find((row) => row.id === vehicleId)
    assert.ok(entry)
    return entry
  }
  const currentSystem = (snapshot: Snapshot, id: string) => {
    const found = snapshot.systems.find((row) => row.id === id)
    assert.ok(found)
    return found
  }
  const input = (system: CurrencySystemDto): SaveCampaignCurrencySystemInput => ({
    campaignId,
    systemId: system.id,
    expectedVersion: system.version,
    label: system.label,
    isReference: system.isReference,
    denominations: system.denominations
  })
  const refusals: string[] = []
  const refuse = async (label: string, operation: () => Promise<unknown>, error: RegExp) => {
    const before = await read()
    await assert.rejects(operation, error)
    assert.deepEqual(await read(), before, label + ' must be atomic.')
    refusals.push(label)
  }
  const execute = async (index: number, fields: SheetCommand) => {
    const player = players[index],
      id = characterIds[index]
    assert.ok(player && id)
    const before = await player.client.query(api.characters.sheet.get, { id })
    assert.ok(before)
    await player.client.mutation(api.characters.sheetCommands.execute, {
      id,
      command: {
        ...fields,
        commandId: crypto.randomUUID(),
        expectedVersion: before.meta.streamVersion
      }
    })
    const after = await player.client.query(api.characters.sheet.get, { id })
    assert.ok(after)
    assert.equal(after.meta.streamVersion, before.meta.streamVersion + 1)
  }
  const mutate = async (fields: SharedCommand, vehicleId?: string) => {
    const before = await items(vehicleId)
    const command: CampaignPartyInventoryMutationInput = {
      ...fields,
      campaignId,
      expectedOwnerVersion: before.version,
      idempotencyKey: crypto.randomUUID(),
      ...(vehicleId === undefined ? {} : { vehicleId })
    }
    await owner.mutation(api.campaigns.partyInventoryCommands.mutate, { input: command })
    const after = await items(vehicleId)
    assert.equal(after.version, before.version + 1)
    if (fields.kind === 'ITEM_ADD') {
      const added = after.page.filter((item) => !before.page.some((old) => old.id === item.id))
      assert.equal(added.length, 1)
      const held = added[0]
      assert.ok(held)
      return held
    }
    assert.deepEqual(after.page, before.page)
    return undefined
  }
  const options = (snapshot: Snapshot) => {
    const expected = sorted(
      snapshot.systems.flatMap((system) =>
        system.denominations.map((denomination) => ({
          id: denomination.id,
          kind: 'CAMPAIGN',
          campaignCurrencySystemId: system.id,
          label: denomination.label + ' (' + system.label + ')'
        }))
      )
    )
    for (const entry of snapshot.characters)
      assert.deepEqual(
        sorted(
          entry.sheet.reference.currencyOptions.filter((option) => option.kind === 'CAMPAIGN')
        ),
        expected
      )
  }
  const weighted = (snapshot: Snapshot, system: CurrencySystemDto) => {
    const scales = new Map(
      system.denominations.map((denomination) => [
        denomination.id,
        BigInt(denomination.scaleInReference)
      ])
    )
    const value = (id: string, amount: number) => {
      const scale = scales.get(id)
      assert.ok(scale)
      return exact(amount) * scale
    }
    return [
      ...snapshot.characters.map(
        (entry) =>
          [
            entry.id,
            entry.active.state.currency
              .flatMap((group) => group.currencies)
              .filter((row) => belongs(row, system.id))
              .reduce((sum, row) => sum + value(row.currencyId, row.amount), 0n)
          ] as const
      ),
      ...[snapshot.party, ...snapshot.cargo].map(
        (entry) =>
          [
            JSON.stringify(entry.fence.owner),
            entry.currencies.page
              .filter((row) => belongs(row, system.id))
              .reduce((sum, row) => sum + value(row.denominationId, row.amount), 0n)
          ] as const
      )
    ]
  }
  const assertRewrite = (
    before: Snapshot,
    after: Snapshot,
    systemId: string,
    next: CurrencySystemDto | null
  ) => {
    const previous = currentSystem(before, systemId)
    assert.deepEqual(after.campaign, before.campaign)
    assert.deepEqual(after.vehicles, before.vehicles)
    assert.deepEqual(after.audit, before.audit)
    assert.deepEqual(after.history, before.history)
    const expectedSystems = before.systems.flatMap((system) => {
      if (system.id === systemId) return next === null ? [] : [next]
      return [
        {
          ...system,
          ...(next?.isReference && system.isReference
            ? { isReference: false, version: system.version + 1 }
            : {})
        }
      ]
    })
    assert.deepEqual(sorted(after.systems), sorted(expectedSystems))
    const replacement = (id: string, amount: number) => {
      const old = previous.denominations.find((row) => row.id === id)
      assert.ok(old)
      assert.ok(next)
      const denomination = next.denominations.find((row) => row.id === id) ?? next.denominations[0]
      assert.ok(denomination)
      const value = exact(amount) * BigInt(old.scaleInReference),
        scale = BigInt(denomination.scaleInReference)
      assert.equal(value % scale, 0n)
      assert.ok(value / scale <= BigInt(Number.MAX_SAFE_INTEGER))
      return { denomination, amount: Number(value / scale) }
    }
    for (const [index, old] of before.characters.entries()) {
      const updated = character(after, index)
      const affected = old.active.state.currency.some((group) =>
        group.currencies.some((row) => belongs(row, systemId))
      )
      const groups = old.active.state.currency.flatMap((group) => {
        let changed = false
        const currencies = group.currencies.flatMap((row) => {
          if (!belongs(row, systemId)) return [row]
          changed = true
          if (next === null) {
            assert.equal(row.amount, 0)
            return []
          }
          const converted = replacement(row.currencyId, row.amount)
          return [
            {
              ...row,
              currencyId: converted.denomination.id,
              amount: converted.amount,
              kind: 'CAMPAIGN' as const,
              campaignCurrencySystemId: systemId
            }
          ]
        })
        return changed && currencies.length === 0 ? [] : [{ ...group, currencies }]
      })
      assert.deepEqual(
        updated.active,
        { ...old.active, state: { ...old.active.state, currency: groups } },
        'Active raw rules, items, notes, group IDs and placements must stay exact.'
      )
      assert.deepEqual(
        updated.draft,
        old.draft,
        'Saved working draft and its structural intent must remain literal.'
      )
      assert.deepEqual(updated.fence, {
        ...old.fence,
        version: old.fence.version + Number(affected)
      })
      const rewriteSheet = (rows: typeof old.sheet.inventory.currencies) =>
        rows.flatMap((row) => {
          if (!belongs(row, systemId)) return [row]
          if (next === null) {
            assert.equal(row.amount, 0)
            return []
          }
          const converted = replacement(row.currencyId, row.amount)
          return [
            {
              ...row,
              currencyId: converted.denomination.id,
              amount: converted.amount,
              label: converted.denomination.label + ' (' + next.label + ')'
            }
          ]
        })
      const expectedSheet = {
        ...old.sheet,
        meta: { ...old.sheet.meta, streamVersion: old.sheet.meta.streamVersion + Number(affected) },
        inventory: {
          ...old.sheet.inventory,
          currencies: rewriteSheet(old.sheet.inventory.currencies),
          ...(old.sheet.inventory.containers === undefined
            ? {}
            : {
                containers: old.sheet.inventory.containers.map((container) => ({
                  ...container,
                  currencies: rewriteSheet(container.currencies)
                }))
              })
        },
        reference: {
          ...old.sheet.reference,
          currencyOptions: updated.sheet.reference.currencyOptions
        }
      }
      assert.deepEqual(
        updated.sheet,
        expectedSheet,
        'Own Sheet mechanics, private notes, physical contents and unrelated holdings must remain literal.'
      )
      assert.deepEqual(
        updated.sheet.reference.currencyOptions.filter((row) => row.kind !== 'CAMPAIGN'),
        old.sheet.reference.currencyOptions.filter((row) => row.kind !== 'CAMPAIGN')
      )
    }
    for (const [index, old] of [before.party, ...before.cargo].entries()) {
      const updated = [after.party, ...after.cargo][index]
      assert.ok(updated)
      const affected = old.currencies.page.some((row) => belongs(row, systemId))
      const currencies = old.currencies.page.flatMap((row) => {
        if (!belongs(row, systemId)) return [row]
        if (next === null) {
          assert.equal(row.amount, 0)
          return []
        }
        const converted = replacement(row.denominationId, row.amount)
        return [
          {
            ...row,
            denominationId: converted.denomination.id,
            amount: converted.amount,
            label: converted.denomination.label,
            abbreviation: converted.denomination.abbreviation
          }
        ]
      })
      assert.deepEqual(updated.items, {
        ...old.items,
        version: old.items.version + Number(affected)
      })
      assert.deepEqual(updated.currencies, {
        ...old.currencies,
        version: old.currencies.version + Number(affected),
        page: currencies
      })
      assert.deepEqual(updated.fence, {
        ...old.fence,
        version: old.fence.version + Number(affected)
      })
    }
    if (next !== null)
      assert.deepEqual(
        weighted(after, next),
        weighted(before, previous),
        'Every owner preserves its exact BigInt weighted total.'
      )
    options(after)
  }
  const initial = await read()
  assert.deepEqual(initial.systems, [], 'The standalone fixture starts without currency systems.')
  assert.ok(initial.vehicles.length + 2 <= 4)
  assert.ok(initial.audit.length + 65 <= 100 && initial.history.length + 65 <= 100)
  const highId = crypto.randomUUID(),
    zeroId = crypto.randomUUID(),
    otherId = crypto.randomUUID()
  const a = await owner.mutation(api.campaigns.currencySystems.save, {
    campaignId,
    label: 'Lifecycle target',
    isReference: false,
    denominations: [
      { id: goldId, label: 'Target gold', abbreviation: 'tg', scaleInReference: 1 },
      { id: highId, label: 'Target high', abbreviation: 'th', scaleInReference: 4 },
      { id: zeroId, label: 'Target zero', abbreviation: 'tz', scaleInReference: 2 }
    ]
  })
  assert.equal(a.isReference, true, 'The first system becomes reference automatically.')
  const b = await owner.mutation(api.campaigns.currencySystems.save, {
    campaignId,
    label: 'Lifecycle unrelated',
    isReference: false,
    denominations: [{ id: otherId, label: 'Other coin', abbreviation: 'oc', scaleInReference: 1 }]
  })
  assert.equal(b.isReference, false)
  assert.deepEqual(
    sorted(
      await pages((cursor) =>
        players[0].client.query(api.campaigns.currencySystems.list, pagination(cursor))
      )
    ),
    sorted(await systems())
  )
  await refuse(
    'anonymous catalogue',
    () => anonymous.query(api.campaigns.currencySystems.list, pagination(null)),
    /authenticated|identity|sign in|Unauthorized/i
  )
  await refuse(
    'player catalogue save',
    () => players[0].client.mutation(api.campaigns.currencySystems.save, input(a)),
    /Only the Campaign owner/
  )
  await refuse(
    'anonymous catalogue save',
    () => anonymous.mutation(api.campaigns.currencySystems.save, input(a)),
    /authenticated|identity|sign in|Unauthorized/i
  )
  await refuse(
    'player catalogue remove',
    () =>
      players[0].client.mutation(api.campaigns.currencySystems.remove, {
        campaignId,
        systemId: b.id,
        expectedVersion: b.version
      }),
    /Only the Campaign owner/
  )
  await refuse(
    'anonymous catalogue remove',
    () =>
      anonymous.mutation(api.campaigns.currencySystems.remove, {
        campaignId,
        systemId: b.id,
        expectedVersion: b.version
      }),
    /authenticated|identity|sign in|Unauthorized/i
  )
  await refuse(
    'stale save',
    () =>
      owner.mutation(api.campaigns.currencySystems.save, {
        ...input(a),
        expectedVersion: a.version + 1
      }),
    /changed before this update/
  )
  await refuse(
    'stale remove',
    () =>
      owner.mutation(api.campaigns.currencySystems.remove, {
        campaignId,
        systemId: a.id,
        expectedVersion: a.version + 1
      }),
    /changed before deletion/
  )
  await refuse(
    'reference demotion',
    () => owner.mutation(api.campaigns.currencySystems.save, { ...input(a), isReference: false }),
    /Set another reference system/
  )
  await refuse(
    'reference removal',
    () =>
      owner.mutation(api.campaigns.currencySystems.remove, {
        campaignId,
        systemId: a.id,
        expectedVersion: a.version
      }),
    /Set another reference system/
  )
  await refuse(
    'no reference denomination',
    () =>
      owner.mutation(api.campaigns.currencySystems.save, {
        ...input(a),
        denominations: a.denominations.map((row) => ({
          ...row,
          scaleInReference: row.scaleInReference + 4
        }))
      }),
    /exactly one reference denomination/
  )
  for (const field of ['id', 'label', 'abbreviation', 'scaleInReference'] as const) {
    const first = a.denominations[0],
      second = a.denominations[1]
    assert.ok(first && second)
    await refuse(
      'duplicate ' + field,
      () =>
        owner.mutation(api.campaigns.currencySystems.save, {
          ...input(a),
          denominations: [first, { ...second, [field]: first[field] }]
        }),
      /unique IDs, labels, abbreviations and scales/
    )
  }
  await refuse(
    'over five denominations',
    () =>
      owner.mutation(api.campaigns.currencySystems.save, {
        ...input(a),
        denominations: Array.from({ length: 6 }, (_, index) => ({
          id: crypto.randomUUID(),
          label: 'Denomination ' + index,
          abbreviation: 'd' + index,
          scaleInReference: index + 1
        }))
      }),
    /Validation|validation|Too big|at most|length/i
  )
  await refuse(
    'cross-system denomination ID',
    () =>
      owner.mutation(api.campaigns.currencySystems.save, {
        ...input(a),
        denominations: [{ id: otherId, label: 'Collision', abbreviation: 'c', scaleInReference: 1 }]
      }),
    /ID already belongs to another system/
  )
  const carts = []
  for (const index of [0, 1])
    carts.push(
      await owner.mutation(api.campaigns.vehicles.create, {
        campaignId,
        vehicleDefinitionId: cart.id,
        label: 'Lifecycle cart ' + index
      })
    )
  const vehicleIds = carts.map((vehicle) => vehicle.id)
  const sharedOwners: Array<string | undefined> = [undefined, ...vehicleIds]
  const targetIdentity = { kind: 'CAMPAIGN' as const, campaignCurrencySystemId: a.id }
  const otherIdentity = { kind: 'CAMPAIGN' as const, campaignCurrencySystemId: b.id }
  for (const vehicleId of sharedOwners) {
    const bag = await mutate({ kind: 'ITEM_ADD', equipmentId: backpack.id, quantity: 1 }, vehicleId)
    assert.ok(bag)
    await mutate(
      { kind: 'ITEM_ADD', equipmentId: club.id, quantity: 1, containerId: bag.id },
      vehicleId
    )
    for (const containerId of [null, bag.id])
      for (const [denominationId, systemId, amount] of [
        [goldId, a.id, 4],
        [highId, a.id, 4],
        [otherId, b.id, 6],
        [goldId, null, 8]
      ] as const)
        await mutate(
          {
            kind: 'CURRENCY_ADJUST',
            denominationId,
            campaignCurrencySystemId: systemId,
            amount,
            containerId
          },
          vehicleId
        )
  }
  const addCharacterBag = async (index: number, label: string) => {
    const before = character(await read(), index).active.state.equipment.inventory
    await execute(index, {
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: backpack.id,
      quantity: 1,
      customName: label,
      notes: 'Private lifecycle physical pack notes.'
    })
    const after = character(await read(), index).active.state.equipment.inventory
    const added = after.filter((item) => !before.some((old) => old.id === item.id))
    assert.equal(added.length, 1)
    const bag = added[0]
    assert.ok(bag)
    await execute(index, {
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: club.id,
      quantity: 1,
      containerId: bag.id,
      notes: 'Private nested lifecycle Club notes.'
    })
    return bag
  }
  for (const index of [0, 1]) {
    const before = character(await read(), index).active.state.noteGroups ?? []
    await execute(index, { type: 'CREATE_NOTE_GROUP', label: 'Lifecycle private notes' })
    const added = (character(await read(), index).active.state.noteGroups ?? []).filter(
      (group) => !before.some((old) => old.id === group.id)
    )
    assert.equal(added.length, 1)
    const group = added[0]
    assert.ok(group)
    await execute(index, {
      type: 'CREATE_NOTE',
      groupId: group.id,
      title: 'Lifecycle private title',
      body: 'Private body retained through every currency lifecycle rewrite.',
      pinned: true
    })
    const bag = await addCharacterBag(index, 'Lifecycle held pack ' + index)
    for (const containerId of [undefined, bag.id])
      for (const [currencyId, identity, amount] of [
        [goldId, targetIdentity, 4],
        [highId, targetIdentity, 4],
        [otherId, otherIdentity, 6],
        [goldId, { kind: 'RULESET' as const }, 8]
      ] as const)
        await execute(index, {
          type: 'ADJUST_CURRENCY',
          currencyId,
          ...identity,
          amount,
          ...(containerId === undefined ? {} : { containerId })
        })
    const zeroBag = await addCharacterBag(index, 'Separate zero-denomination pack ' + index)
    await execute(index, {
      type: 'ADJUST_CURRENCY',
      currencyId: zeroId,
      ...targetIdentity,
      amount: 1,
      containerId: zeroBag.id
    })
    await execute(index, {
      type: 'ADJUST_CURRENCY',
      currencyId: zeroId,
      ...targetIdentity,
      amount: -1,
      containerId: zeroBag.id
    })
    const zeroRows = character(await read(), index)
      .active.state.currency.filter((group) => group.containerId === zeroBag.id)
      .flatMap((group) => group.currencies)
      .filter((row) => belongs(row, a.id) && row.currencyId === zeroId)
    assert.equal(zeroRows.length, 1)
    assert.equal(zeroRows[0]?.amount, 0)
  }
  const zeroGroups: Array<{ owner: InventoryOwnerRefDto; itemId: string; groupIds: string[] }> = []
  for (const vehicleId of sharedOwners) {
    const bag = await addCharacterBag(0, 'Transferred real zero pack ' + (vehicleId ?? 'party'))
    await execute(0, {
      type: 'ADJUST_CURRENCY',
      currencyId: zeroId,
      ...targetIdentity,
      amount: 1,
      containerId: bag.id
    })
    await execute(0, {
      type: 'ADJUST_CURRENCY',
      currencyId: zeroId,
      ...targetIdentity,
      amount: -1,
      containerId: bag.id
    })
    const before = await read(),
      source = character(before, 0),
      destination = sharedState(before, vehicleId)
    const groups = source.active.state.currency.filter((group) => group.containerId === bag.id)
    assert.ok(groups.length > 0)
    assert.equal(new Set(groups.map((group) => group.id)).size, groups.length)
    assert.equal(groups.flatMap((group) => group.currencies).length, 1)
    assert.deepEqual(
      groups
        .flatMap((group) => group.currencies)
        .map((row) => ({ id: row.currencyId, amount: row.amount, key: key(row, row.currencyId) })),
      [{ id: zeroId, amount: 0, key: key(targetIdentity, zeroId) }]
    )
    const transfer: TransferCampaignInventoryInput = {
      kind: 'ITEM',
      campaignId,
      source: { kind: 'CHARACTER', characterId: characterIds[0] },
      destination: ref(vehicleId),
      itemId: bag.id,
      amount: 1,
      expectedSourceVersion: source.fence.version,
      expectedDestinationVersion: destination.fence.version,
      idempotencyKey: crypto.randomUUID()
    }
    const receipt = await players[0].client.mutation(api.campaigns.inventoryTransfers.transfer, {
      input: transfer
    })
    const after = await read(),
      moved = sharedState(after, vehicleId),
      remaining = character(after, 0)
    assert.equal(remaining.fence.version, source.fence.version + 1)
    assert.equal(moved.fence.version, destination.fence.version + 1)
    const subtree = source.active.state.equipment.inventory.filter(
      (item) => item.id === bag.id || item.containerId === bag.id
    )
    assert.equal(subtree.length, 2)
    for (const item of subtree) {
      assert.equal(
        remaining.active.state.equipment.inventory.some((row) => row.id === item.id),
        false
      )
      const physical = moved.items.page.find((row) => row.id === item.id)
      assert.ok(physical)
      assert.equal(physical.quantity, item.quantity)
      assert.equal(physical.containerId, item.containerId ?? null)
    }
    for (const group of groups)
      assert.equal(
        remaining.active.state.currency.some((row) => row.id === group.id),
        false
      )
    assert.deepEqual(
      moved.currencies.page.filter((row) => row.containerId === bag.id),
      [
        {
          kind: 'CAMPAIGN',
          campaignCurrencySystemId: a.id,
          denominationId: zeroId,
          label: 'Target zero',
          abbreviation: 'tz',
          amount: 0,
          containerId: bag.id
        }
      ]
    )
    assert.equal(after.audit.length, before.audit.length + 1)
    assert.deepEqual(
      await players[0].client.mutation(api.campaigns.inventoryTransfers.transfer, {
        input: transfer
      }),
      receipt
    )
    assert.deepEqual(await read(), after, 'Exact whole-zero-unit replay must not write.')
    zeroGroups.push({
      owner: ref(vehicleId),
      itemId: bag.id,
      groupIds: groups.map((group) => group.id).sort()
    })
  }
  for (const [index, id] of characterIds.entries()) {
    const client = players[index]?.client
    assert.ok(client)
    const own = await client.query(api.characters.builder.activeCharacter, { id })
    assert.ok(own)
    const draft = await client.mutation(api.characters.drafts.create, {
      id,
      systemId: own.systemId
    })
    const { primaryRulesCatalogueId, ...nativeCharacter } = own
    assert.equal(primaryRulesCatalogueId, undefined)
    const saved = await client.mutation(
      api.characters.drafts.save,
      characterDraftSaveInputSchema.parse({
        characterId: id,
        expectedDraftId: draft.id,
        character: nativeCharacter,
        mode: 'edit',
        baseActiveUpdatedAt: draft.baseActiveUpdatedAt,
        ...(draft.payload.builderIntent === undefined
          ? {}
          : { builderIntent: draft.payload.builderIntent })
      })
    )
    assert.equal(saved.id, draft.id)
    assert.equal(saved.draftState, 'ACTIVE_WITH_DRAFT')
  }
  const populated = await read()
  options(populated)
  assert.equal(weighted(populated, a).length, 5)
  const beforeZero = await read()
  const withoutZero = await owner.mutation(api.campaigns.currencySystems.save, {
    ...input(currentSystem(beforeZero, a.id)),
    denominations: a.denominations.filter((row) => row.id !== zeroId)
  })
  const afterZero = await read()
  assertRewrite(beforeZero, afterZero, a.id, withoutZero)
  for (const entry of afterZero.characters)
    assert.equal(
      entry.active.state.currency
        .flatMap((group) => group.currencies)
        .some((row) => belongs(row, a.id) && row.currencyId === zeroId),
      false
    )
  for (const entry of [afterZero.party, ...afterZero.cargo])
    assert.equal(
      entry.currencies.page.some((row) => belongs(row, a.id) && row.denominationId === zeroId),
      false
    )
  const converted = await owner.mutation(api.campaigns.currencySystems.save, {
    ...input(withoutZero),
    denominations: withoutZero.denominations.map((row) => ({
      ...row,
      ...(row.id === highId ? { scaleInReference: 2 } : {})
    }))
  })
  const afterConversion = await read()
  assertRewrite(afterZero, afterConversion, a.id, converted)
  // Shared DTOs omit group IDs. Returning the physical zero units through the normal
  // public producer makes their original group identities observable again.
  for (const unit of zeroGroups) {
    const vehicleId = unit.owner.kind === 'VEHICLE' ? unit.owner.vehicleId : undefined
    const before = await read(),
      shared = sharedState(before, vehicleId),
      own = character(before, 0)
    const toCharacter: TransferCampaignInventoryInput = {
      kind: 'ITEM',
      campaignId,
      source: unit.owner,
      destination: { kind: 'CHARACTER', characterId: characterIds[0] },
      itemId: unit.itemId,
      amount: 1,
      expectedSourceVersion: shared.fence.version,
      expectedDestinationVersion: own.fence.version,
      idempotencyKey: crypto.randomUUID()
    }
    const returnActor = unit.owner.kind === 'VEHICLE' ? owner : players[0].client
    const returnedReceipt = await returnActor.mutation(api.campaigns.inventoryTransfers.transfer, {
      input: toCharacter
    })
    const returned = await read(),
      held = character(returned, 0),
      remaining = sharedState(returned, vehicleId)
    const groups = held.active.state.currency.filter((group) => group.containerId === unit.itemId)
    assert.deepEqual(
      groups.map((group) => group.id).sort(),
      unit.groupIds,
      'Replacement and scale conversion preserve original physical currency-group IDs.'
    )
    assert.deepEqual(
      groups.flatMap((group) => group.currencies),
      [{ currencyId: goldId, kind: 'CAMPAIGN', campaignCurrencySystemId: a.id, amount: 0 }]
    )
    assert.equal(held.fence.version, own.fence.version + 1)
    assert.equal(remaining.fence.version, shared.fence.version + 1)
    assert.deepEqual(
      await returnActor.mutation(api.campaigns.inventoryTransfers.transfer, {
        input: toCharacter
      }),
      returnedReceipt
    )
    assert.deepEqual(await read(), returned, 'Exact zero-unit return replay must not write.')
    const toShared: TransferCampaignInventoryInput = {
      kind: 'ITEM',
      campaignId,
      source: toCharacter.destination,
      destination: unit.owner,
      itemId: unit.itemId,
      amount: 1,
      expectedSourceVersion: held.fence.version,
      expectedDestinationVersion: remaining.fence.version,
      idempotencyKey: crypto.randomUUID()
    }
    const restoredReceipt = await players[0].client.mutation(
      api.campaigns.inventoryTransfers.transfer,
      { input: toShared }
    )
    const restored = await read(),
      restoredOwn = character(restored, 0),
      restoredShared = sharedState(restored, vehicleId)
    assert.deepEqual(restoredOwn.active, own.active)
    assert.deepEqual(restoredOwn.draft, own.draft)
    assert.deepEqual(restoredOwn.sheet.notes, own.sheet.notes)
    assert.equal(restoredOwn.fence.version, own.fence.version + 2)
    assert.deepEqual(restoredShared.items, { ...shared.items, version: shared.items.version + 2 })
    assert.deepEqual(sorted(restoredShared.currencies.page), sorted(shared.currencies.page))
    assert.equal(restoredShared.currencies.version, shared.currencies.version + 2)
    assert.deepEqual(restored.characters.slice(1), before.characters.slice(1))
    assert.deepEqual(
      restored.cargo.filter((entry) => entry.id !== vehicleId),
      before.cargo.filter((entry) => entry.id !== vehicleId)
    )
    if (vehicleId !== undefined) assert.deepEqual(restored.party, before.party)
    assert.deepEqual(restored.campaign, before.campaign)
    assert.deepEqual(restored.systems, before.systems)
    assert.deepEqual(restored.vehicles, before.vehicles)
    assert.deepEqual(weighted(restored, converted), weighted(before, converted))
    assert.equal(restored.audit.length, before.audit.length + 2)
    assert.deepEqual(
      await players[0].client.mutation(api.campaigns.inventoryTransfers.transfer, {
        input: toShared
      }),
      restoredReceipt
    )
    assert.deepEqual(await read(), restored, 'Exact zero-unit settlement replay must not write.')
  }
  const proposal = (system: CurrencySystemDto, highScale: number, baseScale = 1) => ({
    ...input(system),
    denominations: system.denominations.map((row) => ({
      ...row,
      scaleInReference: row.id === highId ? highScale : baseScale
    }))
  })
  const positiveDenominationRemoval = (system: CurrencySystemDto) => ({
    ...input(system),
    denominations: system.denominations.filter((row) => row.id !== highId)
  })
  const looseShared = (snapshot: Snapshot) => {
    const row = snapshot.party.currencies.page.find(
      (row) => belongs(row, a.id) && row.denominationId === highId && row.containerId === null
    )
    assert.ok(row)
    return row
  }
  const looseCharacter = (snapshot: Snapshot) => {
    const row = character(snapshot, 0)
      .active.state.currency.filter((group) => group.containerId === undefined)
      .flatMap((group) => group.currencies)
      .find((currency) => belongs(currency, a.id) && currency.currencyId === highId)
    assert.ok(row)
    return row
  }
  const initialLoose = looseShared(await read()).amount
  await mutate({
    kind: 'CURRENCY_ADJUST',
    denominationId: highId,
    campaignCurrencySystemId: a.id,
    amount: Number.MAX_SAFE_INTEGER - initialLoose
  })
  await refuse(
    'shared safe-range overflow',
    () => owner.mutation(api.campaigns.currencySystems.save, proposal(converted, 1, 2)),
    /Inventory amount exceeds the supported range/
  )
  await mutate({
    kind: 'CURRENCY_ADJUST',
    denominationId: highId,
    campaignCurrencySystemId: a.id,
    amount: initialLoose - Number.MAX_SAFE_INTEGER
  })
  await mutate({
    kind: 'CURRENCY_ADJUST',
    denominationId: highId,
    campaignCurrencySystemId: a.id,
    amount: 1 - initialLoose
  })
  await refuse(
    'shared fractional conversion',
    () => owner.mutation(api.campaigns.currencySystems.save, proposal(converted, 4)),
    /Currency conversion must preserve every balance exactly/
  )
  await mutate({
    kind: 'CURRENCY_ADJUST',
    denominationId: highId,
    campaignCurrencySystemId: a.id,
    amount: initialLoose - 1
  })
  const beforePromotion = await read()
  const promoted = await owner.mutation(api.campaigns.currencySystems.save, {
    ...input(currentSystem(beforePromotion, b.id)),
    isReference: true
  })
  const afterPromotion = await read()
  assertRewrite(beforePromotion, afterPromotion, b.id, promoted)
  assert.equal(currentSystem(afterPromotion, a.id).version, converted.version + 1)
  assert.equal(currentSystem(afterPromotion, a.id).isReference, false)
  const targetSystem = () => read().then((snapshot) => currentSystem(snapshot, a.id))
  await refuse(
    'positive shared denomination removal',
    async () =>
      owner.mutation(
        api.campaigns.currencySystems.save,
        positiveDenominationRemoval(await targetSystem())
      ),
    /A denomination with a positive balance cannot be removed/
  )
  await refuse(
    'positive system removal',
    async () => {
      const current = await targetSystem()
      return owner.mutation(api.campaigns.currencySystems.remove, {
        campaignId,
        systemId: a.id,
        expectedVersion: current.version
      })
    },
    /positive Character balances/
  )
  const drainShared = async (systemId: string) => {
    for (const vehicleId of sharedOwners)
      for (const row of (await coins(vehicleId)).page.filter(
        (currency) => belongs(currency, systemId) && currency.amount > 0
      ))
        await mutate(
          {
            kind: 'CURRENCY_ADJUST',
            denominationId: row.denominationId,
            campaignCurrencySystemId: systemId,
            amount: -row.amount,
            containerId: row.containerId
          },
          vehicleId
        )
  }
  await drainShared(a.id)
  const characterOnly = await read()
  for (const entry of [characterOnly.party, ...characterOnly.cargo])
    assert.equal(
      entry.currencies.page.some((row) => belongs(row, a.id) && row.amount > 0),
      false
    )
  assert.ok(
    characterOnly.party.currencies.page.some((row) => belongs(row, a.id) && row.amount === 0)
  )
  const originalCharacterLoose = looseCharacter(characterOnly).amount
  await execute(0, {
    type: 'ADJUST_CURRENCY',
    currencyId: highId,
    ...targetIdentity,
    amount: 1 - originalCharacterLoose
  })
  await refuse(
    'Character-only fractional conversion',
    async () =>
      owner.mutation(api.campaigns.currencySystems.save, proposal(await targetSystem(), 4)),
    /Character currency conversion must preserve every balance exactly/
  )
  await execute(0, {
    type: 'ADJUST_CURRENCY',
    currencyId: highId,
    ...targetIdentity,
    amount: originalCharacterLoose - 1
  })
  await execute(0, {
    type: 'ADJUST_CURRENCY',
    currencyId: highId,
    ...targetIdentity,
    amount: Number.MAX_SAFE_INTEGER - originalCharacterLoose
  })
  await refuse(
    'Character-only safe-range overflow',
    async () =>
      owner.mutation(api.campaigns.currencySystems.save, proposal(await targetSystem(), 1, 2)),
    /Character currency amount is outside the supported range/
  )
  await execute(0, {
    type: 'ADJUST_CURRENCY',
    currencyId: highId,
    ...targetIdentity,
    amount: originalCharacterLoose - Number.MAX_SAFE_INTEGER
  })
  await refuse(
    'Character-only positive denomination removal',
    async () =>
      owner.mutation(
        api.campaigns.currencySystems.save,
        positiveDenominationRemoval(await targetSystem())
      ),
    /positive Character balance cannot be removed/
  )
  await refuse(
    'Character-only positive system removal',
    async () => {
      const current = await targetSystem()
      return owner.mutation(api.campaigns.currencySystems.remove, {
        campaignId,
        systemId: a.id,
        expectedVersion: current.version
      })
    },
    /positive Character balances/
  )
  const drainCharacters = async (systemId: string) => {
    for (const index of [0, 1])
      for (const group of character(await read(), index).active.state.currency)
        for (const row of group.currencies.filter(
          (currency) => belongs(currency, systemId) && currency.amount > 0
        ))
          await execute(index, {
            type: 'ADJUST_CURRENCY',
            currencyId: row.currencyId,
            kind: 'CAMPAIGN',
            campaignCurrencySystemId: systemId,
            amount: -row.amount,
            ...(group.containerId === undefined ? {} : { containerId: group.containerId })
          })
  }
  await drainCharacters(a.id)
  const beforeRemoval = await read()
  for (const entry of beforeRemoval.characters)
    assert.ok(
      entry.active.state.currency
        .flatMap((group) => group.currencies)
        .some((row) => belongs(row, a.id) && row.amount === 0)
    )
  await owner.mutation(api.campaigns.currencySystems.remove, {
    campaignId,
    systemId: a.id,
    expectedVersion: currentSystem(beforeRemoval, a.id).version
  })
  const removed = await read()
  assertRewrite(beforeRemoval, removed, a.id, null)
  assert.deepEqual(removed.systems, [promoted])
  await drainShared(b.id)
  await drainCharacters(b.id)
  const beforeSoleRemoval = await read()
  await owner.mutation(api.campaigns.currencySystems.remove, {
    campaignId,
    systemId: b.id,
    expectedVersion: currentSystem(beforeSoleRemoval, b.id).version
  })
  const final = await read()
  assertRewrite(beforeSoleRemoval, final, b.id, null)
  assert.deepEqual(final.systems, [])
  for (const entry of final.characters)
    assert.equal(
      entry.active.state.currency
        .flatMap((group) => group.currencies)
        .some((row) => row.kind === 'CAMPAIGN'),
      false
    )
  for (const [index, entry] of [final.party, ...final.cargo].entries()) {
    const previous = [populated.party, ...populated.cargo][index]
    assert.ok(previous)
    assert.deepEqual(
      entry.items.page,
      previous.items.page,
      'Currency lifecycle cannot create, consume, move or change physical items.'
    )
    assert.deepEqual(
      entry.currencies.page.filter((row) => row.kind !== 'CAMPAIGN'),
      previous.currencies.page.filter((row) => row.kind !== 'CAMPAIGN')
    )
  }
  for (const [index, entry] of final.characters.entries()) {
    const previous = character(populated, index)
    const unrelatedGroups = previous.active.state.currency.flatMap((group) => {
      const currencies = group.currencies.filter((row) => row.kind !== 'CAMPAIGN')
      return currencies.length === 0 && group.currencies.some((row) => row.kind === 'CAMPAIGN')
        ? []
        : [{ ...group, currencies }]
    })
    assert.deepEqual(
      entry.active,
      {
        ...previous.active,
        state: { ...previous.active.state, currency: unrelatedGroups }
      },
      'All private raw state, notes, original physical items and structural intent survive the full lifecycle.'
    )
    assert.deepEqual(entry.draft, previous.draft)
    assert.deepEqual(entry.sheet.notes, previous.sheet.notes)
    assert.deepEqual(entry.sheet.inventory.items, previous.sheet.inventory.items)
    assert.deepEqual(
      entry.sheet.inventory.currencies,
      previous.sheet.inventory.currencies.filter((row) => row.kind !== 'CAMPAIGN')
    )
  }
  const captured = zeroGroups.flatMap((entry) => entry.groupIds)
  assert.equal(new Set(captured).size, captured.length)
  assert.ok(final.audit.length <= 100 && final.history.length <= 100)
  return {
    systems: { initialTarget: a, unrelated: b, withoutZero, converted, promoted },
    vehicleIds,
    zeroGroups,
    refusals,
    weightedTotals: weighted(populated, a).map(([id, value]) => ({ id, value: value.toString() })),
    finalSystems: final.systems,
    inventoryAuditEvents: final.audit.length,
    campaignHistoryEvents: final.history.length
  }
}
