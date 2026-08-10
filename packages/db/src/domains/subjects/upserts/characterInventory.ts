import type { DBLike } from '#types'
import type { CharacterAuthored } from '@artificer-toolkit/shared'
import { insertRows } from './characterRows.js'
import { sortByDependency } from './characterSorting.js'

type CharacterInventoryItem = CharacterAuthored['state']['equipment']['inventory'][number]
type CharacterCurrencyGroup = CharacterAuthored['state']['currency'][number]
type CharacterInventoryPlacement = {
  kind: 'CREATURE' | 'VEHICLE'
  id: string
}

type CharacterInventoryOwner = { id: string }

async function resolveCharacterInventoryOwner(
  db: DBLike,
  characterId: string
): Promise<CharacterInventoryOwner> {
  let owner = await db
    .selectFrom('inventory_owners')
    .select('id')
    .where('kind', '=', 'CHARACTER')
    .where('character_id', '=', characterId)
    .executeTakeFirst()

  if (!owner) {
    await db
      .insertInto('inventory_owners')
      .values({ id: characterId, kind: 'CHARACTER', character_id: characterId })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute()
    owner = await db
      .selectFrom('inventory_owners')
      .select('id')
      .where('kind', '=', 'CHARACTER')
      .where('character_id', '=', characterId)
      .executeTakeFirst()
  }

  if (!owner) {
    throw new Error(`Character "${characterId}" is missing its inventory owner.`)
  }

  return owner
}

function placementRows(
  characterId: string,
  creatureEquipment: CharacterAuthored['state']['creatureEquipment'] | undefined,
  vehicleEquipment: CharacterAuthored['state']['vehicleEquipment'] | undefined,
  inventoryIds: ReadonlySet<string>
): Map<string, CharacterInventoryPlacement> {
  const placements = new Map<string, CharacterInventoryPlacement>()
  for (const [instanceId, assignments] of Object.entries(creatureEquipment ?? {})) {
    for (const assignment of assignments) {
      if (!inventoryIds.has(assignment.equipmentItemId)) {
        throw new Error(
          `Character ${characterId} creature equipment references missing inventory item ${assignment.equipmentItemId}.`
        )
      }
      if (placements.has(assignment.equipmentItemId)) {
        throw new Error(`Character ${characterId} assigns an inventory item more than once.`)
      }
      placements.set(assignment.equipmentItemId, { kind: 'CREATURE', id: instanceId })
    }
  }
  for (const [instanceId, assignments] of Object.entries(vehicleEquipment ?? {})) {
    for (const assignment of assignments) {
      if (!inventoryIds.has(assignment.equipmentItemId)) {
        throw new Error(
          `Character ${characterId} vehicle equipment references missing inventory item ${assignment.equipmentItemId}.`
        )
      }
      if (placements.has(assignment.equipmentItemId)) {
        throw new Error(`Character ${characterId} assigns an inventory item more than once.`)
      }
      placements.set(assignment.equipmentItemId, { kind: 'VEHICLE', id: instanceId })
    }
  }
  return placements
}

export async function replaceCharacterInventoryItems(
  db: DBLike,
  characterId: string,
  inventory: CharacterInventoryItem[],
  equipped: string[],
  attuned: string[],
  creatureEquipment?: CharacterAuthored['state']['creatureEquipment'],
  vehicleEquipment?: CharacterAuthored['state']['vehicleEquipment'],
  options: { resetMissingCurrencyContainers?: boolean } = {}
): Promise<void> {
  const owner = await resolveCharacterInventoryOwner(db, characterId)
  const orderedInventory = sortByDependency(
    inventory,
    (item) => item.id,
    (item) => item.containerId,
    `Character equipment for ${characterId}`
  )
  const inventoryIds = new Set(orderedInventory.map((item) => item.id))
  if (orderedInventory.length > 0) {
    const conflictingItems = await db
      .selectFrom('inventory_items')
      .select(['id', 'owner_id'])
      .where(
        'id',
        'in',
        orderedInventory.map((item) => item.id)
      )
      .forUpdate()
      .execute()
    const foreignItem = conflictingItems.find((item) => item.owner_id !== owner.id)
    if (foreignItem) {
      throw new Error(
        `Character ${characterId} cannot claim inventory item ${foreignItem.id} owned by another inventory aggregate.`
      )
    }
  }
  for (const itemId of [...equipped, ...attuned]) {
    if (!inventoryIds.has(itemId)) {
      throw new Error(`Character ${characterId} references missing inventory item ${itemId}.`)
    }
  }
  const placements = placementRows(characterId, creatureEquipment, vehicleEquipment, inventoryIds)
  const existingItems = await db
    .selectFrom('inventory_items')
    .select(['id', 'container_id'])
    .where('owner_id', '=', owner.id)
    .execute()
  const nextIds = new Set(orderedInventory.map((item) => item.id))
  const currencyGroups = await db
    .selectFrom('inventory_currency_groups')
    .select(['id', 'container_item_id'])
    .where('owner_id', '=', owner.id)
    .execute()
  for (const group of currencyGroups) {
    if (group.container_item_id && !nextIds.has(group.container_item_id)) {
      if (!options.resetMissingCurrencyContainers) {
        throw new Error(
          `Character ${characterId} currency group ${group.id} references removed container ${group.container_item_id}.`
        )
      }
      await db
        .insertInto('inventory_currency_groups')
        .values({ id: group.id, owner_id: owner.id, container_item_id: null })
        .onConflict((oc) =>
          oc.column('id').doUpdateSet((eb) => ({
            container_item_id: eb.ref('excluded.container_item_id')
          }))
        )
        .execute()
    }
  }
  const removedItems = sortByDependency(
    existingItems,
    (item) => item.id,
    (item) => item.container_id ?? undefined,
    `Existing character equipment for ${characterId}`
  ).reverse()
  for (const item of removedItems) {
    if (!nextIds.has(item.id)) {
      await db
        .deleteFrom('inventory_items')
        .where('owner_id', '=', owner.id)
        .where('id', '=', item.id)
        .execute()
    }
  }

  for (const item of orderedInventory) {
    const placement = placements.get(item.id)
    await db
      .insertInto('inventory_items')
      .values({
        id: item.id,
        owner_id: owner.id,
        equipment_id: item.equipmentId,
        quantity: item.quantity,
        container_id: item.containerId ?? null,
        custom_name: item.customName ?? null,
        notes: item.notes ?? null,
        equipped: equipped.includes(item.id),
        attuned: attuned.includes(item.id),
        placement_kind: placement?.kind ?? null,
        placement_id: placement?.id ?? null
      })
      .onConflict((oc) =>
        oc.columns(['owner_id', 'id']).doUpdateSet((eb) => ({
          equipment_id: eb.ref('excluded.equipment_id'),
          quantity: eb.ref('excluded.quantity'),
          container_id: eb.ref('excluded.container_id'),
          custom_name: eb.ref('excluded.custom_name'),
          notes: eb.ref('excluded.notes'),
          equipped: eb.ref('excluded.equipped'),
          attuned: eb.ref('excluded.attuned'),
          placement_kind: eb.ref('excluded.placement_kind'),
          placement_id: eb.ref('excluded.placement_id')
        }))
      )
      .execute()
  }
}

export async function replaceCharacterCurrency(
  db: DBLike,
  characterId: string,
  currency: CharacterCurrencyGroup[]
): Promise<void> {
  const owner = await resolveCharacterInventoryOwner(db, characterId)
  const inventoryItems = await db
    .selectFrom('inventory_items')
    .select('id')
    .where('owner_id', '=', owner.id)
    .execute()
  const inventoryIds = new Set(inventoryItems.map((item) => item.id))
  const groupIds = new Set<string>()
  for (const group of currency) {
    if (!group.id) {
      throw new Error(`Character ${characterId} has a currency group without an id.`)
    }
    if (groupIds.has(group.id)) {
      throw new Error(`Character ${characterId} has duplicate currency group ${group.id}.`)
    }
    if (group.containerId && !inventoryIds.has(group.containerId)) {
      throw new Error(
        `Character ${characterId} currency group references missing container ${group.containerId}.`
      )
    }
    groupIds.add(group.id)
  }

  await db.deleteFrom('inventory_currency_balances').where('owner_id', '=', owner.id).execute()
  await db.deleteFrom('inventory_currency_groups').where('owner_id', '=', owner.id).execute()
  await insertRows(
    db,
    'inventory_currency_groups',
    currency.map((group) => ({
      id: group.id,
      owner_id: owner.id,
      container_item_id: group.containerId ?? null
    }))
  )
  const ids = [
    ...new Set(currency.flatMap((group) => group.currencies.map((entry) => entry.currencyId)))
  ]
  const [rulesetRows, campaignRows] = await Promise.all([
    ids.length > 0
      ? db.selectFrom('currencies').select('id').where('id', 'in', ids).execute()
      : Promise.resolve([]),
    ids.length > 0
      ? db
          .selectFrom('campaign_currency_denominations')
          .select('id')
          .where('id', 'in', ids)
          .execute()
      : Promise.resolve([])
  ])
  const campaignIds = new Set(campaignRows.map((row) => row.id))
  const rulesetIds = new Set(rulesetRows.map((row) => row.id))
  await insertRows(
    db,
    'inventory_currency_balances',
    currency.flatMap((group) =>
      group.currencies.map((entry) => {
        const isCampaign = campaignIds.has(entry.currencyId) && !rulesetIds.has(entry.currencyId)
        return {
          owner_id: owner.id,
          group_id: group.id,
          ruleset_currency_id: isCampaign ? null : entry.currencyId,
          campaign_denomination_id: isCampaign ? entry.currencyId : null,
          amount: entry.amount
        }
      })
    )
  )
}
