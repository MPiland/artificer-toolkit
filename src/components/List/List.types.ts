import type { DeepKeyOf, MetaDataType, SourceTypeMap, Spell, Equipment, Class } from '@/types'
import type { ReactElement } from 'react'

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

export type FilterDataType = Partial<Spell> | Partial<Equipment> | Partial<Class>
