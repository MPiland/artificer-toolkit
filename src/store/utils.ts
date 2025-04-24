import type { FeatureDataType, FormDataType, SectionDataType, AncestryOption } from '@/types'
import { produce, type Draft } from 'immer'
import { get, has, set as lSet, camelCase, PropertyPath } from 'lodash'
import type { FormStore } from './formStore'
import type { FeatureStore } from './featureStore'
import type { AncestryStore } from './ancestryStore'
import type { SectionStore } from './sectionStore'
import type { OptionStore } from './optionStore'

export type States = FormDataType | FeatureDataType | SectionDataType | AncestryOption
type Stores = FormStore<FormDataType> | FeatureStore | AncestryStore | SectionStore<SectionDataType> | OptionStore

const isNumber = (str: string): boolean => {
  return !isNaN(parseFloat(str)) && isFinite(Number(str))
}

export const addField = <T extends Stores, U extends States>({
  path,
  value,
  selector,
}: {
  path: string | string[]
  value?: any
  selector: (state: Draft<T>) => U
}) => {
  return (state: T) => {
    return produce(state, (draft) => {
      const targetState = selector(draft)
      const pathExists = has(targetState, path)

      if (pathExists) {
        const existing = get(targetState, path)

        if (Array.isArray(existing) && existing.length > 0) {
          if (!value) {
            // If existing is an array of arrays, add a new array
            if (existing.length > 0 && Array.isArray(existing[0])) {
              lSet(targetState, path, [...existing, []])
            } else {
              lSet(targetState, path, [...existing, {}])
            }
          } else {
            lSet(targetState, path, value)
          }
        } else {
          lSet(targetState, path, value || [{}])
        }
      } else {
        lSet(targetState, path, value || [{}])
      }
    })
  }
}

export const removeField = <T extends Stores, U extends States>({
  path,
  selector,
}: {
  path: string | string[]
  selector: (state: Draft<T>) => U
}) => {
  return (state: T) => {
    return produce(state, (draft) => {
      const targetState = selector(draft)
      const statePath: string[] = Array.isArray(path) ? path : path.split('.')
      const lastKey = statePath[statePath.length - 1]

      if (!isNumber(lastKey)) {
        const newPath = [...statePath]
        newPath.pop()
        if (statePath.length > 1) {
          const target = get(targetState, newPath)
          delete target[statePath[statePath.length - 1]]
        } else {
          delete targetState[statePath[0] as keyof U]
        }
      } else {
        const newPath = statePath.slice(0, -1)
        const array = get(targetState, newPath)
        if (array.length > 1) {
          lSet(
            targetState,
            newPath,
            array.filter((_: any, index: number) => index !== Number(lastKey))
          )
        } else {
          lSet(targetState, newPath, undefined)
        }
      }
    })
  }
}

export const updateField = <T extends Stores, U extends States>({
  path,
  value,
  selector,
}: {
  path: string | string[]
  value: any
  selector: (state: Draft<T>) => U
}) => {
  return (state: T) => {
    return produce(state, (draft) => {
      const targetState = selector(draft)
      let statePath: string[] | null

      if (!Array.isArray(path)) {
        statePath = path.split('.')
      } else {
        statePath = path
      }

      lSet(targetState, statePath as PropertyPath, value)

      if (statePath && statePath.length > 1 && statePath[statePath.length - 1] === 'label') {
        if (statePath.length === 1) {
          lSet(targetState, 'value', camelCase(value))
        } else {
          const newPath = [...statePath]
          newPath.pop()
          newPath.push('value')
          lSet(targetState, newPath, camelCase(value))
        }
      }
    })
  }
}

export const reset = <T extends Stores, U extends States>({
  value,
  selector,
}: {
  value: Partial<U>
  selector: (state: Draft<T>) => U
}) => {
  return (state: T) => {
    return produce(state, (draft) => {
      const targetState = selector(draft)
      Object.assign(targetState, value)
    })
  }
}
