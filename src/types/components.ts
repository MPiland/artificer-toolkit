import { PropertyPath } from 'lodash'
import { type ReactElement } from 'react'
import { DeepKeyOf, type FormDataType, type MetaDataType } from './form'
import type { Background, Class, Equipment, Feat, Race, Spell, System } from '../../amplify/gql/types'

type SourceTypeMap = {
  spells: Spell
  classes: Class
  equipment: Equipment
  system: System
  races: Race
  feats: Feat
  backgrounds: Background
}

export type DetailObject<T extends FormDataType> = {
  path: DeepKeyOf<T>
  source?: {
    [S in keyof SourceTypeMap]: {
      type: S
      path?: DeepKeyOf<SourceTypeMap[S]>
      labelKey?: string
    }
  }[keyof SourceTypeMap]
}

// Can be either a DetailObject or an array of DetailObjects
export type DetailItem<T extends FormDataType> = DetailObject<T> | DetailObject<T>[]

// Array of DetailItems, which allows mixing objects and arrays
export type DetailArray<T extends FormDataType> = DetailItem<T>[] | DetailArray<T>[]

export type DetailConfig<T extends FormDataType> = {
  header: string
  text: DetailObject<T> | DetailArray<T>
  truncate?: number
  filter?: undefined | string[]
}

export type FooterObject<T extends MetaDataType> = {
  [K in keyof T]: {
    metaPath: K
    subMetaPath?: NonNullable<T[K]> extends Array<infer U> ? DeepKeyOf<NonNullable<U>> : never
    source?: {
      [S in keyof SourceTypeMap]: {
        type: S
        sourcePath?: DeepKeyOf<SourceTypeMap[S]>
        labelKey?: string
      }
    }[keyof SourceTypeMap]
  }
}[keyof T]

// Can be either a FooterObject or an array of FooterObjects
export type FooterItem<T extends MetaDataType> = FooterObject<T> | FooterObject<T>[]

// Array of FooterItems, which allows mixing objects and arrays
export type FooterArray<T extends MetaDataType> = FooterItem<T>[] | FooterArray<T>[]

export type FooterConfig<T extends MetaDataType> = {
  icon?: ReactElement
  value: string
  text: FooterObject<T> | FooterArray<T>
  display?: 'list'
}

export interface FilterConfig<T, K> {
  type: 'text' | 'dropdown' | 'multiSelect' | 'range' | 'checkbox'
  path: DeepKeyOf<T>
  label: string
  options?: {
    metaPath: keyof K
    source?: {
      [S in keyof SourceTypeMap]: {
        type: S
        sourcePath: DeepKeyOf<SourceTypeMap[S]>
      }
    }[keyof SourceTypeMap]
  }
}

export type FilterDataType = Partial<Spell> | Partial<Equipment> | Partial<Class>

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
  label: string | number | null | undefined
  value: string | number | null | undefined
  id: string
  [key: string]: any
  renderedLabel?: string | number | null | undefined | ReactElement
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
