import { PropertyPath } from 'lodash'
import { ReactNode } from 'react'
import { DeepKeyOf } from './form'

export interface FilterConfig<T> {
  type: 'text' | 'dropdown' | 'multiSelect' | 'range' | 'checkbox'
  path: DeepKeyOf<T>
  label: string
  options?: Array<{ value: any; label: string; id: string }>
  getOptionsFromData?: (data: T[] | null | undefined) => { value: any; label: string; id: string }[]
}

export type UpdateFilter<T> =
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

export type DropdownOption = {
  label: string | number | null | undefined | ReactNode
  value: string | number | null | undefined
  id: string
  [key: string]: any
  renderedLabel?: string | number | null | undefined | ReactNode
}

export type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100 | 0
export type KeepType = 'kh' | 'kl' | null
export type DropType = 'dh' | 'dl' | null
export type RerollType = 'r' | 'ro' | null
export type RerollCondition = '>' | '<' | '===' | null

export type RollConfig = `${number | 0}d${DieType}${'' | `${KeepType}${number}`}${'' | `${DropType}${number}`}${
  | ''
  | `${RerollType}${'' | RerollCondition}${number}`}`

export type DiceResult = {
  die: number
  value: number
  id?: string | null
}

export type DiceConfig = {
  quantity: number
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
  kept?: DiceResult[] | null
  applied: boolean
}

export type Point = { x: number; y: number; z: number }
