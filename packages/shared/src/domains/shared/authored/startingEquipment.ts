import type { AUTHORING_MODE_KIND, AUTHORING_SELECTION_KIND, AuthoringSelectionKind, EquipmentCategoryCode, EquipmentPropertyCode, STARTING_EQUIPMENT_KIND, StartingEquipmentKind } from '#core'
import type { FacetAuthored } from './facet.js'

export interface StartingEquipmentAuthored {
  id: string
  sets: StartingEquipmentSetAuthored[]
}

export interface StartingEquipmentSetAuthored {
  id: string
  order: number // int
  groups: StartingEquipmentGroupAuthored[]
}

export interface StartingEquipmentGroupAuthored {
  id: string
  order: number // int
  options: StartingEquipmentOptionAuthored[]
}

export interface StartingEquipmentOptionAuthored {
  id: string
  order: number // int
  eligibility?: FacetAuthored<'CHARACTER'>
  items: StartingEquipmentItemAuthored[]
}

export type SelectionPayloadByKind = {
  [AUTHORING_SELECTION_KIND.CHOSEN]: {
    count: number // int
  }
  [AUTHORING_SELECTION_KIND.GRANTED]: {
    quantity: number // int
  }
}

type SelectionPayload<K extends AuthoringSelectionKind> = SelectionPayloadByKind[K]

export type StartingEquipmentItemPayloadByKind<K extends AuthoringSelectionKind> = {
  [STARTING_EQUIPMENT_KIND.CURRENCY]: {
    currencies: StartingEquipmentCurrencyAuthored[]
  }
  [STARTING_EQUIPMENT_KIND.EQUIPMENT]: {
    id: string
    order: number // int
    category?: EquipmentCategoryCode
    properties?: EquipmentPropertyCode[]
    selectionKind: K
  } & SelectionPayload<K> & (
    {
      authoringModeKind: typeof AUTHORING_MODE_KIND.ALL
    } | {
      authoringModeKind: typeof AUTHORING_MODE_KIND.SELECTED
      equipmentIds: string[]
    }
  )
}

type StartingEquipmentItemPayloadBy<K extends StartingEquipmentKind, A extends AuthoringSelectionKind = AuthoringSelectionKind> = StartingEquipmentItemPayloadByKind<A>[K]

export type StartingEquipmentItemAuthored<K extends StartingEquipmentKind = StartingEquipmentKind> = {
  id: string
  order: number // intF
  startingEquipmentKind: K
} & StartingEquipmentItemPayloadBy<K>

export interface StartingEquipmentCurrencyAuthored {
  currencyId: string
  amount: number // int
}
