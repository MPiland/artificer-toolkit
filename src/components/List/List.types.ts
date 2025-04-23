import type { DeepKeyOf, FormDataType, MetaDataType, GQL } from '@/types'
import type { ReactElement } from 'react'

type SourceTypeMap = {
  spells: GQL.Spell
  classes: GQL.Class
  equipment: GQL.Equipment
  system: GQL.System
  races: GQL.Race
  feats: GQL.Feat
  backgrounds: GQL.Background
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

export interface FilterConfig<T extends FilterDataType, K> {
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

export type FilterDataType = Partial<GQL.Spell> | Partial<GQL.Equipment> | Partial<GQL.Class>
