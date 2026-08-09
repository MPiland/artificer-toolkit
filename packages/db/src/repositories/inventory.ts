import { sql } from 'kysely'
import type { DBLike, DbTables, Json } from '#types'

export type InventoryOwnerRef =
  | { kind: 'CHARACTER'; characterId: string }
  | { kind: 'CAMPAIGN'; campaignId: string }

export interface InventoryOwner {
  id: string
  kind: InventoryOwnerRef['kind']
  characterId: string | null
  campaignId: string | null
  version: number
}

export interface InventoryItem {
  id: string
  ownerId: string
  equipmentId: string
  equipmentLabel: string | null
  quantity: number
  containerId: string | null
  isContainer: boolean
  customName: string | null
  notes: string | null
  equipped: boolean
  attuned: boolean
  placementKind: 'CREATURE' | 'VEHICLE' | null
  placementId: string | null
}

export type CurrencyDenomination =
  | {
      kind: 'RULESET'
      id: string
      systemId: string
      label: string
      abbreviation: string
      scaleInReference: null
    }
  | {
      kind: 'CAMPAIGN'
      id: string
      systemId: string
      label: string
      abbreviation: string
      scaleInReference: bigint
    }

export interface InventoryCurrencyBalance {
  id: string
  ownerId: string
  groupId: string | null
  containerId: string | null
  denomination: CurrencyDenomination
  amount: bigint
}

export interface InventoryAggregate {
  owner: InventoryOwner
  items: InventoryItem[]
  currencies: InventoryCurrencyBalance[]
}

export type CurrencyDenominationRef =
  | { kind: 'RULESET'; id: string }
  | { kind: 'CAMPAIGN'; id: string }

export interface CampaignCurrencyDenomination {
  id: string
  systemId: string
  name: string
  abbreviation: string
  scaleInReference: bigint
  sortOrder: number
}

export interface CampaignCurrencySystem {
  id: string
  campaignId: string
  name: string
  isReference: boolean
  version: number
  denominations: CampaignCurrencyDenomination[]
}

export interface CurrencyBalanceRewrite {
  id: string
  ownerId: string
  groupId: string | null
  denominationId: string
  amount: bigint
}

export interface CampaignCustodyEvent {
  id: string
  campaignId: string
  actorUserId: string | null
  subjectUserId: string | null
  subjectCharacterId: string | null
  kind: string
  visibility: 'TABLE' | 'OWNER' | 'SUBJECT'
  payload: Json
  idempotencyKey: string
  createdAt: string
}

export const campaignInventoryEventKinds = [
  'CUSTODY_TRANSFER',
  'PARTY_ITEM_ADD',
  'PARTY_ITEM_UPDATE',
  'PARTY_ITEM_CONSUME',
  'PARTY_ITEM_REMOVE',
  'PARTY_CURRENCY_ADJUST'
] as const
export type CampaignInventoryEventKind = (typeof campaignInventoryEventKinds)[number]

export interface CurrencyDebit {
  balanceId: string
  groupId: string | null
  amount: bigint
}

export interface CampaignCurrencyCleanup {
  denomination: Extract<CurrencyDenomination, { kind: 'CAMPAIGN' }>
  amount: bigint
  sourceBalanceIds: string[]
}

type InventoryOwnerRow = DbTables['inventory_owners']['Row']
type InventoryItemRow = DbTables['inventory_items']['Row'] & {
  equipment_label?: string | null
  capacity_amount?: number | null
  capacity_unit?: string | null
}
type CurrencySystemRow = DbTables['campaign_currency_systems']['Row']
type CampaignEventRow = DbTables['campaign_events']['Row']
type RuntimeTimestamp = Date | string

const MAX_SAFE_CURRENCY_AMOUNT = BigInt(Number.MAX_SAFE_INTEGER)

interface CurrencyBalanceRow {
  id: string
  owner_id: string
  group_id: string | null
  amount: string | number | bigint
  ruleset_currency_id: string | null
  campaign_denomination_id: string | null
  ruleset_system_id: string | null
  ruleset_label: string | null
  ruleset_abbreviation: string | null
  campaign_system_id: string | null
  campaign_label: string | null
  campaign_abbreviation: string | null
  campaign_scale: string | number | bigint | null
  container_item_id?: string | null
}

interface CampaignDenominationRow {
  id: string
  system_id: string
  name: string
  abbreviation: string
  scale_in_reference: string | number | bigint
  sort_order: number
}

export class InsufficientInventoryCurrencyError extends Error {
  constructor() {
    super('The inventory does not contain enough of that denomination.')
    this.name = 'InsufficientInventoryCurrencyError'
  }
}

function toOwner(row: InventoryOwnerRow): InventoryOwner {
  return {
    id: row.id,
    kind: row.kind as InventoryOwner['kind'],
    characterId: row.character_id,
    campaignId: row.campaign_id,
    version: row.version
  }
}

function toItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    equipmentId: row.equipment_id,
    equipmentLabel: row.equipment_label ?? null,
    quantity: row.quantity,
    containerId: row.container_id,
    isContainer:
      row.capacity_amount !== null &&
      row.capacity_amount !== undefined &&
      row.capacity_unit !== null &&
      row.capacity_unit !== undefined,
    customName: row.custom_name,
    notes: row.notes,
    equipped: row.equipped,
    attuned: row.attuned,
    placementKind: row.placement_kind as InventoryItem['placementKind'],
    placementId: row.placement_id
  }
}

function toDenomination(row: CurrencyBalanceRow): CurrencyDenomination {
  if (row.ruleset_currency_id) {
    if (!row.ruleset_system_id || !row.ruleset_label || !row.ruleset_abbreviation) {
      throw new Error(`Ruleset currency "${row.ruleset_currency_id}" is missing metadata.`)
    }
    return {
      kind: 'RULESET',
      id: row.ruleset_currency_id,
      systemId: row.ruleset_system_id,
      label: row.ruleset_label,
      abbreviation: row.ruleset_abbreviation,
      scaleInReference: null
    }
  }

  if (
    !row.campaign_denomination_id ||
    !row.campaign_system_id ||
    !row.campaign_label ||
    !row.campaign_abbreviation ||
    row.campaign_scale === null
  ) {
    throw new Error(`Campaign currency balance "${row.id}" is missing denomination metadata.`)
  }
  return {
    kind: 'CAMPAIGN',
    id: row.campaign_denomination_id,
    systemId: row.campaign_system_id,
    label: row.campaign_label,
    abbreviation: row.campaign_abbreviation,
    scaleInReference: BigInt(row.campaign_scale)
  }
}

function toBalance(row: CurrencyBalanceRow): InventoryCurrencyBalance {
  return {
    id: row.id,
    ownerId: row.owner_id,
    groupId: row.group_id,
    containerId: row.container_item_id ?? null,
    denomination: toDenomination(row),
    amount: BigInt(row.amount)
  }
}

function toCampaignDenomination(row: CampaignDenominationRow): CampaignCurrencyDenomination {
  return {
    id: row.id,
    systemId: row.system_id,
    name: row.name,
    abbreviation: row.abbreviation,
    scaleInReference: BigInt(row.scale_in_reference),
    sortOrder: row.sort_order
  }
}

function toCampaignSystem(
  row: CurrencySystemRow,
  denominations: CampaignCurrencyDenomination[]
): CampaignCurrencySystem {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    isReference: row.is_reference,
    version: row.version,
    denominations
  }
}

function orderedIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort()
}

function campaignEvent(row: CampaignEventRow): CampaignCustodyEvent {
  if (!row.idempotency_key) throw new Error(`Campaign event "${row.id}" has no idempotency key.`)
  return {
    id: row.id,
    campaignId: row.campaign_id,
    actorUserId: row.actor_user_id,
    subjectUserId: row.subject_user_id,
    subjectCharacterId: row.subject_character_id,
    kind: row.kind,
    visibility: row.visibility as CampaignCustodyEvent['visibility'],
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
    createdAt: toIsoTimestamp(row.created_at as RuntimeTimestamp)
  }
}

function toIsoTimestamp(value: RuntimeTimestamp): string {
  const timestamp = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(timestamp.getTime())) throw new Error('Inventory event timestamp is invalid.')
  return timestamp.toISOString()
}

export function createInventoryRepository(db: DBLike) {
  async function listItems(ownerId: string): Promise<InventoryItem[]> {
    const result = await sql<InventoryItemRow>`
      select item.*, equipment.label as equipment_label,
        equipment.capacity_amount, equipment.capacity_unit
      from inventory_items item
      join equipment on equipment.id = item.equipment_id
      where item.owner_id = ${ownerId}::uuid
      order by item.created_at, item.id
    `.execute(db)
    return result.rows.map(toItem)
  }

  async function listCurrencyBalances(ownerId: string): Promise<InventoryCurrencyBalance[]> {
    const result = await sql<CurrencyBalanceRow>`
      select balance.id, balance.owner_id, balance.group_id, group_record.container_item_id,
        balance.amount::text as amount,
        balance.ruleset_currency_id, balance.campaign_denomination_id,
        ruleset.system_id as ruleset_system_id, ruleset.label as ruleset_label,
        coalesce(ruleset.short, ruleset.code) as ruleset_abbreviation,
        denomination.system_id as campaign_system_id, denomination.name as campaign_label,
        denomination.abbreviation as campaign_abbreviation,
        denomination.scale_in_reference::text as campaign_scale
      from inventory_currency_balances balance
      left join inventory_currency_groups group_record
        on group_record.owner_id = balance.owner_id and group_record.id = balance.group_id
      left join currencies ruleset on ruleset.id = balance.ruleset_currency_id
      left join campaign_currency_denominations denomination
        on denomination.id = balance.campaign_denomination_id
      where balance.owner_id = ${ownerId}::uuid
      order by coalesce(balance.ruleset_currency_id, balance.campaign_denomination_id), balance.id
    `.execute(db)
    return result.rows.map(toBalance)
  }

  async function listDenominations(systemId: string): Promise<CampaignCurrencyDenomination[]> {
    const result = await sql<CampaignDenominationRow>`
      select id, system_id, name, abbreviation, scale_in_reference::text as scale_in_reference,
        sort_order
      from campaign_currency_denominations
      where system_id = ${systemId}::uuid
      order by sort_order, id
    `.execute(db)
    return result.rows.map(toCampaignDenomination)
  }

  async function lockCurrencyBalances(
    ownerId: string,
    denomination: CurrencyDenominationRef
  ): Promise<InventoryCurrencyBalance[]> {
    const denominationPredicate =
      denomination.kind === 'RULESET'
        ? sql`balance.ruleset_currency_id = ${denomination.id}::uuid`
        : sql`balance.campaign_denomination_id = ${denomination.id}::uuid`
    const result = await sql<CurrencyBalanceRow>`
      select balance.id, balance.owner_id, balance.group_id, balance.amount::text as amount,
        balance.ruleset_currency_id, balance.campaign_denomination_id,
        ruleset.system_id as ruleset_system_id, ruleset.label as ruleset_label,
        coalesce(ruleset.short, ruleset.code) as ruleset_abbreviation,
        campaign_denomination.system_id as campaign_system_id,
        campaign_denomination.name as campaign_label,
        campaign_denomination.abbreviation as campaign_abbreviation,
        campaign_denomination.scale_in_reference::text as campaign_scale
      from inventory_currency_balances balance
      left join currencies ruleset on ruleset.id = balance.ruleset_currency_id
      left join campaign_currency_denominations campaign_denomination
        on campaign_denomination.id = balance.campaign_denomination_id
      where balance.owner_id = ${ownerId}::uuid and ${denominationPredicate}
      order by balance.id
      for update of balance
    `.execute(db)
    return result.rows.map(toBalance)
  }

  async function upsertUngroupedCurrencyBalance(
    ownerId: string,
    denomination: CurrencyDenominationRef,
    amount: bigint
  ): Promise<InventoryCurrencyBalance> {
    if (amount < 0n) throw new RangeError('Currency amount cannot be negative.')
    if (amount > MAX_SAFE_CURRENCY_AMOUNT) {
      throw new RangeError('Currency amount exceeds the supported range.')
    }
    const maximumExistingAmount = (MAX_SAFE_CURRENCY_AMOUNT - amount).toString()
    const result =
      denomination.kind === 'RULESET'
        ? await sql<CurrencyBalanceRow>`
            insert into inventory_currency_balances
              (owner_id, group_id, ruleset_currency_id, campaign_denomination_id, amount)
            values (${ownerId}::uuid, null, ${denomination.id}::uuid, null, ${amount.toString()}::bigint)
            on conflict (
              owner_id,
              (coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)),
              ruleset_currency_id
            ) where ruleset_currency_id is not null
            do update set amount = inventory_currency_balances.amount + excluded.amount,
              updated_at = now()
            where inventory_currency_balances.amount <= ${maximumExistingAmount}::bigint
            returning id, owner_id, group_id, amount::text as amount,
              ruleset_currency_id, campaign_denomination_id,
              (select system_id from currencies where id = ruleset_currency_id) as ruleset_system_id,
              (select label from currencies where id = ruleset_currency_id) as ruleset_label,
              (select coalesce(short, code) from currencies where id = ruleset_currency_id) as ruleset_abbreviation,
              null::uuid as campaign_system_id, null::text as campaign_label,
              null::text as campaign_abbreviation, null::text as campaign_scale
          `.execute(db)
        : await sql<CurrencyBalanceRow>`
            insert into inventory_currency_balances
              (owner_id, group_id, ruleset_currency_id, campaign_denomination_id, amount)
            values (${ownerId}::uuid, null, null, ${denomination.id}::uuid, ${amount.toString()}::bigint)
            on conflict (
              owner_id,
              (coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)),
              campaign_denomination_id
            ) where campaign_denomination_id is not null
            do update set amount = inventory_currency_balances.amount + excluded.amount,
              updated_at = now()
            where inventory_currency_balances.amount <= ${maximumExistingAmount}::bigint
            returning id, owner_id, group_id, amount::text as amount,
              ruleset_currency_id, campaign_denomination_id,
              null::uuid as ruleset_system_id, null::text as ruleset_label,
              null::text as ruleset_abbreviation,
              (select system_id from campaign_currency_denominations where id = campaign_denomination_id) as campaign_system_id,
              (select name from campaign_currency_denominations where id = campaign_denomination_id) as campaign_label,
              (select abbreviation from campaign_currency_denominations where id = campaign_denomination_id) as campaign_abbreviation,
              (select scale_in_reference::text from campaign_currency_denominations where id = campaign_denomination_id) as campaign_scale
          `.execute(db)
    const row = result.rows[0]
    if (!row) throw new RangeError('Currency amount exceeds the supported range.')
    return toBalance(row)
  }

  async function lockCurrencySystemBalances(systemId: string): Promise<CurrencyBalanceRewrite[]> {
    const result = await sql<{
      id: string
      owner_id: string
      group_id: string | null
      denomination_id: string
      amount: string | number | bigint
    }>`
      select balance.id, balance.owner_id, balance.group_id,
        balance.campaign_denomination_id as denomination_id, balance.amount::text as amount
      from inventory_currency_balances balance
      join campaign_currency_denominations denomination
        on denomination.id = balance.campaign_denomination_id
      where denomination.system_id = ${systemId}::uuid
      order by balance.id
      for update of balance
    `.execute(db)
    return result.rows.map((row) => ({
      id: row.id,
      ownerId: row.owner_id,
      groupId: row.group_id,
      denominationId: row.denomination_id,
      amount: BigInt(row.amount)
    }))
  }

  async function resolveOwner(ref: InventoryOwnerRef): Promise<InventoryOwner | null> {
    let query = db.selectFrom('inventory_owners').selectAll().where('kind', '=', ref.kind)
    query =
      ref.kind === 'CHARACTER'
        ? query.where('character_id', '=', ref.characterId)
        : query.where('campaign_id', '=', ref.campaignId)
    const row = await query.executeTakeFirst()
    return row ? toOwner(row) : null
  }

  async function getInventoryByOwnerId(ownerId: string): Promise<InventoryAggregate | null> {
    const row = await db
      .selectFrom('inventory_owners')
      .selectAll()
      .where('id', '=', ownerId)
      .executeTakeFirst()
    if (!row) return null

    const [items, balances] = await Promise.all([listItems(ownerId), listCurrencyBalances(ownerId)])
    return { owner: toOwner(row), items, currencies: balances }
  }

  async function insertInventoryEvent(input: {
    campaignId: string
    actorUserId: string
    subjectUserId?: string | null
    subjectCharacterId?: string | null
    kind: CampaignInventoryEventKind
    idempotencyKey: string
    payload: Json
  }): Promise<CampaignCustodyEvent> {
    const row = await db
      .insertInto('campaign_events')
      .values({
        campaign_id: input.campaignId,
        actor_user_id: input.actorUserId,
        subject_user_id: input.subjectUserId ?? null,
        subject_character_id: input.subjectCharacterId ?? null,
        kind: input.kind,
        visibility: 'OWNER',
        payload: input.payload,
        idempotency_key: input.idempotencyKey
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return campaignEvent(row)
  }

  return {
    resolveOwner,

    async getInventory(ref: InventoryOwnerRef): Promise<InventoryAggregate | null> {
      const owner = await resolveOwner(ref)
      return owner ? getInventoryByOwnerId(owner.id) : null
    },

    getInventoryByOwnerId,

    async lockOwners(ownerIds: readonly string[]): Promise<InventoryOwner[]> {
      const ids = orderedIds(ownerIds)
      if (ids.length === 0) return []
      const rows = await db
        .selectFrom('inventory_owners')
        .selectAll()
        .where('id', 'in', ids)
        .orderBy('id', 'asc')
        .forUpdate()
        .execute()
      return rows.map(toOwner)
    },

    async incrementVersions(ownerIds: readonly string[]): Promise<InventoryOwner[]> {
      const ids = orderedIds(ownerIds)
      if (ids.length === 0) return []
      const rows = await db
        .updateTable('inventory_owners')
        .set((expressionBuilder) => ({
          version: expressionBuilder('version', '+', 1),
          updated_at: sql`now()`
        }))
        .where('id', 'in', ids)
        .returningAll()
        .execute()
      return rows.map(toOwner)
    },

    async lockItem(ownerId: string, itemId: string): Promise<InventoryItem | null> {
      const result = await sql<InventoryItemRow>`
        select item.*, equipment.label as equipment_label
        from inventory_items item
        join equipment on equipment.id = item.equipment_id
        where item.owner_id = ${ownerId}::uuid and item.id = ${itemId}::uuid
        for update of item
      `.execute(db)
      const row = result.rows[0]
      return row ? toItem(row) : null
    },

    async hasContainerContents(ownerId: string, itemId: string): Promise<boolean> {
      const result = await sql<{ exists: boolean }>`
        select exists (
          select 1 from inventory_items
          where owner_id = ${ownerId}::uuid and container_id = ${itemId}::uuid
          union all
          select 1 from inventory_currency_groups
          where owner_id = ${ownerId}::uuid and container_item_id = ${itemId}::uuid
        ) as exists
      `.execute(db)
      return result.rows[0]?.exists ?? false
    },

    async decrementItemStack(input: {
      ownerId: string
      itemId: string
      quantity: number
    }): Promise<InventoryItem | null> {
      const result = await sql<InventoryItemRow>`
        update inventory_items
        set quantity = quantity - ${input.quantity}, updated_at = now()
        where owner_id = ${input.ownerId}::uuid and id = ${input.itemId}::uuid
          and quantity > ${input.quantity}
        returning *
      `.execute(db)
      const row = result.rows[0]
      return row ? toItem(row) : null
    },

    async insertPartyItem(input: {
      ownerId: string
      equipmentId: string
      quantity: number
    }): Promise<InventoryItem> {
      const row = await db
        .insertInto('inventory_items')
        .values({
          owner_id: input.ownerId,
          equipment_id: input.equipmentId,
          quantity: input.quantity,
          container_id: null,
          custom_name: null,
          notes: null,
          equipped: false,
          attuned: false,
          placement_kind: null,
          placement_id: null
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return toItem(row)
    },

    async updatePartyItemQuantity(input: {
      ownerId: string
      itemId: string
      quantity: number
    }): Promise<InventoryItem | null> {
      const row = await db
        .updateTable('inventory_items')
        .set({ quantity: input.quantity, updated_at: sql`now()` })
        .where('owner_id', '=', input.ownerId)
        .where('id', '=', input.itemId)
        .returningAll()
        .executeTakeFirst()
      return row ? toItem(row) : null
    },

    async removePartyItem(ownerId: string, itemId: string): Promise<boolean> {
      const row = await db
        .deleteFrom('inventory_items')
        .where('owner_id', '=', ownerId)
        .where('id', '=', itemId)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    },

    async insertTransferredItem(input: {
      destinationOwnerId: string
      source: InventoryItem
      quantity: number
    }): Promise<InventoryItem> {
      const row = await db
        .insertInto('inventory_items')
        .values({
          owner_id: input.destinationOwnerId,
          equipment_id: input.source.equipmentId,
          quantity: input.quantity,
          container_id: null,
          custom_name: input.source.customName,
          notes: input.source.notes,
          equipped: false,
          attuned: false,
          placement_kind: null,
          placement_id: null
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return toItem(row)
    },

    async moveItemStack(input: {
      sourceOwnerId: string
      destinationOwnerId: string
      itemId: string
    }): Promise<InventoryItem | null> {
      const row = await db
        .updateTable('inventory_items')
        .set({
          owner_id: input.destinationOwnerId,
          container_id: null,
          equipped: false,
          attuned: false,
          placement_kind: null,
          placement_id: null,
          updated_at: sql`now()`
        })
        .where('owner_id', '=', input.sourceOwnerId)
        .where('id', '=', input.itemId)
        .returningAll()
        .executeTakeFirst()
      return row ? toItem(row) : null
    },

    lockCurrencyBalances,

    async findDenomination(ref: CurrencyDenominationRef): Promise<CurrencyDenomination | null> {
      if (ref.kind === 'RULESET') {
        const row = await db
          .selectFrom('currencies')
          .select(['id', 'system_id', 'label', 'short', 'code'])
          .where('id', '=', ref.id)
          .executeTakeFirst()
        return row
          ? {
              kind: 'RULESET',
              id: row.id,
              systemId: row.system_id,
              label: row.label,
              abbreviation: row.short ?? row.code,
              scaleInReference: null
            }
          : null
      }
      const row = await sql<CampaignDenominationRow>`
        select id, system_id, name, abbreviation, scale_in_reference::text as scale_in_reference,
          sort_order
        from campaign_currency_denominations where id = ${ref.id}::uuid
      `.execute(db)
      const denomination = row.rows[0]
      return denomination
        ? {
            kind: 'CAMPAIGN',
            id: denomination.id,
            systemId: denomination.system_id,
            label: denomination.name,
            abbreviation: denomination.abbreviation,
            scaleInReference: BigInt(denomination.scale_in_reference)
          }
        : null
    },

    async decrementCurrency(input: {
      ownerId: string
      denomination: CurrencyDenominationRef
      amount: bigint
    }): Promise<CurrencyDebit[]> {
      if (input.amount <= 0n) throw new RangeError('Currency decrement must be positive.')
      const balances = await lockCurrencyBalances(input.ownerId, input.denomination)
      let remaining = input.amount
      const debits: CurrencyDebit[] = []

      for (const balance of balances) {
        if (remaining === 0n) break
        const amount = balance.amount < remaining ? balance.amount : remaining
        if (amount === 0n) continue
        const nextAmount = balance.amount - amount
        if (nextAmount === 0n) {
          await db.deleteFrom('inventory_currency_balances').where('id', '=', balance.id).execute()
        } else {
          await db
            .updateTable('inventory_currency_balances')
            .set({ amount: sql<number>`${nextAmount.toString()}::bigint`, updated_at: sql`now()` })
            .where('id', '=', balance.id)
            .execute()
        }
        debits.push({ balanceId: balance.id, groupId: balance.groupId, amount })
        remaining -= amount
      }

      if (remaining !== 0n) throw new InsufficientInventoryCurrencyError()
      return debits
    },

    upsertUngroupedCurrencyBalance,

    async findCampaignEventByIdempotency(
      campaignId: string,
      idempotencyKey: string
    ): Promise<CampaignCustodyEvent | null> {
      const row = await db
        .selectFrom('campaign_events')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('idempotency_key', '=', idempotencyKey)
        .executeTakeFirst()
      return row ? campaignEvent(row) : null
    },

    insertInventoryEvent,

    async listInventoryAuditEvents(input: {
      campaignId: string
      cursorId?: string
      limit: number
    }): Promise<{ events: CampaignCustodyEvent[]; nextCursor: string | null }> {
      let cursor: { created_at: Date | string; id: string } | undefined
      if (input.cursorId) {
        const cursorRow = await db
          .selectFrom('campaign_events')
          .select(['created_at', 'id'])
          .where('campaign_id', '=', input.campaignId)
          .where('id', '=', input.cursorId)
          .where('visibility', '=', 'OWNER')
          .where('kind', 'in', [...campaignInventoryEventKinds])
          .executeTakeFirst()
        if (!cursorRow) return { events: [], nextCursor: null }
        cursor = cursorRow
      }

      let query = db
        .selectFrom('campaign_events')
        .selectAll()
        .where('campaign_id', '=', input.campaignId)
        .where('visibility', '=', 'OWNER')
        .where('kind', 'in', [...campaignInventoryEventKinds])
      if (cursor) {
        const cursorCreatedAt = toIsoTimestamp(cursor.created_at)
        query = query.where((expressionBuilder) =>
          expressionBuilder.or([
            expressionBuilder('created_at', '<', cursorCreatedAt),
            expressionBuilder.and([
              expressionBuilder('created_at', '=', cursorCreatedAt),
              expressionBuilder('id', '<', cursor.id)
            ])
          ])
        )
      }
      const rows = (await query
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(input.limit + 1)
        .execute()) as CampaignEventRow[]
      const hasMore = rows.length > input.limit
      const events = rows.slice(0, input.limit).map(campaignEvent)
      return {
        events,
        nextCursor: hasMore ? (events.at(-1)?.id ?? null) : null
      }
    },

    async insertCustodyEvent(input: {
      campaignId: string
      actorUserId: string
      subjectUserId?: string | null
      subjectCharacterId?: string | null
      idempotencyKey: string
      payload: Json
    }): Promise<CampaignCustodyEvent> {
      return insertInventoryEvent({ ...input, kind: 'CUSTODY_TRANSFER' })
    },

    async listCurrencySystems(campaignId: string): Promise<CampaignCurrencySystem[]> {
      const rows = await db
        .selectFrom('campaign_currency_systems')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .orderBy('name', 'asc')
        .orderBy('id', 'asc')
        .execute()
      return Promise.all(
        rows.map(async (row) => toCampaignSystem(row, await listDenominations(row.id)))
      )
    },

    async getCurrencySystem(systemId: string): Promise<CampaignCurrencySystem | null> {
      const row = await db
        .selectFrom('campaign_currency_systems')
        .selectAll()
        .where('id', '=', systemId)
        .executeTakeFirst()
      return row ? toCampaignSystem(row, await listDenominations(row.id)) : null
    },

    async lockCurrencySystem(systemId: string): Promise<CampaignCurrencySystem | null> {
      const row = await db
        .selectFrom('campaign_currency_systems')
        .selectAll()
        .where('id', '=', systemId)
        .forUpdate()
        .executeTakeFirst()
      return row ? toCampaignSystem(row, await listDenominations(row.id)) : null
    },

    async insertCurrencySystem(input: {
      campaignId: string
      name: string
      isReference: boolean
    }): Promise<CampaignCurrencySystem> {
      const row = await db
        .insertInto('campaign_currency_systems')
        .values({
          campaign_id: input.campaignId,
          name: input.name,
          is_reference: input.isReference
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return toCampaignSystem(row, [])
    },

    async updateCurrencySystem(input: {
      id: string
      expectedVersion: number
      name: string
      isReference: boolean
    }): Promise<CampaignCurrencySystem | null> {
      const row = await db
        .updateTable('campaign_currency_systems')
        .set({
          name: input.name,
          is_reference: input.isReference,
          version: input.expectedVersion + 1,
          updated_at: sql`now()`
        })
        .where('id', '=', input.id)
        .where('version', '=', input.expectedVersion)
        .returningAll()
        .executeTakeFirst()
      return row ? toCampaignSystem(row, await listDenominations(row.id)) : null
    },

    async deleteCurrencySystem(systemId: string): Promise<boolean> {
      const row = await db
        .deleteFrom('campaign_currency_systems')
        .where('id', '=', systemId)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    },

    lockCurrencySystemBalances,

    async replaceCurrencyDenominations(input: {
      systemId: string
      denominations: CampaignCurrencyDenomination[]
      balanceRewrites: CurrencyBalanceRewrite[]
    }): Promise<CampaignCurrencyDenomination[]> {
      const existingBalances = await lockCurrencySystemBalances(input.systemId)
      const existingIds = orderedIds(existingBalances.map((balance) => balance.id))
      const replacementIds = orderedIds(input.balanceRewrites.map((balance) => balance.id))
      if (
        existingIds.length !== replacementIds.length ||
        existingIds.some((id, index) => id !== replacementIds[index])
      ) {
        throw new Error('Every existing balance must have exactly one replacement.')
      }

      const denominationIds = new Set(input.denominations.map((denomination) => denomination.id))
      if (
        input.denominations.some((denomination) => denomination.systemId !== input.systemId) ||
        input.balanceRewrites.some(
          (balance) => balance.amount < 0n || !denominationIds.has(balance.denominationId)
        )
      ) {
        throw new Error('Currency replacement contains an invalid denomination or balance.')
      }

      if (existingIds.length > 0) {
        await db.deleteFrom('inventory_currency_balances').where('id', 'in', existingIds).execute()
      }
      await db
        .deleteFrom('campaign_currency_denominations')
        .where('system_id', '=', input.systemId)
        .execute()
      if (input.denominations.length > 0) {
        await db
          .insertInto('campaign_currency_denominations')
          .values(
            input.denominations.map((denomination) => ({
              id: denomination.id,
              system_id: input.systemId,
              name: denomination.name,
              abbreviation: denomination.abbreviation,
              scale_in_reference: sql<number>`${denomination.scaleInReference.toString()}::bigint`,
              sort_order: denomination.sortOrder
            }))
          )
          .execute()
      }
      if (input.balanceRewrites.length > 0) {
        await db
          .insertInto('inventory_currency_balances')
          .values(
            input.balanceRewrites.map((balance) => ({
              id: balance.id,
              owner_id: balance.ownerId,
              group_id: balance.groupId,
              ruleset_currency_id: null,
              campaign_denomination_id: balance.denominationId,
              amount: sql<number>`${balance.amount.toString()}::bigint`
            }))
          )
          .execute()
      }
      return listDenominations(input.systemId)
    },

    async findCampaignReferenceDenomination(
      campaignId: string
    ): Promise<CampaignCurrencyDenomination | null> {
      const result = await sql<CampaignDenominationRow>`
        select denomination.id, denomination.system_id, denomination.name,
          denomination.abbreviation,
          denomination.scale_in_reference::text as scale_in_reference,
          denomination.sort_order
        from campaign_currency_denominations denomination
        join campaign_currency_systems system on system.id = denomination.system_id
        where system.campaign_id = ${campaignId}::uuid and system.is_reference
          and denomination.scale_in_reference = 1
      `.execute(db)
      const row = result.rows[0]
      return row ? toCampaignDenomination(row) : null
    },

    async moveCharacterCampaignCurrencyToCampaign(input: {
      campaignId: string
      characterOwnerId: string
      campaignOwnerId: string
    }): Promise<CampaignCurrencyCleanup[]> {
      const result = await sql<CurrencyBalanceRow>`
        select balance.id, balance.owner_id, balance.group_id, balance.amount::text as amount,
          balance.ruleset_currency_id, balance.campaign_denomination_id,
          null::uuid as ruleset_system_id, null::text as ruleset_label,
          null::text as ruleset_abbreviation,
          denomination.system_id as campaign_system_id, denomination.name as campaign_label,
          denomination.abbreviation as campaign_abbreviation,
          denomination.scale_in_reference::text as campaign_scale
        from inventory_currency_balances balance
        join campaign_currency_denominations denomination
          on denomination.id = balance.campaign_denomination_id
        join campaign_currency_systems system on system.id = denomination.system_id
        where balance.owner_id = ${input.characterOwnerId}::uuid
          and system.campaign_id = ${input.campaignId}::uuid
        order by denomination.id, balance.id
        for update of balance
      `.execute(db)
      const balances = result.rows.map(toBalance)
      const cleanup = new Map<string, CampaignCurrencyCleanup>()
      for (const balance of balances) {
        if (balance.denomination.kind !== 'CAMPAIGN') continue
        const current = cleanup.get(balance.denomination.id)
        cleanup.set(balance.denomination.id, {
          denomination: balance.denomination,
          amount: (current?.amount ?? 0n) + balance.amount,
          sourceBalanceIds: [...(current?.sourceBalanceIds ?? []), balance.id]
        })
      }

      const sourceIds = balances.map((balance) => balance.id)
      if (sourceIds.length > 0) {
        await db.deleteFrom('inventory_currency_balances').where('id', 'in', sourceIds).execute()
      }
      for (const moved of cleanup.values()) {
        await upsertUngroupedCurrencyBalance(
          input.campaignOwnerId,
          { kind: 'CAMPAIGN', id: moved.denomination.id },
          moved.amount
        )
      }
      return [...cleanup.values()]
    }
  }
}
