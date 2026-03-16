import type {
  StartingEquipmentAuthored,
  StartingEquipmentGroupAuthored,
  StartingEquipmentItemAuthored,
  StartingEquipmentOptionAuthored,
  StartingEquipmentSetAuthored
} from '@artificer-toolkit/shared'
import {
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE
} from '@artificer-toolkit/shared'
import type { DBLike } from '../types/index.js'
import { upsertStartingEquipment } from '../domains/shared/upserts/starting_equipment.js'
import type { StartingEquipmentRepository } from './contracts.js'

type StartingEquipmentItemEquipmentRow = {
  option_item_id: string
  equipment_id: string
}

type StartingEquipmentItemPropertyRow = {
  option_item_id: string
  property_code: string
}

type StartingEquipmentCurrencyRow = {
  option_item_id: string
  currency_id: string
  amount: number
}

type EquipmentAuthoredItem = Extract<
  StartingEquipmentItemAuthored,
  { startingEquipmentKind: 'EQUIPMENT' }
>

function requireStartingEquipmentKind(
  item: {
    id: string
    starting_equipment_kind: string
  }
): 'EQUIPMENT' | 'CURRENCY' {
  if (item.starting_equipment_kind !== 'EQUIPMENT' && item.starting_equipment_kind !== 'CURRENCY') {
    throw new Error(`Starting equipment item "${item.id}" has invalid starting_equipment_kind "${item.starting_equipment_kind}".`)
  }

  return item.starting_equipment_kind
}

function requireSelectionKind(
  item: {
    id: string
    selection_kind: string | null
  }
): 'CHOSEN' | 'GRANTED' {
  if (item.selection_kind !== 'CHOSEN' && item.selection_kind !== 'GRANTED') {
    throw new Error(`Starting equipment item "${item.id}" is missing selection_kind.`)
  }

  return item.selection_kind
}

function requireAuthoringModeKind(
  item: {
    id: string
    authoring_mode_kind: string | null
  }
): 'ALL' | 'SELECTED' {
  if (item.authoring_mode_kind !== 'ALL' && item.authoring_mode_kind !== 'SELECTED') {
    throw new Error(`Starting equipment item "${item.id}" is missing authoring_mode_kind.`)
  }

  return item.authoring_mode_kind
}

function requireCount(
  item: {
    id: string
    count: number | null
  }
): number {
  if (item.count == null) {
    throw new Error(`Starting equipment item "${item.id}" is missing count for CHOSEN selection.`)
  }

  return item.count
}

function requireNoGrantedCount(
  item: {
    id: string
    count: number | null
  }
) {
  if (item.count != null) {
    throw new Error(`Starting equipment item "${item.id}" cannot hydrate count for GRANTED selection.`)
  }
}

function requireQuantity(
  item: {
    id: string
    quantity: number | null
  }
): number {
  if (item.quantity == null) {
    throw new Error(`Starting equipment item "${item.id}" is missing quantity for GRANTED selection.`)
  }

  return item.quantity
}

function requireNoChosenQuantity(
  item: {
    id: string
    quantity: number | null
  }
) {
  if (item.quantity != null) {
    throw new Error(`Starting equipment item "${item.id}" cannot hydrate quantity for CHOSEN selection.`)
  }
}

function requireEquipmentCategoryCode(
  itemId: string,
  value: string | null
): EquipmentAuthoredItem['category'] | undefined {
  if (value == null) {
    return undefined
  }

  if (!(value in EQUIPMENT_CATEGORY_CODE)) {
    throw new Error(`Starting equipment item "${itemId}" has invalid category_code "${value}".`)
  }

  return value as EquipmentAuthoredItem['category']
}

function requireEquipmentPropertyCodes(
  itemId: string,
  values: string[] | undefined
): EquipmentAuthoredItem['properties'] | undefined {
  if (!values || values.length === 0) {
    return undefined
  }

  for (const value of values) {
    if (!(value in EQUIPMENT_PROPERTY_CODE)) {
      throw new Error(`Starting equipment item "${itemId}" has invalid property_code "${value}".`)
    }
  }

  return values as EquipmentAuthoredItem['properties']
}

function requirePersistedEquipmentIds(
  itemId: string,
  equipmentIds: string[] | undefined
): string[] {
  if (!equipmentIds || equipmentIds.length === 0) {
    throw new Error(`Starting equipment item "${itemId}" is missing equipmentIds for SELECTED payload.`)
  }

  return equipmentIds
}

function requirePersistedCurrencies(
  itemId: string,
  currencies: StartingEquipmentCurrencyRow[] | undefined
): StartingEquipmentCurrencyRow[] {
  if (!currencies || currencies.length === 0) {
    throw new Error(`Starting equipment item "${itemId}" is missing currencies for CURRENCY payload.`)
  }

  return currencies
}

function hydrateCurrencyItem(
  item: {
    id: string
    sort_order: number
  },
  currenciesByItemId: Map<string, StartingEquipmentCurrencyRow[]>
): StartingEquipmentItemAuthored {
  return {
    id: item.id,
    order: item.sort_order,
    startingEquipmentKind: 'CURRENCY',
    currencies: requirePersistedCurrencies(item.id, currenciesByItemId.get(item.id)).map((currency) => ({
      currencyId: currency.currency_id,
      amount: currency.amount
    }))
  }
}

function hydrateEquipmentItem(
  item: {
    id: string
    sort_order: number
    category_code: string | null
    count: number | null
    quantity: number | null
  },
  selectionKind: 'CHOSEN' | 'GRANTED',
  authoringModeKind: 'ALL' | 'SELECTED',
  itemPropertiesById: Map<string, string[]>,
  itemEquipmentById: Map<string, string[]>
): StartingEquipmentItemAuthored {
  const base = {
    id: item.id,
    order: item.sort_order,
    startingEquipmentKind: 'EQUIPMENT' as const,
    authoringModeKind,
    selectionKind,
    category: requireEquipmentCategoryCode(item.id, item.category_code),
    properties: requireEquipmentPropertyCodes(item.id, itemPropertiesById.get(item.id))
  }

  if (authoringModeKind === 'SELECTED' && selectionKind === 'CHOSEN') {
    requireNoGrantedCount(item)
    requireNoChosenQuantity({ ...item, quantity: item.quantity })
    return {
      ...base,
      authoringModeKind: 'SELECTED',
      selectionKind: 'CHOSEN',
      count: requireCount(item),
      equipmentIds: requirePersistedEquipmentIds(item.id, itemEquipmentById.get(item.id))
    }
  }

  if (authoringModeKind === 'SELECTED' && selectionKind === 'GRANTED') {
    requireNoGrantedCount({ ...item, count: item.count })
    return {
      ...base,
      authoringModeKind: 'SELECTED',
      selectionKind: 'GRANTED',
      quantity: requireQuantity(item),
      equipmentIds: requirePersistedEquipmentIds(item.id, itemEquipmentById.get(item.id))
    }
  }

  if (selectionKind === 'CHOSEN') {
    requireNoChosenQuantity(item)
    return {
      ...base,
      authoringModeKind: 'ALL',
      selectionKind: 'CHOSEN',
      count: requireCount(item)
    }
  }

  return {
    ...base,
    authoringModeKind: 'ALL',
    selectionKind: 'GRANTED',
    ...(requireNoGrantedCount(item), {}),
    quantity: requireQuantity(item)
  }
}

async function hydrateStartingEquipmentById(
  db: DBLike,
  id: string
): Promise<StartingEquipmentAuthored | null> {
  const root = await db
    .selectFrom('starting_equipment')
    .select('id')
    .where('id', '=', id)
    .executeTakeFirst()

  if (!root) return null

  const sets = await db
    .selectFrom('starting_equipment_sets')
    .select(['id', 'starting_equipment_id', 'sort_order'])
    .where('starting_equipment_id', '=', id)
    .orderBy('sort_order')
    .execute()

  const groups = await db
    .selectFrom('starting_equipment_groups')
    .select(['id', 'equipment_set_id', 'sort_order'])
    .execute()

  const options = await db
    .selectFrom('starting_equipment_options')
    .select(['id', 'equipment_group_id', 'sort_order'])
    .execute()

  const items = await db
    .selectFrom('starting_equipment_option_items')
    .select([
      'id',
      'equipment_option_id',
      'starting_equipment_kind',
      'authoring_mode_kind',
      'selection_kind',
      'category_code',
      'count',
      'quantity',
      'sort_order'
    ])
    .execute()

  const itemEquipment = await db
    .selectFrom('starting_equipment_option_item_equipment')
    .select(['option_item_id', 'equipment_id'])
    .execute() as StartingEquipmentItemEquipmentRow[]

  const itemProperties = await db
    .selectFrom('starting_equipment_option_item_properties')
    .select(['option_item_id', 'property_code'])
    .execute() as StartingEquipmentItemPropertyRow[]

  const currencies = await db
    .selectFrom('starting_equipment_currencies')
    .select(['option_item_id', 'currency_id', 'amount'])
    .execute() as StartingEquipmentCurrencyRow[]

  const itemEquipmentById = new Map<string, string[]>()
  for (const row of itemEquipment) {
    itemEquipmentById.set(row.option_item_id, [
      ...(itemEquipmentById.get(row.option_item_id) ?? []),
      row.equipment_id
    ])
  }

  const itemPropertiesById = new Map<string, string[]>()
  for (const row of itemProperties) {
    itemPropertiesById.set(row.option_item_id, [
      ...(itemPropertiesById.get(row.option_item_id) ?? []),
      row.property_code
    ])
  }

  const currenciesByItemId = new Map<string, StartingEquipmentCurrencyRow[]>()
  for (const row of currencies) {
    currenciesByItemId.set(row.option_item_id, [
      ...(currenciesByItemId.get(row.option_item_id) ?? []),
      row
    ])
  }

  const optionsByGroupId = new Map<string, StartingEquipmentOptionAuthored[]>()
  const itemsByOptionId = new Map<string, StartingEquipmentItemAuthored[]>()
  const groupsBySetId = new Map<string, StartingEquipmentGroupAuthored[]>()

  for (const item of items) {
    const startingEquipmentKind = requireStartingEquipmentKind(item)
    const authoredItem = startingEquipmentKind === 'CURRENCY'
      ? hydrateCurrencyItem(item, currenciesByItemId)
      : (() => {
          const selectionKind = requireSelectionKind(item)
          const authoringModeKind = requireAuthoringModeKind(item)

          return hydrateEquipmentItem(
            item,
            selectionKind,
            authoringModeKind,
            itemPropertiesById,
            itemEquipmentById
          )
        })()

    itemsByOptionId.set(item.equipment_option_id, [
      ...(itemsByOptionId.get(item.equipment_option_id) ?? []),
      authoredItem
    ])
  }

  for (const option of options) {
    optionsByGroupId.set(option.equipment_group_id, [
      ...(optionsByGroupId.get(option.equipment_group_id) ?? []),
      {
        id: option.id,
        order: option.sort_order,
        items: itemsByOptionId.get(option.id) ?? []
      }
    ])
  }

  for (const group of groups) {
    groupsBySetId.set(group.equipment_set_id, [
      ...(groupsBySetId.get(group.equipment_set_id) ?? []),
      {
        id: group.id,
        order: group.sort_order,
        options: optionsByGroupId.get(group.id) ?? []
      }
    ])
  }

  return {
    id: root.id,
    sets: sets.map((set) => ({
      id: set.id,
      order: set.sort_order,
      groups: groupsBySetId.get(set.id) ?? []
    }))
  }
}

export function createStartingEquipmentRepository(db: DBLike): StartingEquipmentRepository {
  return {
    async upsert(entity) {
      await upsertStartingEquipment(db, entity)
    },

    async findById(id) {
      return hydrateStartingEquipmentById(db, id)
    },

    async findAll() {
      const rows = await db
        .selectFrom('starting_equipment')
        .select('id')
        .orderBy('id')
        .execute()

      const records = await Promise.all(rows.map((row) => hydrateStartingEquipmentById(db, row.id)))
      return records.filter((record): record is StartingEquipmentAuthored => record !== null)
    }
  }
}
