import { assertNever } from '#utils'

import type { StartingEquipmentGroupAuthored, StartingEquipmentOptionAuthored, StartingEquipmentItemAuthored, StartingEquipmentSetAuthored, StartingEquipmentAuthored } from '#authored'
import { AUTHORING_MODE_KIND, AUTHORING_SELECTION_KIND, STARTING_EQUIPMENT_KIND } from '#core'
import type { EquipmentCategoryCode, EquipmentPropertyCode } from '#core'

export interface CompiledStartingEquipment {
  id: string
  sets: CompiledEquipmentSet[]
}

export interface CompiledEquipmentSet {
  id: string
  order: number
  groups: CompiledEquipmentGroup[]
}

export interface CompiledEquipmentGroup {
  id: string
  order: number
  options: CompiledEquipmentOption[]
}

export interface CompiledEquipmentOption {
  id: string
  order: number
  items: CompiledEquipmentOptionItem[]
}

export type CompiledEquipmentOptionItem = {
  startingEquipmentKind: typeof STARTING_EQUIPMENT_KIND.CURRENCY
  currencies: CompiledEquipmentCurrency[]
} | (
  {
    startingEquipmentKind: typeof STARTING_EQUIPMENT_KIND.EQUIPMENT
  } & CompiledEquipmentOptionItemBase & CompiledStartingEquipmentOptionItemSelectionType
)

export type CompiledEquipmentOptionItemBase = {
  id: string
  order: number // int
  category?: EquipmentCategoryCode
  properties?: EquipmentPropertyCode[]
} & (
  {
    authoringModeKind: typeof AUTHORING_MODE_KIND.ALL
  } | {
    authoringModeKind: typeof AUTHORING_MODE_KIND.SELECTED
    equipmentIds: string[]
  }
)

export type CompiledStartingEquipmentOptionItemSelectionType = {
  selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN
  count: number // int
} | {
  selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED
  quantity: number // int
}

export interface CompiledEquipmentCurrency {
  currencyId: string
  amount: number // int
}

type CurrencyStartingEquipmentItem = StartingEquipmentItemAuthored & {
  startingEquipmentKind: typeof STARTING_EQUIPMENT_KIND.CURRENCY
  currencies: CompiledEquipmentCurrency[]
}

type EquipmentStartingEquipmentItem = StartingEquipmentItemAuthored & {
  startingEquipmentKind: typeof STARTING_EQUIPMENT_KIND.EQUIPMENT
  category?: EquipmentCategoryCode
  properties?: EquipmentPropertyCode[]
  selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN | typeof AUTHORING_SELECTION_KIND.GRANTED
} & (
    | {
      selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN
      count: number
    }
    | {
      selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED
      quantity: number
    }
  ) & (
    | {
      authoringModeKind: typeof AUTHORING_MODE_KIND.ALL
    }
    | {
      authoringModeKind: typeof AUTHORING_MODE_KIND.SELECTED
      equipmentIds: string[]
    }
  )

export function compileStartingEquipmentSet(set: StartingEquipmentSetAuthored): CompiledEquipmentSet {
  return {
    id: set.id,
    order: set.order,
    groups: set.groups.map((group) => compileStartingEquipmentGroup(group))
  }
}

export function compileStartingEquipmentGroup(group: StartingEquipmentGroupAuthored): CompiledEquipmentGroup {
  return {
    id: group.id,
    order: group.order,
    options: group.options.map((option) => compileStartingEquipmentOption(option))
  }
}

export function compileStartingEquipmentOption(option: StartingEquipmentOptionAuthored): CompiledEquipmentOption {
  return {
    id: option.id,
    order: option.order,
    items: option.items.map((item) => compileStartingEquipmentItem(item))
  }
}

export function compileStartingEquipmentItem(item: StartingEquipmentItemAuthored): CompiledEquipmentOptionItem {
  const base: Pick<CompiledEquipmentOptionItemBase, 'id' | 'order'> = {
    id: item.id,
    order: item.order
  }

  switch (item.startingEquipmentKind) {
    case STARTING_EQUIPMENT_KIND.CURRENCY: {
      const currencyItem = item as CurrencyStartingEquipmentItem
      return {
        ...base,
        startingEquipmentKind: currencyItem.startingEquipmentKind,
        currencies: currencyItem.currencies
      }
    }

    case STARTING_EQUIPMENT_KIND.EQUIPMENT: {
      const equipmentItem = item as EquipmentStartingEquipmentItem
      const itemBase = {
        ...base,
        startingEquipmentKind: equipmentItem.startingEquipmentKind,
        properties: equipmentItem.properties,
        category: equipmentItem.category
      }

      const selectionBase = (() => {
        switch (equipmentItem.selectionKind) {
          case AUTHORING_SELECTION_KIND.CHOSEN:
            return {
              ...itemBase,
              selectionKind: equipmentItem.selectionKind,
              count: equipmentItem.count
            }
          case AUTHORING_SELECTION_KIND.GRANTED:
            return {
              ...itemBase,
              selectionKind: equipmentItem.selectionKind,
              quantity: equipmentItem.quantity
            }
          default:
            return assertNever(equipmentItem as never)
        }
      })()

      switch (equipmentItem.authoringModeKind) {
        case AUTHORING_MODE_KIND.ALL:
          return {
            ...selectionBase,
            authoringModeKind: AUTHORING_MODE_KIND.ALL
          }

        case AUTHORING_MODE_KIND.SELECTED:
          return {
            ...selectionBase,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            equipmentIds: equipmentItem.equipmentIds
          }
        default:
          return assertNever(equipmentItem as never)
      }
    }
    default:
      return assertNever(item as never)
  }
}

export function compileStartingEquipment(authored: StartingEquipmentAuthored): CompiledStartingEquipment {
  return {
    id: authored.id,
    sets: authored.sets.map((set) => compileStartingEquipmentSet(set))
  }
}
