import { DeepKeyOf, SourceTypeMap, SourceDataType } from '~types'

export type DetailObject<T extends SourceDataType> = {
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
export type DetailItem<T extends SourceDataType> = DetailObject<T> | DetailObject<T>[]

// Array of DetailItems, which allows mixing objects and arrays
export type DetailArray<T extends SourceDataType> = DetailItem<T>[] | DetailArray<T>[]

export type DetailConfig<T extends SourceDataType> = {
  header: string
  text: DetailObject<T> | DetailArray<T>
  truncate?: number
  filter?: undefined | string[]
}
