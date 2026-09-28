import assert from 'node:assert/strict'
import type { FunctionReturnType } from 'convex/server'
import type {
  CampaignInventoryTransferResultDto,
  CampaignPartyInventoryMutationInput,
  CurrencySystemDto,
  InventoryOwnerRefDto,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import { resolveCharacterCurrencyIdentity } from '@artificer-toolkit/schema/shared/characterCurrency'
import { decodeCampaignInventoryAuditPage } from '@artificer-toolkit/schema/api/campaignInventoryPages'
import {
  campaignVehicleLifecyclePayloadSchema,
  type CampaignVehicleLifecycleInput
} from '@artificer-toolkit/schema/api/campaignVehicles'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'

type Owner = InventoryOwnerRefDto
type ActiveCharacter = NonNullable<
  FunctionReturnType<typeof api.characters.builder.activeCharacter>
>
type Sheet = NonNullable<FunctionReturnType<typeof api.characters.sheet.get>>
type CurrencyPage = FunctionReturnType<typeof api.campaigns.partyInventory.currencies>
type AuditPage = FunctionReturnType<typeof api.campaigns.inventoryAudit.list>
type Namespace = {
  kind: 'RULESET' | 'CAMPAIGN'
  campaignCurrencySystemId: string | null
  denominationId: string
}
type CurrencyIdentity = {
  kind?: 'RULESET' | 'CAMPAIGN'
  campaignCurrencySystemId?: string
}

async function collectPages<T>(
  load: (cursor: string | null) => Promise<{
    page: T[]
    isDone: boolean
    continueCursor: string
  }>
): Promise<T[]> {
  const rows: T[] = []
  const cursors = new Set<string>()
  let cursor: string | null = null
  while (true) {
    const result = await load(cursor)
    rows.push(...result.page)
    if (result.isDone) return rows
    assert.ok(result.continueCursor, 'An incomplete page requires a continuation cursor.')
    assert.equal(cursors.has(result.continueCursor), false, 'Pagination must advance.')
    cursors.add(result.continueCursor)
    cursor = result.continueCursor
  }
}

async function collectInventory<T>(
  load: (cursor: string | null) => Promise<{
    owner: Owner
    version: number
    page: T[]
    isDone: boolean
    continueCursor: string
  }>
) {
  let captured: { owner: Owner; version: number } | undefined
  const page = await collectPages(async (cursor) => {
    const result = await load(cursor)
    if (captured) assert.deepEqual({ owner: result.owner, version: result.version }, captured)
    else captured = { owner: result.owner, version: result.version }
    return result
  })
  assert.ok(captured, 'Inventory must return its owner and fence.')
  return { ...captured, page }
}

function exactAmount(amount: number): bigint {
  assert.ok(
    Number.isSafeInteger(amount) && amount >= 0,
    'Amounts must be nonnegative safe integers.'
  )
  return BigInt(amount)
}

function qualifiedKey(currency: CurrencyIdentity, denominationId: string): string {
  const kind = currency.kind ?? 'RULESET'
  if (kind === 'CAMPAIGN')
    assert.ok(currency.campaignCurrencySystemId, 'Campaign balances need their System.id.')
  else
    assert.equal(
      currency.campaignCurrencySystemId,
      undefined,
      'Ruleset balances cannot carry a Campaign System.id.'
    )
  return JSON.stringify([kind, currency.campaignCurrencySystemId ?? null, denominationId])
}

function namespaceKey(namespace: Namespace): string {
  return JSON.stringify([
    namespace.kind,
    namespace.campaignCurrencySystemId,
    namespace.denominationId
  ])
}

const ownerKey = (ref: Owner) => JSON.stringify(ref)
const sorted = <T>(rows: T[]): T[] =>
  [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

/**
 * Standalone native public proof, run before fixture cleanup.
 * Adds 2 Vehicles, 1 System with 2 denominations, 2 seeds, 28 transfers and 2 removals; each is replayed without another event.
 * Exact replays and refusals must add no events; existing MAX 4/3/8/100 guards remain unchanged.
 */
export async function verifyCampaignQualifiedCurrencyCustody(
  cohort: CampaignCustodyCohort
): Promise<{
  system: CurrencySystemDto
  vehicleIds: string[]
  receipts: CampaignInventoryTransferResultDto[]
}> {
  if (fighter.category !== 'BASE')
    throw new Error('Qualified custody requires the canonical base Fighter.')
  const { owner, players, campaignId, characterIds } = cohort
  const pagination = (cursor: string | null) => ({
    campaignId,
    paginationOpts: { cursor, numItems: 8 }
  })
  const listSystems = () =>
    collectPages((cursor) => owner.query(api.campaigns.currencySystems.list, pagination(cursor)))
  const listVehicles = () =>
    collectPages((cursor) => owner.query(api.campaigns.vehicles.list, pagination(cursor)))
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
  const readAudit = async (): Promise<AuditPage['events']> => {
    const events: AuditPage['events'] = []
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
      assert.ok(result.nextCursor, 'Incomplete audit requires a continuation cursor.')
      assert.equal(cursors.has(result.nextCursor), false, 'Audit pagination must advance.')
      cursors.add(result.nextCursor)
      cursor = result.nextCursor
    }
  }
  const read = async () => {
    const [campaign, systems, vehicles, partyItems, partyCurrencies, characters, audit] =
      await Promise.all([
        owner.query(api.campaigns.queries.get, { id: campaignId }),
        listSystems(),
        listVehicles(),
        readItems(),
        readCurrencies(),
        Promise.all(
          characterIds.map(async (id, index) => {
            const player = players[index]
            assert.ok(player, 'Each Character must have its own Player client.')
            const [active, sheet] = await Promise.all([
              player.client.query(api.characters.builder.activeCharacter, { id }),
              player.client.query(api.characters.sheet.get, { id })
            ])
            assert.ok(active && sheet, 'Own active Character and Sheet reads must both succeed.')
            assert.equal(sheet.meta.characterId, id)
            assert.equal(sheet.meta.viewer, 'CHARACTER_OWNER')
            return { id, active, sheet }
          })
        ),
        readAudit()
      ])
    assert.ok(campaign)
    assert.equal(partyItems.version, partyCurrencies.version)
    const cargo = await Promise.all(
      vehicles.map(async (metadata) => {
        const [items, currencies, fence] = await Promise.all([
          readItems(metadata.id),
          readCurrencies(metadata.id),
          owner.query(api.campaigns.inventoryOwners.version, {
            input: {
              campaignId,
              owner: { kind: 'VEHICLE', vehicleId: metadata.id }
            }
          })
        ])
        assert.equal(items.version, currencies.version)
        assert.equal(items.version, fence.version)
        return { id: metadata.id, items, currencies, fence }
      })
    )
    const partyFence = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
    })
    assert.equal(partyItems.version, partyFence.version)
    for (const entry of characters) {
      const index = characterIds.indexOf(entry.id)
      const player = players[index]
      assert.ok(player)
      const fence = await player.client.query(api.campaigns.inventoryOwners.version, {
        input: {
          campaignId,
          owner: { kind: 'CHARACTER', characterId: entry.id }
        }
      })
      assert.equal(entry.sheet.meta.streamVersion, fence.version)
    }
    return {
      campaign,
      systems,
      vehicles,
      partyItems,
      partyCurrencies,
      partyFence,
      characters,
      cargo,
      audit
    }
  }
  type Snapshot = Awaited<ReturnType<typeof read>>
  const initial = await read()
  assert.ok(initial.vehicles.length + 2 <= 4, 'New carts must fit the existing Vehicle bound.')
  assert.ok(initial.systems.length + 1 <= 3, 'New System must fit the existing System bound.')
  assert.ok(initial.systems.reduce((sum, entry) => sum + entry.denominations.length, 0) + 2 <= 8)
  assert.ok(
    initial.audit.length + 32 <= 100,
    'The 32 successful commands must fit the existing event bound.'
  )
  const denominationId = fighter.startingGold.currencyId
  const system = await owner.mutation(api.campaigns.currencySystems.save, {
    campaignId,
    label: 'P12 qualified custody draft',
    isReference: !initial.systems.some((entry) => entry.isReference),
    denominations: [
      {
        id: denominationId,
        label: 'Qualified',
        abbreviation: 'q',
        scaleInReference: 4
      },
      {
        id: crypto.randomUUID(),
        label: 'Reference',
        abbreviation: 'r',
        scaleInReference: 1
      }
    ]
  })
  const currentSystems = await listSystems()
  assert.deepEqual(
    currentSystems.filter((entry) => entry.id !== system.id),
    initial.systems,
    'Creating the new System must not demote or modify unrelated Systems.'
  )
  assert.equal(system.isReference, !initial.systems.some((entry) => entry.isReference))
  const vehicles: Array<FunctionReturnType<typeof api.campaigns.vehicles.create>> = []
  for (const index of [0, 1])
    vehicles.push(
      await owner.mutation(api.campaigns.vehicles.create, {
        campaignId,
        vehicleDefinitionId: cart.id,
        label: `P12 qualified cart ${index + 1}`
      })
    )
  const vehicleIds = vehicles.map((entry) => entry.id)
  assert.equal(new Set(vehicleIds).size, 2)
  for (const metadata of vehicles) assert.equal(metadata.vehicleDefinitionId, cart.id)
  const setup = await read()
  assert.deepEqual(
    setup.vehicles.filter((entry) => !vehicleIds.includes(entry.id)),
    initial.vehicles
  )
  const [vehicle0, vehicle1] = vehicles
  assert.ok(vehicle0 && vehicle1)
  const refs: [Owner, Owner, Owner, Owner, Owner] = [
    { kind: 'CHARACTER', characterId: characterIds[0] },
    { kind: 'CHARACTER', characterId: characterIds[1] },
    { kind: 'CAMPAIGN', campaignId },
    { kind: 'VEHICLE', vehicleId: vehicle0.id },
    { kind: 'VEHICLE', vehicleId: vehicle1.id }
  ]
  const namespaces: Namespace[] = [
    { kind: 'RULESET', campaignCurrencySystemId: null, denominationId },
    { kind: 'CAMPAIGN', campaignCurrencySystemId: system.id, denominationId }
  ]
  const characterState = (snapshot: Snapshot, ref: Extract<Owner, { kind: 'CHARACTER' }>) => {
    const entry = snapshot.characters.find((candidate) => candidate.id === ref.characterId)
    assert.ok(entry)
    return entry
  }
  const sharedState = (snapshot: Snapshot, ref: Exclude<Owner, { kind: 'CHARACTER' }>) => {
    if (ref.kind === 'CAMPAIGN')
      return {
        items: snapshot.partyItems,
        currencies: snapshot.partyCurrencies,
        fence: snapshot.partyFence
      }
    const entry = snapshot.cargo.find((candidate) => candidate.id === ref.vehicleId)
    assert.ok(entry)
    return entry
  }
  const balances = (snapshot: Snapshot, ref: Owner) =>
    ref.kind === 'CHARACTER'
      ? characterState(snapshot, ref).active.state.currency.flatMap((group) =>
          group.currencies.map((currency) => ({
            key: qualifiedKey(currency, currency.currencyId),
            amount: exactAmount(currency.amount)
          }))
        )
      : sharedState(snapshot, ref).currencies.page.map((currency) => ({
          key: qualifiedKey(currency, currency.denominationId),
          amount: exactAmount(currency.amount)
        }))
  const amount = (snapshot: Snapshot, ref: Owner, namespace: Namespace) =>
    balances(snapshot, ref)
      .filter((balance) => balance.key === namespaceKey(namespace))
      .reduce((sum, balance) => sum + balance.amount, 0n)
  const allTotals = (snapshot: Snapshot) => {
    const totals = new Map<string, bigint>()
    const owners: Owner[] = [
      refs[0],
      refs[1],
      refs[2],
      ...snapshot.vehicles.map((entry): Owner => ({ kind: 'VEHICLE', vehicleId: entry.id }))
    ]
    for (const ref of owners)
      for (const balance of balances(snapshot, ref))
        totals.set(balance.key, (totals.get(balance.key) ?? 0n) + balance.amount)
    return [...totals].sort(([a], [b]) => a.localeCompare(b))
  }
  const ownerVersion = (snapshot: Snapshot, ref: Owner) =>
    ref.kind === 'CHARACTER'
      ? characterState(snapshot, ref).sheet.meta.streamVersion
      : sharedState(snapshot, ref).items.version
  const withoutQualifiedGroups = (character: ActiveCharacter, namespace: Namespace) =>
    character.state.currency.flatMap((group) => {
      const currencies = group.currencies.filter(
        (currency) => qualifiedKey(currency, currency.currencyId) !== namespaceKey(namespace)
      )
      return currencies.length === 0 ? [] : [{ ...group, currencies }]
    })
  const withoutQualifiedSheet = (sheet: Sheet, namespace: Namespace) => ({
    ...sheet,
    meta: { ...sheet.meta, streamVersion: 0 },
    inventory: {
      ...sheet.inventory,
      currencies: sheet.inventory.currencies.filter(
        (currency) => qualifiedKey(currency, currency.currencyId) !== namespaceKey(namespace)
      ),
      ...(sheet.inventory.containers === undefined
        ? {}
        : {
            containers: sheet.inventory.containers.map((container) => ({
              ...container,
              currencies: container.currencies.filter(
                (currency) =>
                  qualifiedKey(currency, currency.currencyId) !== namespaceKey(namespace)
              )
            }))
          })
    }
  })
  const sharedTemplates = new Map<string, CurrencyPage['page'][number]>()
  const assertChangedOwner = (
    before: Snapshot,
    after: Snapshot,
    ref: Owner,
    namespace: Namespace,
    delta: bigint
  ) => {
    assert.equal(amount(after, ref, namespace), amount(before, ref, namespace) + delta)
    assert.equal(ownerVersion(after, ref), ownerVersion(before, ref) + 1)
    if (ref.kind === 'CHARACTER') {
      const previous = characterState(before, ref)
      const next = characterState(after, ref)
      const { currency: previousCurrency, ...previousState } = previous.active.state
      const { currency: nextCurrency, ...nextState } = next.active.state
      assert.deepEqual(
        { ...next.active, state: nextState },
        { ...previous.active, state: previousState },
        'Character items, private notes and all other authored/play state must remain literal.'
      )
      assert.deepEqual(
        withoutQualifiedGroups(next.active, namespace),
        withoutQualifiedGroups(previous.active, namespace)
      )
      const expectedCurrency = structuredClone(previousCurrency)
      const identity = {
        currencyId: namespace.denominationId,
        kind: namespace.kind,
        ...(namespace.campaignCurrencySystemId === null
          ? {}
          : { campaignCurrencySystemId: namespace.campaignCurrencySystemId })
      }
      if (delta < 0n) {
        let remaining = -delta
        const changedGroups = new Set<string>()
        for (const group of expectedCurrency)
          for (const currency of group.currencies) {
            if (
              remaining === 0n ||
              qualifiedKey(currency, currency.currencyId) !== namespaceKey(namespace)
            )
              continue
            const available = exactAmount(currency.amount)
            const used = available < remaining ? available : remaining
            if (used === 0n) continue
            Object.assign(currency, identity, {
              amount: Number(available - used)
            })
            remaining -= used
            changedGroups.add(group.id)
          }
        assert.equal(remaining, 0n)
        for (let index = expectedCurrency.length - 1; index >= 0; index--) {
          const group = expectedCurrency[index]
          assert.ok(group)
          if (!changedGroups.has(group.id)) continue
          group.currencies = group.currencies.filter(
            (currency) =>
              currency.amount !== 0 ||
              qualifiedKey(currency, currency.currencyId) !== namespaceKey(namespace)
          )
          if (group.currencies.length === 0) expectedCurrency.splice(index, 1)
        }
      } else {
        const slot = expectedCurrency.flatMap((group) =>
          !group.containerId
            ? group.currencies.filter(
                (currency) =>
                  qualifiedKey(currency, currency.currencyId) === namespaceKey(namespace)
              )
            : []
        )[0]
        if (slot) {
          const increased = exactAmount(slot.amount) + delta
          assert.ok(increased <= BigInt(Number.MAX_SAFE_INTEGER))
          Object.assign(slot, identity, { amount: Number(increased) })
        } else {
          let loose = expectedCurrency.find((group) => !group.containerId)
          if (!loose) {
            const created = nextCurrency.filter(
              (group) => !previousCurrency.some((old) => old.id === group.id)
            )
            assert.equal(
              created.length,
              1,
              'Receiving currency may create exactly one loose group.'
            )
            const group = created[0]
            assert.ok(group)
            assert.equal(group.containerId, undefined)
            loose = { id: group.id, currencies: [] }
            expectedCurrency.push(loose)
          }
          assert.ok(delta <= BigInt(Number.MAX_SAFE_INTEGER))
          loose.currencies.push({ ...identity, amount: Number(delta) })
        }
      }
      assert.deepEqual(
        nextCurrency,
        expectedCurrency,
        'Only the exact qualified amount and necessary empty/new group changes may occur.'
      )
      for (const group of nextCurrency) {
        const oldGroup = previousCurrency.find((candidate) => candidate.id === group.id)
        if (oldGroup)
          assert.deepEqual({ ...group, currencies: [] }, { ...oldGroup, currencies: [] })
        else {
          assert.equal(
            group.containerId,
            undefined,
            'A new receiving currency group must be loose.'
          )
          assert.ok(
            group.currencies.every(
              (currency) => qualifiedKey(currency, currency.currencyId) === namespaceKey(namespace)
            )
          )
        }
      }
      assert.deepEqual(
        withoutQualifiedSheet(next.sheet, namespace),
        withoutQualifiedSheet(previous.sheet, namespace),
        'Own Sheet items/private state/other currencies must remain literal.'
      )
      const sheetAmount = next.sheet.inventory.currencies
        .filter(
          (currency) => qualifiedKey(currency, currency.currencyId) === namespaceKey(namespace)
        )
        .reduce((sum, currency) => sum + exactAmount(currency.amount), 0n)
      assert.equal(
        sheetAmount,
        amount(after, ref, namespace),
        'Builder and own Sheet must agree exactly.'
      )
      const expectedSheetCurrencies = nextCurrency.flatMap((group) =>
        group.currencies
          .filter(
            (currency) => qualifiedKey(currency, currency.currencyId) === namespaceKey(namespace)
          )
          .map((currency) => {
            const identity = resolveCharacterCurrencyIdentity(
              currency,
              next.sheet.reference.currencyOptions,
              'PRESERVE'
            )
            const option = next.sheet.reference.currencyOptions.find(
              (candidate) => qualifiedKey(candidate, candidate.id) === namespaceKey(namespace)
            )
            assert.ok(option, 'Transferred qualified currency must have its exact Sheet option.')
            return {
              ...identity,
              label: option.label,
              amount: currency.amount,
              ...(group.containerId === undefined ? {} : { containerId: group.containerId })
            }
          })
      )
      assert.deepEqual(
        next.sheet.inventory.currencies.filter(
          (currency) => qualifiedKey(currency, currency.currencyId) === namespaceKey(namespace)
        ),
        expectedSheetCurrencies,
        'Own Sheet must retain exact qualified labels, placement and amounts.'
      )
      for (const container of next.sheet.inventory.containers ?? [])
        assert.deepEqual(
          container.currencies,
          next.sheet.inventory.currencies.filter(
            (currency) => currency.containerId === container.id
          ),
          'Every Sheet container must retain its complete literal currency projection.'
        )
    } else {
      const previous = sharedState(before, ref)
      const next = sharedState(after, ref)
      assert.deepEqual(
        { ...next.items, version: previous.items.version },
        previous.items,
        'Every item must remain literal.'
      )
      assert.deepEqual(next.fence, {
        ...previous.fence,
        version: previous.fence.version + 1
      })
      const unrelated = (rows: CurrencyPage['page']) =>
        rows.filter(
          (currency) => qualifiedKey(currency, currency.denominationId) !== namespaceKey(namespace)
        )
      assert.deepEqual(
        unrelated(next.currencies.page),
        unrelated(previous.currencies.page),
        'Other qualified currencies must remain literal.'
      )
      const expected = structuredClone(previous.currencies.page)
      if (delta < 0n) {
        let remaining = -delta
        for (let index = 0; index < expected.length && remaining > 0n; ) {
          const currency = expected[index]
          assert.ok(currency)
          if (qualifiedKey(currency, currency.denominationId) !== namespaceKey(namespace)) {
            index++
            continue
          }
          const available = exactAmount(currency.amount)
          const used = available < remaining ? available : remaining
          remaining -= used
          if (used > 0n && used === available) expected.splice(index, 1)
          else {
            currency.amount = Number(available - used)
            index++
          }
        }
        assert.equal(remaining, 0n)
      } else {
        const loose = expected.filter(
          (currency) =>
            qualifiedKey(currency, currency.denominationId) === namespaceKey(namespace) &&
            currency.containerId === null
        )
        assert.ok(
          loose.length <= 1,
          'This bounded fixture must have at most one loose qualified receiving balance.'
        )
        const slot = loose[0]
        if (slot) {
          const increased = exactAmount(slot.amount) + delta
          assert.ok(increased <= BigInt(Number.MAX_SAFE_INTEGER))
          slot.amount = Number(increased)
        } else {
          const template = sharedTemplates.get(namespaceKey(namespace))
          if (template)
            expected.push({
              ...template,
              amount: Number(delta),
              containerId: null
            })
          else {
            // The first public seed establishes the qualified denomination's presented metadata.
            const created = next.currencies.page.filter(
              (currency) =>
                qualifiedKey(currency, currency.denominationId) === namespaceKey(namespace)
            )
            assert.equal(created.length, 1)
            const currency = created[0]
            assert.ok(currency)
            assert.equal(currency.kind, namespace.kind)
            assert.equal(
              currency.campaignCurrencySystemId ?? null,
              namespace.campaignCurrencySystemId
            )
            assert.equal(currency.containerId, null)
            assert.equal(exactAmount(currency.amount), delta)
            expected.push(structuredClone(currency))
          }
        }
      }
      assert.deepEqual(
        sorted(next.currencies.page),
        sorted(expected),
        'Shared settlement may change only the exact qualified amount and required empty/new balance rows.'
      )
      assert.deepEqual(next.currencies.owner, previous.currencies.owner)
      assert.equal(next.currencies.version, previous.currencies.version + 1)
      for (const currency of next.currencies.page.filter(
        (entry) => qualifiedKey(entry, entry.denominationId) === namespaceKey(namespace)
      )) {
        const slot = previous.currencies.page.find(
          (entry) =>
            qualifiedKey(entry, entry.denominationId) === namespaceKey(namespace) &&
            entry.containerId === currency.containerId
        )
        if (slot) assert.deepEqual({ ...currency, amount: 0 }, { ...slot, amount: 0 })
        else assert.equal(currency.containerId, null, 'A new receiving balance must be loose.')
      }
    }
  }
  const assertStateChange = (
    before: Snapshot,
    after: Snapshot,
    namespace: Namespace,
    changes: Array<[Owner, bigint]>
  ) => {
    assert.deepEqual(after.campaign, before.campaign)
    assert.deepEqual(after.systems, before.systems)
    assert.deepEqual(
      after.vehicles,
      before.vehicles,
      'Currency transfers must not change Vehicle metadata.'
    )
    for (const [ref, delta] of changes) assertChangedOwner(before, after, ref, namespace, delta)
    const changed = new Set(changes.map(([ref]) => ownerKey(ref)))
    for (const entry of before.characters)
      if (!changed.has(ownerKey({ kind: 'CHARACTER', characterId: entry.id })))
        assert.deepEqual(
          after.characters.find((candidate) => candidate.id === entry.id),
          entry
        )
    if (!changed.has(ownerKey(refs[2]))) {
      assert.deepEqual(after.partyItems, before.partyItems)
      assert.deepEqual(after.partyCurrencies, before.partyCurrencies)
      assert.deepEqual(after.partyFence, before.partyFence)
    }
    for (const entry of before.cargo)
      if (!changed.has(ownerKey({ kind: 'VEHICLE', vehicleId: entry.id })))
        assert.deepEqual(
          after.cargo.find((candidate) => candidate.id === entry.id),
          entry
        )
  }
  const assertReceipt = (
    before: Snapshot,
    after: Snapshot,
    eventId: string,
    kind: string,
    actorUserId: string
  ) => {
    assert.equal(after.audit.length, before.audit.length + 1)
    assert.deepEqual(
      after.audit.filter((event) => event.id !== eventId),
      before.audit,
      'Existing receipts must remain literal.'
    )
    const matches = after.audit.filter((event) => event.id === eventId)
    assert.equal(matches.length, 1, 'A successful command must publish exactly one receipt.')
    const event = matches[0]
    assert.ok(event)
    assert.equal(event.kind, kind)
    assert.equal(event.actorUserId, actorUserId)
    assert.equal(event.campaignId, campaignId)
    const payload = decodeCampaignInventoryAuditPage({
      events: [event],
      nextCursor: null
    }).events[0]?.payload
    assert.ok(payload && typeof payload === 'object' && !Array.isArray(payload))
    return { event, payload }
  }
  const sourcePlayerIndex = (source: Extract<Owner, { kind: 'CHARACTER' }>): 0 | 1 => {
    assert.ok(
      source.characterId === characterIds[0] || source.characterId === characterIds[1],
      'Sources must belong to this exact cohort.'
    )
    return source.characterId === characterIds[0] ? 0 : 1
  }
  const actorFor = (source: Owner): DevelopmentClient =>
    source.kind === 'CHARACTER' ? players[sourcePlayerIndex(source)].client : owner
  const actorIdFor = (source: Owner): string =>
    source.kind === 'CHARACTER'
      ? cohort.playerUserIds[sourcePlayerIndex(source)]
      : cohort.ownerUserId
  const receipts: CampaignInventoryTransferResultDto[] = []
  const succeeded: Array<{
    actor: DevelopmentClient
    input: Extract<TransferCampaignInventoryInput, { kind: 'CURRENCY' }>
  }> = []
  const transfer = async (source: Owner, destination: Owner, namespace: Namespace) => {
    const actor = actorFor(source)
    const fences = await actor.query(api.campaigns.inventoryOwners.transferVersions, {
      input: { campaignId, source, destination }
    })
    const before = await read()
    assert.equal(fences.sourceVersion, ownerVersion(before, source))
    assert.equal(fences.destinationVersion, ownerVersion(before, destination))
    const input: Extract<TransferCampaignInventoryInput, { kind: 'CURRENCY' }> = {
      kind: 'CURRENCY',
      campaignId,
      source,
      destination,
      denominationId,
      campaignCurrencySystemId: namespace.campaignCurrencySystemId,
      amount: 1,
      expectedSourceVersion: fences.sourceVersion,
      expectedDestinationVersion: fences.destinationVersion,
      idempotencyKey: crypto.randomUUID()
    }
    const result = await actor.mutation(api.campaigns.inventoryTransfers.transfer, { input })
    const after = await read()
    assertStateChange(before, after, namespace, [
      [source, -1n],
      [destination, 1n]
    ])
    assert.deepEqual(
      allTotals(after),
      allTotals(before),
      'All qualified denominations must conserve exact totals.'
    )
    const { event, payload } = assertReceipt(
      before,
      after,
      result.eventId,
      'CUSTODY_TRANSFER',
      actorIdFor(source)
    )
    assert.equal(
      event.subjectCharacterId,
      source.kind === 'CHARACTER'
        ? source.characterId
        : destination.kind === 'CHARACTER'
          ? destination.characterId
          : null
    )
    assert.deepEqual(payload.source, source)
    assert.deepEqual(payload.destination, destination)
    assert.equal(payload.kind, 'CURRENCY')
    assert.equal(payload.action, 'CUSTODY_TRANSFER')
    assert.equal(payload.denominationId, denominationId)
    assert.equal(payload.campaignCurrencySystemId ?? null, namespace.campaignCurrencySystemId)
    assert.equal(payload.amount, 1)
    assert.equal(payload.beforeAmount, amount(before, source, namespace).toString())
    assert.equal(payload.afterSourceAmount, amount(after, source, namespace).toString())
    assert.equal(payload.beforeDestinationAmount, amount(before, destination, namespace).toString())
    assert.equal(payload.afterDestinationAmount, amount(after, destination, namespace).toString())
    const nextFences = await actor.query(api.campaigns.inventoryOwners.transferVersions, {
      input: { campaignId, source, destination }
    })
    assert.deepEqual(nextFences, {
      sourceVersion: fences.sourceVersion + 1,
      destinationVersion: fences.destinationVersion + 1
    })
    assert.deepEqual(
      await actor.mutation(api.campaigns.inventoryTransfers.transfer, {
        input
      }),
      result
    )
    assert.deepEqual(await read(), after, 'Exact transfer replay must cause literally no mutation.')
    receipts.push(result)
    succeeded.push({ actor, input })
  }
  const pairs: Array<[Owner, Owner]> = [
    [refs[0], refs[1]],
    [refs[1], refs[0]],
    [refs[0], refs[2]],
    [refs[2], refs[0]],
    [refs[0], refs[3]],
    [refs[3], refs[0]],
    [refs[2], refs[3]],
    [refs[3], refs[2]],
    [refs[3], refs[4]],
    [refs[4], refs[3]]
  ]
  assert.equal(pairs.length, 10)
  for (const namespace of namespaces) {
    const before = await read()
    const seed: CampaignPartyInventoryMutationInput = {
      kind: 'CURRENCY_ADJUST',
      campaignId,
      denominationId,
      campaignCurrencySystemId: namespace.campaignCurrencySystemId,
      amount: 20,
      expectedOwnerVersion: before.partyItems.version,
      idempotencyKey: crypto.randomUUID()
    }
    const receipt = await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: seed
    })
    const after = await read()
    assertStateChange(before, after, namespace, [[refs[2], 20n]])
    const { payload } = assertReceipt(
      before,
      after,
      receipt.eventId,
      'PARTY_CURRENCY_ADJUST',
      cohort.ownerUserId
    )
    assert.equal(payload.action, 'CURRENCY_ADJUST')
    assert.equal(payload.denominationId, denominationId)
    assert.equal(payload.campaignCurrencySystemId ?? null, namespace.campaignCurrencySystemId)
    const template = after.partyCurrencies.page.find(
      (currency) =>
        qualifiedKey(currency, currency.denominationId) === namespaceKey(namespace) &&
        currency.containerId === null
    )
    assert.ok(template)
    sharedTemplates.set(namespaceKey(namespace), structuredClone(template))
    assert.deepEqual(
      await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: seed
      }),
      receipt
    )
    assert.deepEqual(await read(), after, 'Seed replay must cause literally no mutation.')
    for (const destination of [refs[0], refs[1], refs[3], refs[4]])
      await transfer(refs[2], destination, namespace)
    for (const [source, destination] of pairs) await transfer(source, destination, namespace)
  }
  assert.equal(receipts.length, 28)
  assert.equal(new Set(receipts.map((receipt) => receipt.eventId)).size, 28)
  const rejectWithoutMutation = async (
    actor: DevelopmentClient,
    input: TransferCampaignInventoryInput,
    error: RegExp
  ) => {
    const before = await read()
    await assert.rejects(
      () => actor.mutation(api.campaigns.inventoryTransfers.transfer, { input }),
      error
    )
    assert.deepEqual(await read(), before, 'Rejected commands must cause literally no mutation.')
  }
  for (const namespace of namespaces) {
    const actor = players[0].client
    const fences = await actor.query(api.campaigns.inventoryOwners.transferVersions, {
      input: { campaignId, source: refs[0], destination: refs[1] }
    })
    const refusal: Extract<TransferCampaignInventoryInput, { kind: 'CURRENCY' }> = {
      kind: 'CURRENCY',
      campaignId,
      source: refs[0],
      destination: refs[1],
      denominationId,
      campaignCurrencySystemId: namespace.campaignCurrencySystemId,
      amount: 1,
      expectedSourceVersion: fences.sourceVersion,
      expectedDestinationVersion: fences.destinationVersion,
      idempotencyKey: crypto.randomUUID()
    }
    await rejectWithoutMutation(players[1].client, refusal, /own|permission|authorized|assigned/i)
    assert.ok(fences.sourceVersion > 0 && fences.destinationVersion > 0)
    await rejectWithoutMutation(
      actor,
      {
        ...refusal,
        expectedSourceVersion: fences.sourceVersion - 1,
        idempotencyKey: crypto.randomUUID()
      },
      /changed before this transfer/i
    )
    await rejectWithoutMutation(
      actor,
      {
        ...refusal,
        expectedDestinationVersion: fences.destinationVersion - 1,
        idempotencyKey: crypto.randomUUID()
      },
      /changed before this transfer/i
    )
    const actual = succeeded.find(
      (entry) =>
        entry.input.source.kind === 'CHARACTER' &&
        entry.input.source.characterId === characterIds[0] &&
        entry.input.destination.kind === 'CHARACTER' &&
        entry.input.campaignCurrencySystemId === namespace.campaignCurrencySystemId
    )
    assert.ok(
      actual,
      'Changed-tuple replay requires an actual successful command UUID and original fences.'
    )
    await rejectWithoutMutation(
      actual.actor,
      {
        ...actual.input,
        campaignCurrencySystemId: namespace.campaignCurrencySystemId === null ? system.id : null
      },
      /command ID was already used with different input/i
    )
  }
  const beforeCleanup = await read()
  for (const vehicleId of vehicleIds) {
    const before = await read()
    const metadata = before.vehicles.find((entry) => entry.id === vehicleId)
    const cargo = before.cargo.find((entry) => entry.id === vehicleId)
    assert.ok(metadata && cargo)
    assert.equal(metadata.vehicleDefinitionId, cart.id)
    const removal: CampaignVehicleLifecycleInput = {
      campaignId,
      vehicleId,
      action: 'REMOVE_RETURN_CARGO',
      expectedVersion: metadata.version,
      expectedInventoryVersion: cargo.items.version,
      expectedPartyInventoryVersion: before.partyItems.version,
      idempotencyKey: crypto.randomUUID()
    }
    const result = await owner.mutation(api.campaigns.vehicles.lifecycle, {
      input: removal
    })
    const after = await read()
    assert.deepEqual(after.campaign, before.campaign)
    assert.deepEqual(after.systems, before.systems)
    assert.deepEqual(
      after.characters,
      before.characters,
      'Removal must preserve literal own Builder/Sheet/private state.'
    )
    assert.deepEqual(
      after.vehicles,
      before.vehicles.filter((entry) => entry.id !== vehicleId)
    )
    assert.deepEqual(
      after.cargo,
      before.cargo.filter((entry) => entry.id !== vehicleId),
      'Every unrelated Vehicle and cargo must remain literal.'
    )
    assert.deepEqual(
      sorted(after.partyItems.page),
      sorted([...before.partyItems.page, ...cargo.items.page]),
      'Return must preserve every complete item row.'
    )
    assert.equal(after.partyItems.version, before.partyItems.version + 1)
    assert.equal(after.partyCurrencies.version, before.partyCurrencies.version + 1)
    assert.deepEqual(after.partyFence, {
      ...before.partyFence,
      version: before.partyFence.version + 1
    })
    assert.deepEqual(after.partyItems.owner, before.partyItems.owner)
    assert.deepEqual(after.partyCurrencies.owner, before.partyCurrencies.owner)
    // These new carts only receive loose balances through this helper's public transfers.
    assert.ok(cargo.items.page.length === 0)
    assert.ok(cargo.currencies.page.every((currency) => currency.containerId === null))
    const expectedCurrencies = structuredClone(before.partyCurrencies.page)
    for (const currency of cargo.currencies.page) {
      const key = qualifiedKey(currency, currency.denominationId)
      const destination = expectedCurrencies.find(
        (entry) => qualifiedKey(entry, entry.denominationId) === key && entry.containerId === null
      )
      if (destination) {
        assert.deepEqual(
          { ...currency, amount: 0 },
          { ...destination, amount: 0 },
          'A merge must retain qualified denomination metadata.'
        )
        const merged = exactAmount(destination.amount) + exactAmount(currency.amount)
        assert.ok(merged <= BigInt(Number.MAX_SAFE_INTEGER))
        destination.amount = Number(merged)
      } else expectedCurrencies.push(structuredClone(currency))
    }
    assert.deepEqual(
      sorted(after.partyCurrencies.page),
      sorted(expectedCurrencies),
      'Return must preserve all qualified balances and unrelated literal rows.'
    )
    assert.deepEqual(
      allTotals(after),
      allTotals(before),
      'Removal must be lossless across all owners and namespaces.'
    )
    const { payload } = assertReceipt(
      before,
      after,
      result.eventId,
      'VEHICLE_LIFECYCLE',
      cohort.ownerUserId
    )
    const sealed = campaignVehicleLifecyclePayloadSchema.parse(payload)
    assert.equal(sealed.action, 'REMOVE_RETURN_CARGO')
    assert.ok(sealed.action === 'REMOVE_RETURN_CARGO')
    assert.deepEqual(sealed, {
      action: 'REMOVE_RETURN_CARGO',
      vehicleId,
      vehicleDefinitionId: cart.id,
      transferredTopLevelItemIds: cargo.items.page
        .filter((entry) => entry.containerId === null)
        .map((entry) => entry.id)
        .sort(),
      transferredCurrencyGroupIds: [],
      sourceInventoryVersion: cargo.items.version + 1,
      destinationInventoryVersion: before.partyItems.version + 1
    })
    assert.deepEqual(
      await owner.mutation(api.campaigns.vehicles.lifecycle, {
        input: removal
      }),
      result
    )
    assert.deepEqual(await read(), after, 'Sealed removal replay must cause literally no mutation.')
    await assert.rejects(
      () =>
        owner.mutation(api.campaigns.vehicles.lifecycle, {
          input: { ...removal, expectedVersion: removal.expectedVersion + 1 }
        }),
      /command ID was already used with different input/i
    )
    assert.deepEqual(await read(), after, 'Changed sealed removal replay must not mutate.')
  }
  const final = await read()
  assert.deepEqual(
    final.vehicles.filter((entry) => vehicleIds.includes(entry.id)),
    [],
    'Complete Vehicle pagination must prove both new IDs absent.'
  )
  assert.deepEqual(final.vehicles, initial.vehicles)
  assert.deepEqual(final.characters, beforeCleanup.characters)
  assert.deepEqual(allTotals(final), allTotals(beforeCleanup))
  assert.equal(final.audit.length, setup.audit.length + 32)
  return { system, vehicleIds, receipts }
}
