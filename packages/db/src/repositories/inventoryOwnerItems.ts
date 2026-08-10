import { sql } from 'kysely'
import type { DBLike } from '#types'
import {
  toItem,
  toOwner,
  type InventoryAggregate,
  type InventoryCurrencyBalance,
  type InventoryItem,
  type InventoryItemRow,
  type InventoryOwner,
  type InventoryOwnerRef
} from './inventoryTypes.js'

export function createInventoryOwnerItemRepository(
  db: DBLike,
  listCurrencyBalances: (ownerId: string) => Promise<InventoryCurrencyBalance[]>
) {
  async function resolveOwner(ref: InventoryOwnerRef): Promise<InventoryOwner | null> {
    let query = db.selectFrom('inventory_owners').selectAll().where('kind', '=', ref.kind)
    query =
      ref.kind === 'CHARACTER'
        ? query.where('character_id', '=', ref.characterId)
        : query.where('campaign_id', '=', ref.campaignId)
    const row = await query.executeTakeFirst()
    return row ? toOwner(row) : null
  }
  async function listItems(ownerId: string): Promise<InventoryItem[]> {
    const result =
      await sql<InventoryItemRow>`select item.*, equipment.label as equipment_label, equipment.capacity_amount, equipment.capacity_unit from inventory_items item join equipment on equipment.id = item.equipment_id where item.owner_id = ${ownerId}::uuid order by item.created_at, item.id`.execute(
        db
      )
    return result.rows.map(toItem)
  }
  async function getInventoryByOwnerId(ownerId: string): Promise<InventoryAggregate | null> {
    const row = await db
      .selectFrom('inventory_owners')
      .selectAll()
      .where('id', '=', ownerId)
      .executeTakeFirst()
    if (!row) return null
    const [items, currencies] = await Promise.all([
      listItems(ownerId),
      listCurrencyBalances(ownerId)
    ])
    return { owner: toOwner(row), items, currencies }
  }
  return {
    resolveOwner,
    async getInventory(ref: InventoryOwnerRef) {
      const owner = await resolveOwner(ref)
      return owner ? getInventoryByOwnerId(owner.id) : null
    },
    getInventoryByOwnerId,
    async lockOwners(ownerIds: readonly string[]) {
      const ids = [...new Set(ownerIds)].sort()
      if (!ids.length) return []
      return (
        await db
          .selectFrom('inventory_owners')
          .selectAll()
          .where('id', 'in', ids)
          .orderBy('id', 'asc')
          .forUpdate()
          .execute()
      ).map(toOwner)
    },
    async incrementVersions(ownerIds: readonly string[]) {
      const ids = [...new Set(ownerIds)].sort()
      if (!ids.length) return []
      return (
        await db
          .updateTable('inventory_owners')
          .set((eb) => ({ version: eb('version', '+', 1), updated_at: sql`now()` }))
          .where('id', 'in', ids)
          .returningAll()
          .execute()
      ).map(toOwner)
    },
    async lockItem(ownerId: string, itemId: string) {
      const result =
        await sql<InventoryItemRow>`select item.*, equipment.label as equipment_label from inventory_items item join equipment on equipment.id = item.equipment_id where item.owner_id = ${ownerId}::uuid and item.id = ${itemId}::uuid for update of item`.execute(
          db
        )
      const row = result.rows[0]
      return row ? toItem(row) : null
    },
    async hasContainerContents(ownerId: string, itemId: string) {
      const result = await sql<{
        exists: boolean
      }>`select exists (select 1 from inventory_items where owner_id = ${ownerId}::uuid and container_id = ${itemId}::uuid union all select 1 from inventory_currency_groups where owner_id = ${ownerId}::uuid and container_item_id = ${itemId}::uuid) as exists`.execute(
        db
      )
      return result.rows[0]?.exists ?? false
    },
    async decrementItemStack(input: { ownerId: string; itemId: string; quantity: number }) {
      const result =
        await sql<InventoryItemRow>`update inventory_items set quantity = quantity - ${input.quantity}, updated_at = now() where owner_id = ${input.ownerId}::uuid and id = ${input.itemId}::uuid and quantity > ${input.quantity} returning *`.execute(
          db
        )
      const row = result.rows[0]
      return row ? toItem(row) : null
    },
    async insertPartyItem(input: { ownerId: string; equipmentId: string; quantity: number }) {
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
    async updatePartyItemQuantity(input: { ownerId: string; itemId: string; quantity: number }) {
      const row = await db
        .updateTable('inventory_items')
        .set({ quantity: input.quantity, updated_at: sql`now()` })
        .where('owner_id', '=', input.ownerId)
        .where('id', '=', input.itemId)
        .returningAll()
        .executeTakeFirst()
      return row ? toItem(row) : null
    },
    async removePartyItem(ownerId: string, itemId: string) {
      return Boolean(
        await db
          .deleteFrom('inventory_items')
          .where('owner_id', '=', ownerId)
          .where('id', '=', itemId)
          .returning('id')
          .executeTakeFirst()
      )
    },
    async insertTransferredItem(input: {
      destinationOwnerId: string
      source: InventoryItem
      quantity: number
    }) {
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
    }) {
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
    }
  }
}
