import type { DeepKeyOf, MetaDataType, SourceTypeMap, Spell, Equipment, Class } from '~types'
import type { ReactElement } from 'react'

// For a path within a metadata object at T[K]
export type FooterPath<T extends MetaDataType, K extends keyof T> = {
  path: NonNullable<T[K]> extends Array<infer U> ? DeepKeyOf<NonNullable<U>> : never
  dependents?: boolean
  source?: {
    [S in keyof SourceTypeMap]: {
      type: S
      sourcePath?: DeepKeyOf<SourceTypeMap[S]>
      labelKey?: string
    }
  }[keyof SourceTypeMap]
}

export type FooterPathObject<T extends MetaDataType, K extends keyof T> = {
  subPaths?: FooterPath<T, K>[] | FooterPath<T, K>[][]
} & FooterPath<T, K>

// For a complete footer object
export type FooterObject<T extends MetaDataType> = {
  [K in keyof T]: {
    metaObject: K
    paths: FooterPathObject<T, K>[]
  }
}[keyof T]

export type FooterConfig<T extends MetaDataType> = {
  icon?: ReactElement
  value: string
  text: FooterObject<T> | FooterObject<T>[]
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
