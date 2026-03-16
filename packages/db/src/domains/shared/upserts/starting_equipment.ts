import type { DBLike } from '@db-types'
import type {
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  StartingEquipmentAuthored,
  StartingEquipmentSetAuthored,
  StartingEquipmentGroupAuthored,
  StartingEquipmentOptionAuthored,
  StartingEquipmentItemAuthored
} from '@artificer-toolkit/shared'
import {
  EQUIPMENT_CATEGORY_CODE as EQUIPMENT_CATEGORY_RUNTIME,
  EQUIPMENT_PROPERTY_CODE as EQUIPMENT_PROPERTY_RUNTIME
} from '@artificer-toolkit/shared'

type StartingEquipmentRow = {
  id: string
}

type StartingEquipmentSetRow = {
  id: string
  starting_equipment_id: string
  sort_order: number
}

type StartingEquipmentGroupRow = {
  id: string
  equipment_set_id: string
  sort_order: number
}

type StartingEquipmentOptionRow = {
  id: string
  equipment_group_id: string
  sort_order: number
}

type StartingEquipmentItemRow = {
  id: string
  equipment_option_id: string
  starting_equipment_kind: string
  authoring_mode_kind: string | null
  selection_kind: string | null
  category_code: string | null
  count: number | null
  quantity: number | null
  sort_order: number
}

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

type EquipmentItemWrite = {
  id: string
  order: number
  startingEquipmentKind: 'EQUIPMENT'
  authoringModeKind: 'ALL' | 'SELECTED'
  selectionKind: 'CHOSEN' | 'GRANTED'
  category?: string
  properties?: string[]
  count?: number
  quantity?: number
  equipmentIds?: string[]
}

type CurrencyItemWrite = {
  id: string
  order: number
  startingEquipmentKind: 'CURRENCY'
  currencies: {
    currencyId: string
    amount: number
  }[]
}

type StartingEquipmentWritePlan = {
  sets: StartingEquipmentSetRow[]
  groups: StartingEquipmentGroupRow[]
  options: StartingEquipmentOptionRow[]
  items: StartingEquipmentItemRow[]
  itemEquipment: StartingEquipmentItemEquipmentRow[]
  itemProperties: StartingEquipmentItemPropertyRow[]
  currencies: StartingEquipmentCurrencyRow[]
}

function requireStartingEquipmentKind(
  item: {
    id: string
    startingEquipmentKind: string
  }
): 'EQUIPMENT' | 'CURRENCY' {
  if (item.startingEquipmentKind !== 'EQUIPMENT' && item.startingEquipmentKind !== 'CURRENCY') {
    throw new Error(`Starting equipment item "${item.id}" has invalid startingEquipmentKind "${item.startingEquipmentKind}".`)
  }

  return item.startingEquipmentKind
}

function requireChosenCount(
  itemId: string,
  count: number | undefined
): number {
  if (count == null) {
    throw new Error(`Starting equipment item "${itemId}" is missing count for CHOSEN selection.`)
  }

  return count
}

function rejectGrantedCount(
  itemId: string,
  count: number | undefined
) {
  if (count == null) {
    return
  }

  throw new Error(`Starting equipment item "${itemId}" cannot persist count for GRANTED selection.`)
}

function requireGrantedQuantity(
  itemId: string,
  quantity: number | undefined
): number {
  if (quantity == null) {
    throw new Error(`Starting equipment item "${itemId}" is missing quantity for GRANTED selection.`)
  }

  return quantity
}

function rejectChosenQuantity(
  itemId: string,
  quantity: number | undefined
) {
  if (quantity == null) {
    return
  }

  throw new Error(`Starting equipment item "${itemId}" cannot persist quantity for CHOSEN selection.`)
}

function requireSelectedEquipmentIds(
  itemId: string,
  equipmentIds: string[] | undefined
): string[] {
  if (!equipmentIds || equipmentIds.length === 0) {
    throw new Error(`Starting equipment item "${itemId}" is missing equipmentIds for SELECTED payload.`)
  }

  return equipmentIds
}

function requireCurrencies(
  itemId: string,
  currencies: CurrencyItemWrite['currencies'] | undefined
): CurrencyItemWrite['currencies'] {
  if (!currencies || currencies.length === 0) {
    throw new Error(`Starting equipment item "${itemId}" is missing currencies for CURRENCY payload.`)
  }

  return currencies
}

function requireEquipmentCategoryCode(
  itemId: string,
  category: string | undefined
): keyof typeof EQUIPMENT_CATEGORY_CODE | null {
  if (!category) {
    return null
  }

  if (!(category in EQUIPMENT_CATEGORY_RUNTIME)) {
    throw new Error(`Starting equipment item "${itemId}" has invalid category "${category}".`)
  }

  return category as keyof typeof EQUIPMENT_CATEGORY_CODE
}

function requireEquipmentPropertyCodes(
  itemId: string,
  properties: string[] | undefined
): (keyof typeof EQUIPMENT_PROPERTY_CODE)[] {
  if (!properties) {
    return []
  }

  for (const property of properties) {
    if (!(property in EQUIPMENT_PROPERTY_RUNTIME)) {
      throw new Error(`Starting equipment item "${itemId}" has invalid property "${property}".`)
    }
  }

  return properties as (keyof typeof EQUIPMENT_PROPERTY_CODE)[]
}

function mapSetRow(
  startingEquipmentId: string,
  set: StartingEquipmentSetAuthored
): StartingEquipmentSetRow {
  return {
    id: set.id,
    starting_equipment_id: startingEquipmentId,
    sort_order: set.order
  }
}

function mapGroupRow(
  setId: string,
  group: StartingEquipmentGroupAuthored
): StartingEquipmentGroupRow {
  return {
    id: group.id,
    equipment_set_id: setId,
    sort_order: group.order
  }
}

function mapOptionRow(
  groupId: string,
  option: StartingEquipmentOptionAuthored
): StartingEquipmentOptionRow {
  return {
    id: option.id,
    equipment_group_id: groupId,
    sort_order: option.order
  }
}

function mapItemRow(
  optionId: string,
  item: StartingEquipmentItemAuthored
): StartingEquipmentItemRow {
  if (item.startingEquipmentKind === 'CURRENCY') {
    const currencyItem = item as CurrencyItemWrite

    return {
      id: currencyItem.id,
      equipment_option_id: optionId,
      starting_equipment_kind: currencyItem.startingEquipmentKind,
      authoring_mode_kind: null,
      selection_kind: null,
      category_code: null,
      count: null,
      quantity: null,
      sort_order: currencyItem.order
    }
  }

  const equipmentItem = item as EquipmentItemWrite

  return {
    id: equipmentItem.id,
    equipment_option_id: optionId,
    starting_equipment_kind: equipmentItem.startingEquipmentKind,
    authoring_mode_kind: equipmentItem.authoringModeKind,
    selection_kind: equipmentItem.selectionKind,
    category_code: requireEquipmentCategoryCode(equipmentItem.id, equipmentItem.category),
    count: equipmentItem.selectionKind === 'CHOSEN'
      ? requireChosenCount(equipmentItem.id, equipmentItem.count)
      : (
          'count' in equipmentItem
            ? (rejectGrantedCount(equipmentItem.id, equipmentItem.count), null)
            : null
        ),
    quantity: equipmentItem.selectionKind === 'GRANTED'
      ? requireGrantedQuantity(equipmentItem.id, equipmentItem.quantity)
      : (
          'quantity' in equipmentItem
            ? (rejectChosenQuantity(equipmentItem.id, equipmentItem.quantity), null)
            : null
        ),
    sort_order: equipmentItem.order
  }
}

function buildWritePlan(json_data: StartingEquipmentAuthored): StartingEquipmentWritePlan {
  const plan: StartingEquipmentWritePlan = {
    sets: [],
    groups: [],
    options: [],
    items: [],
    itemEquipment: [],
    itemProperties: [],
    currencies: []
  }

  for (const set of json_data.sets) {
    plan.sets.push(mapSetRow(json_data.id, set))

    for (const group of set.groups) {
      plan.groups.push(mapGroupRow(set.id, group))

      for (const option of group.options) {
        plan.options.push(mapOptionRow(group.id, option))

        for (const item of option.items) {
          const startingEquipmentKind = requireStartingEquipmentKind(item)
          plan.items.push(mapItemRow(option.id, item))

          if (startingEquipmentKind === 'EQUIPMENT') {
            const equipmentItem = item as EquipmentItemWrite
            const validatedProperties = requireEquipmentPropertyCodes(item.id, equipmentItem.properties)

            if (equipmentItem.authoringModeKind === 'SELECTED') {
              plan.itemEquipment.push(...requireSelectedEquipmentIds(item.id, equipmentItem.equipmentIds).map((equipmentId) => ({
                option_item_id: item.id,
                equipment_id: equipmentId
              })))
            }

            plan.itemProperties.push(...validatedProperties.map((property) => ({
              option_item_id: item.id,
              property_code: property
            })))
          } else {
            const currencyItem = item as CurrencyItemWrite
            plan.currencies.push(...requireCurrencies(item.id, currencyItem.currencies).map((currency) => ({
              option_item_id: item.id,
              currency_id: currency.currencyId,
              amount: currency.amount
            })))
          }
        }
      }
    }
  }

  return plan
}

export async function upsertStartingEquipment(
  db: DBLike,
  json_data: StartingEquipmentAuthored
) {
  const plan = buildWritePlan(json_data)
  const trx = await db.startTransaction().execute()

  try {
    await trx
      .insertInto('starting_equipment')
      .values({ id: json_data.id } satisfies StartingEquipmentRow)
      .onConflict((oc) => oc.column('id').doNothing())
      .execute()

    await trx
      .deleteFrom('starting_equipment_sets')
      .where('starting_equipment_id', '=', json_data.id)
      .execute()

    for (const set of plan.sets) {
      await trx
        .insertInto('starting_equipment_sets')
        .values(set)
        .execute()
    }

    for (const group of plan.groups) {
      await trx
        .insertInto('starting_equipment_groups')
        .values(group)
        .execute()
    }

    for (const option of plan.options) {
      await trx
        .insertInto('starting_equipment_options')
        .values(option)
        .execute()
    }

    for (const item of plan.items) {
      await trx
        .insertInto('starting_equipment_option_items')
        .values(item)
        .execute()
    }

    if (plan.itemEquipment.length > 0) {
      await trx
        .insertInto('starting_equipment_option_item_equipment')
        .values(plan.itemEquipment)
        .execute()
    }

    if (plan.itemProperties.length > 0) {
      await trx
        .insertInto('starting_equipment_option_item_properties')
        .values(plan.itemProperties)
        .execute()
    }

    if (plan.currencies.length > 0) {
      await trx
        .insertInto('starting_equipment_currencies')
        .values(plan.currencies)
        .execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
