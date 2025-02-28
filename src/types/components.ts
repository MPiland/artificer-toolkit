import { PropertyPath } from 'lodash'
import { ReactNode } from 'react'

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

export type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100
export type KeepType = 'kh' | 'kl'
export type DropType = 'dh' | 'dl'
export type RerollType = 'r' | 'ro'
export type RerollCondition = '>' | '<' | '==='

export type RollConfig = `${number}d${DieType}${'' | `${KeepType}${number}`}${'' | `${DropType}${number}`}${
  | ''
  | `${RerollType}${'' | RerollCondition}${number}`}`

export type DiceResult = {
  die: number
  value: number
  id?: string
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
  kept: DiceResult[]
  applied: boolean
}

export type Point = { x: number; y: number; z: number }
