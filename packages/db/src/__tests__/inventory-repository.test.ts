import { describe, expect, it } from 'vitest'
import {
  Kysely,
  PostgresDialect,
  type PostgresPool,
  type PostgresPoolClient,
  type PostgresQueryResult
} from 'kysely'
import type { Database } from '#types'
import { createInventoryRepository, type InventoryItem } from '../repositories/inventory.js'

interface CapturedQuery {
  sql: string
  parameters: readonly unknown[]
}

function createTestDatabase(responses: Array<readonly Record<string, unknown>[]>) {
  const queries: CapturedQuery[] = []
  const client = {
    async query<Row>(statement: string, parameters: readonly unknown[]) {
      queries.push({ sql: statement, parameters })
      const rows = responses.shift() ?? []
      return {
        command: statement.trimStart().split(/\s/, 1)[0]?.toUpperCase() ?? 'SELECT',
        rowCount: rows.length,
        rows: rows as Row[]
      } as PostgresQueryResult<Row>
    },
    release() {}
  } as unknown as PostgresPoolClient
  const pool: PostgresPool = {
    async connect() {
      return client
    },
    async end() {}
  }
  return {
    db: new Kysely<Database>({ dialect: new PostgresDialect({ pool }) }),
    queries
  }
}

const ownerRow = {
  id: '00000000-0000-0000-0000-000000000001',
  kind: 'CHARACTER',
  character_id: '00000000-0000-0000-0000-000000000011',
  campaign_id: null,
  version: 2,
  created_at: '2026-08-06T00:00:00.000Z',
  updated_at: '2026-08-06T00:00:00.000Z'
}

const itemRow = {
  id: '00000000-0000-0000-0000-000000000101',
  owner_id: ownerRow.id,
  equipment_id: '00000000-0000-0000-0000-000000000201',
  equipment_label: 'Rope',
  capacity_amount: null,
  capacity_unit: null,
  quantity: 5,
  container_id: '00000000-0000-0000-0000-000000000301',
  custom_name: 'Climbing rope',
  notes: null,
  equipped: true,
  attuned: true,
  placement_kind: 'CREATURE',
  placement_id: '00000000-0000-0000-0000-000000000401',
  created_at: '2026-08-06T00:00:00.000Z',
  updated_at: '2026-08-06T00:00:00.000Z'
}

describe('inventory repository transfer primitives', () => {
  it('keeps same-denomination balances separate by their currency containers', async () => {
    const bagA = '00000000-0000-0000-0000-000000000301'
    const bagB = '00000000-0000-0000-0000-000000000302'
    const balance = {
      owner_id: ownerRow.id,
      ruleset_currency_id: '00000000-0000-0000-0000-000000000501',
      campaign_denomination_id: null,
      ruleset_system_id: '00000000-0000-0000-0000-000000000601',
      ruleset_label: 'Gold',
      ruleset_abbreviation: 'gp',
      campaign_system_id: null,
      campaign_label: null,
      campaign_abbreviation: null,
      campaign_scale: null
    }
    const { db, queries } = createTestDatabase([
      [ownerRow],
      [{ ...itemRow, capacity_amount: 30, capacity_unit: 'POUNDS' }],
      [
        { ...balance, id: 'balance-a', group_id: 'group-a', container_item_id: bagA, amount: '3' },
        { ...balance, id: 'balance-b', group_id: 'group-b', container_item_id: bagB, amount: '5' }
      ]
    ])

    const inventory = await createInventoryRepository(db).getInventoryByOwnerId(ownerRow.id)

    expect(inventory?.items[0]).toMatchObject({ isContainer: true })
    expect(inventory?.currencies).toMatchObject([
      { amount: 3n, containerId: bagA },
      { amount: 5n, containerId: bagB }
    ])
    expect(queries[2]?.sql).toContain('inventory_currency_groups')
  })

  it('locks owners once in deterministic UUID order', async () => {
    const ownerB = '00000000-0000-0000-0000-000000000002'
    const { db, queries } = createTestDatabase([[ownerRow]])

    await createInventoryRepository(db).lockOwners([ownerB, ownerRow.id, ownerB])

    expect(queries[0]?.sql).toContain('order by "id" asc for update')
    expect(queries[0]?.parameters).toEqual([ownerRow.id, ownerB])
  })

  it('treats child items and contained currency as container contents', async () => {
    const { db, queries } = createTestDatabase([[{ exists: true }]])

    await expect(
      createInventoryRepository(db).hasContainerContents(ownerRow.id, itemRow.id)
    ).resolves.toBe(true)
    expect(queries[0]?.sql).toContain('from inventory_items')
    expect(queries[0]?.sql).toContain('from inventory_currency_groups')
  })

  it('moves a full stack under the same id and clears positional state', async () => {
    const destinationOwnerId = '00000000-0000-0000-0000-000000000002'
    const movedRow = {
      ...itemRow,
      owner_id: destinationOwnerId,
      container_id: null,
      equipped: false,
      attuned: false,
      placement_kind: null,
      placement_id: null
    }
    const { db, queries } = createTestDatabase([[movedRow]])

    const moved = await createInventoryRepository(db).moveItemStack({
      sourceOwnerId: ownerRow.id,
      destinationOwnerId,
      itemId: itemRow.id
    })

    expect(moved).toMatchObject({
      id: itemRow.id,
      ownerId: destinationOwnerId,
      containerId: null,
      equipped: false,
      attuned: false,
      placementKind: null,
      placementId: null
    })
    expect(queries[0]?.sql).toContain('update "inventory_items" set "owner_id" = $1')
    expect(queries[0]?.sql).not.toContain('set "id"')
  })

  it('decrements the source and creates a distinct cleared stack for a partial move', async () => {
    const sourceAfter = { ...itemRow, quantity: 3 }
    const destinationOwnerId = '00000000-0000-0000-0000-000000000002'
    const destinationRow = {
      ...itemRow,
      id: '00000000-0000-0000-0000-000000000102',
      owner_id: destinationOwnerId,
      quantity: 2,
      container_id: null,
      equipped: false,
      attuned: false,
      placement_kind: null,
      placement_id: null
    }
    const { db, queries } = createTestDatabase([[sourceAfter], [destinationRow]])
    const repository = createInventoryRepository(db)

    const source = await repository.decrementItemStack({
      ownerId: ownerRow.id,
      itemId: itemRow.id,
      quantity: 2
    })
    const destination = await repository.insertTransferredItem({
      destinationOwnerId,
      source: source as InventoryItem,
      quantity: 2
    })

    expect(source?.quantity).toBe(3)
    expect(destination).toMatchObject({
      id: destinationRow.id,
      quantity: 2,
      containerId: null,
      equipped: false,
      attuned: false,
      placementKind: null,
      placementId: null
    })
    expect(destination.id).not.toBe(source?.id)
    expect(queries[0]?.sql).toContain('and quantity > $4')
    expect(queries[1]?.sql).toContain('insert into "inventory_items"')
  })

  it('writes party items to canonical inventory rows', async () => {
    const { db, queries } = createTestDatabase([[itemRow]])

    const inserted = await createInventoryRepository(db).insertPartyItem({
      ownerId: ownerRow.id,
      equipmentId: itemRow.equipment_id,
      quantity: 2
    })

    expect(inserted).toMatchObject({
      id: itemRow.id,
      ownerId: ownerRow.id,
      quantity: itemRow.quantity
    })
    expect(queries[0]?.sql).toContain('insert into "inventory_items"')
  })

  it('lists only owner-visible inventory audit events with the inventory kind filter', async () => {
    const event = {
      id: '00000000-0000-0000-0000-000000000901',
      campaign_id: '00000000-0000-0000-0000-000000000902',
      actor_user_id: ownerRow.character_id,
      subject_user_id: null,
      subject_character_id: null,
      kind: 'PARTY_ITEM_ADD',
      visibility: 'OWNER',
      payload: { beforeQuantity: 0, afterQuantity: 1 },
      idempotency_key: '00000000-0000-0000-0000-000000000903',
      created_at: new Date('2026-08-06T00:00:00.000Z')
    }
    const { db, queries } = createTestDatabase([[event]])

    const page = await createInventoryRepository(db).listInventoryAuditEvents({
      campaignId: event.campaign_id,
      limit: 50
    })

    expect(page.events).toHaveLength(1)
    expect(page.events[0]).toMatchObject({
      kind: 'PARTY_ITEM_ADD',
      visibility: 'OWNER',
      createdAt: '2026-08-06T00:00:00.000Z'
    })
    expect(queries[0]?.sql).toContain('"visibility" = $2')
    expect(queries[0]?.sql).toContain('"kind" in')
  })
})

describe('inventory repository currency primitives', () => {
  it('decrements deterministic balance groups without losing remainder', async () => {
    const balanceBase = {
      owner_id: ownerRow.id,
      ruleset_currency_id: '00000000-0000-0000-0000-000000000501',
      campaign_denomination_id: null,
      ruleset_system_id: '00000000-0000-0000-0000-000000000601',
      ruleset_label: 'Gold',
      ruleset_abbreviation: 'gp',
      campaign_system_id: null,
      campaign_label: null,
      campaign_abbreviation: null,
      campaign_scale: null
    }
    const { db, queries } = createTestDatabase([
      [
        { ...balanceBase, id: 'balance-a', group_id: 'group-a', amount: '3' },
        { ...balanceBase, id: 'balance-b', group_id: 'group-b', amount: '5' }
      ],
      [],
      []
    ])

    const debits = await createInventoryRepository(db).decrementCurrency({
      ownerId: ownerRow.id,
      denomination: { kind: 'RULESET', id: balanceBase.ruleset_currency_id },
      amount: 6n
    })

    expect(debits).toEqual([
      { balanceId: 'balance-a', groupId: 'group-a', amount: 3n },
      { balanceId: 'balance-b', groupId: 'group-b', amount: 3n }
    ])
    expect(debits.reduce((total, debit) => total + debit.amount, 0n)).toBe(6n)
    expect(queries[0]?.sql).toContain('order by balance.id')
    expect(queries[0]?.sql).toContain('for update of balance')
    expect(queries[2]?.parameters).toContain('2')
  })

  it('updates a currency system only at the expected version', async () => {
    const systemRow = {
      id: '00000000-0000-0000-0000-000000000701',
      campaign_id: '00000000-0000-0000-0000-000000000801',
      name: 'Imperial',
      is_reference: true,
      version: 5,
      created_at: '2026-08-06T00:00:00.000Z',
      updated_at: '2026-08-06T00:00:00.000Z'
    }
    const { db, queries } = createTestDatabase([[systemRow], []])

    const updated = await createInventoryRepository(db).updateCurrencySystem({
      id: systemRow.id,
      expectedVersion: 4,
      name: systemRow.name,
      isReference: true
    })

    expect(updated?.version).toBe(5)
    expect(queries[0]?.sql).toContain('where "id" = $4 and "version" = $5')
    expect(queries[0]?.parameters).toEqual([systemRow.name, true, 5, systemRow.id, 4])
  })

  it('rewrites exact bigint balances without conversion or rounding', async () => {
    const systemId = '00000000-0000-0000-0000-000000000701'
    const denominationId = '00000000-0000-0000-0000-000000000702'
    const exactAmount = 9_007_199_254_740_993n
    const exactScale = 1_000_000_000_000_003n
    const denominationRow = {
      id: denominationId,
      system_id: systemId,
      name: 'Crown',
      abbreviation: 'cr',
      scale_in_reference: exactScale.toString(),
      sort_order: 0
    }
    const { db, queries } = createTestDatabase([
      [
        {
          id: 'balance-a',
          owner_id: ownerRow.id,
          group_id: null,
          denomination_id: denominationId,
          amount: exactAmount.toString()
        }
      ],
      [],
      [],
      [],
      [],
      [denominationRow]
    ])

    const denominations = await createInventoryRepository(db).replaceCurrencyDenominations({
      systemId,
      denominations: [
        {
          id: denominationId,
          systemId,
          name: 'Crown',
          abbreviation: 'cr',
          scaleInReference: exactScale,
          sortOrder: 0
        }
      ],
      balanceRewrites: [
        {
          id: 'balance-a',
          ownerId: ownerRow.id,
          groupId: null,
          denominationId,
          amount: exactAmount
        }
      ]
    })

    expect(denominations[0]?.scaleInReference).toBe(exactScale)
    expect(queries.flatMap((query) => query.parameters)).toContain(exactScale.toString())
    expect(queries.flatMap((query) => query.parameters)).toContain(exactAmount.toString())
    expect(queries.map((query) => query.sql).join('\n')).not.toMatch(/round|floor|ceil|\//i)
  })

  it('rejects an ungrouped currency accumulation above the safe integer range', async () => {
    const { db, queries } = createTestDatabase([])

    await expect(
      createInventoryRepository(db).upsertUngroupedCurrencyBalance(
        ownerRow.id,
        { kind: 'RULESET', id: '00000000-0000-0000-0000-000000000501' },
        BigInt(Number.MAX_SAFE_INTEGER) + 1n
      )
    ).rejects.toThrow('Currency amount exceeds the supported range.')
    expect(queries).toHaveLength(0)
  })
})
