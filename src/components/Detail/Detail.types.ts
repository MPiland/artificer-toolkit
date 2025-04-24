import { DeepKeyOf, FormDataType, SourceTypeMap } from '@/types'

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
