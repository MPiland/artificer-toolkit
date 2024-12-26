import { PropertyPath } from 'lodash'

export type Filter = {
  key: string
  array?: any[]
  dataObject?: any
  mapKey?: string
  type: 'equal' | 'notEqual'
  dataField?: string | null
  matchingKey?: string
}

export type RowInput = {
  value?: string
  breakpoint?: string[]
  options?: any[]
  validation?: 'num' | 'cur' | 'die'
  errorMsg?: string
  name?: string
  readOnly?: boolean
  type?: 'input' | 'select'
  filter?: Filter[]
  multiple?: boolean
  required?: boolean
  optionalKey?: string
  placeholder?: string
  id?: string
}

export type RowHeader = {
  label?:
    | string
    | {
        sortOn: string
        orderKey?: string
        order?: Array<{ [key: number]: string }>
        filter?: {
          filterOn: string | PropertyPath
          filterKey: string
        }
        subSort?: {
          sortOn: string
          orderKey?: string
        }
      }
  value?: string
  required?: boolean
  breakpoint?: string[]
  defaultSort?: boolean
}

export type SortConfig = {
  key: {
    orderKey?: string | PropertyPath
    order?: any[]
    sortOn: string | PropertyPath
    subSort?: {
      orderKey?: string | PropertyPath
      order?: any[]
      sortOn: string | PropertyPath | undefined
    }
    filter?: {
      filterKey: string
      filterOn: string | PropertyPath
    }
  }
  direction?: 'ascending' | 'descending'
}

export type ReducerAction = {
  type?: 'added' | 'reset' | 'removed'
  target: {
    name?: string | string[]
    value?: any
  }
}

export type DropdownOption = {
  label: string | number | null | undefined
  value: string | number | null | undefined
  id: string
  [key: string]: any
}

export type DiceType = 4 | 6 | 8 | 10 | 12 | 20 | 100
export type KeepType = 'kh' | 'kl'
export type DropType = 'dh' | 'dl'
export type RerollType = 'r' | 'ro'
export type RerollCondition = '>' | '<' | '==='

export type RollConfig = `${number}d${DiceType}${'' | `${KeepType}${number}`}${'' | `${DropType}${number}`}${
  | ''
  | `${RerollType}${'' | RerollCondition}${number}`}`

export type DiceResult = {
  die: number
  value: number
  id?: string
}

export type DiceConfig = {
  quantity: number
  type: DiceType
  rerollType?: RerollType
  rerollCondition?: RerollCondition
  rerollValue?: number
}

export type DiceRolls = {
  score: number | null
  ability: any
  rolling: boolean
  rolled: DiceResult[]
  kept: DiceResult[]
  applied: boolean
}

export type Point = { x: number; y: number; z: number }
