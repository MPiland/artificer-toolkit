import { PropertyPath } from 'lodash'
import { ReactNode } from 'react'
import { DeepKeyOf, FormDataType } from './form'

export interface FilterConfig<T extends FormDataType> {
  type: 'text' | 'dropdown' | 'multiSelect' | 'range' | 'checkbox'
  path: DeepKeyOf<T>
  label: string
  options?: Array<{ value: any; label: string; id: string }>
  getOptionsFromData?: (data: FormDataType[]) => Array<{ value: any; label: string; id: string }>
}

export type UpdateFilter<T extends FormDataType> =
  | { type: 'update'; path: DeepKeyOf<T>; value: any }
  | { type: 'remove'; path: DeepKeyOf<T> }

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
  label: string | number | null | undefined | ReactNode
  value: string | number | null | undefined
  id: string
  [key: string]: any
  renderedLabel?: string | number | null | undefined | ReactNode
}

export type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100 | null
export type KeepType = 'kh' | 'kl' | null
export type DropType = 'dh' | 'dl' | null
export type RerollType = 'r' | 'ro' | null
export type RerollCondition = '>' | '<' | '===' | null

export type RollConfig = `${number | null}d${DieType}${'' | `${KeepType}${number}`}${'' | `${DropType}${number}`}${
  | ''
  | `${RerollType}${'' | RerollCondition}${number}`}`

export type DiceResult = {
  die: number
  value: number
  id?: string
}

export type DiceConfig = {
  quantity: number | null
  die: DieType
  rerollType?: RerollType
  rerollCondition?: RerollCondition
  rerollValue?: number
  keepType?: KeepType
  keepCount?: number
  dropType?: DropType
  dropCount?: number
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
