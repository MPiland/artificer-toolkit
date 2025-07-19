import type { FeatureFormDataType, FormDataType, SectionFormDataType, AncestryOptionInput } from '@/types'
import { produce, type Draft } from 'immer'
import { get, set, PropertyPath, toPath, isEqual } from 'lodash'
import type { FormStore } from './formStore'
import type { FeatureStore } from './featureStore'
import type { AncestryOptionStore } from './ancestryOptionStore'
import type { FeatureSenseStore } from './featureSenseStore'
import type { FeatureOptionStore } from './featureOptionStore'
import type { FeatureModifierStore } from './featureModifierStore'
import type { FeatureSpellStore } from './featureSpellStore'
import type { FeatureProficiencyStore } from './featureProficiencyStore'
import type { FeatureExpertiseStore } from './featureExpertiseStore'
import type { FeatureFeatStore } from './featureFeatStore'

export type States = FormDataType | FeatureFormDataType | SectionFormDataType | AncestryOptionInput
type Stores =
  | FormStore<FormDataType>
  | FeatureStore
  | AncestryOptionStore
  | FeatureSenseStore
  | FeatureOptionStore
  | FeatureModifierStore
  | FeatureSpellStore
  | FeatureProficiencyStore
  | FeatureExpertiseStore
  | FeatureFeatStore

const isNumber = (str: string): boolean => {
  return !isNaN(parseFloat(str)) && isFinite(Number(str))
}

export const removeField = <T extends Stores, U extends States>({
  path,
  selector,
}: {
  path: string | string[]
  selector: (state: Draft<T>) => U
}) => {
  return (state: T) => {
    return produce(state, (draft: Draft<T>) => {
      const targetState = selector(draft)
      const statePath: string[] = Array.isArray(path) ? path : toPath(path)
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
          set(
            targetState,
            newPath,
            array.filter((_: unknown, index: number) => index !== Number(lastKey))
          )
        } else {
          set(targetState, newPath, undefined)
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
  value: unknown
  selector: (state: Draft<T>) => U
}) => {
  return (state: T) => {
    return produce(state, (draft: Draft<T>) => {
      const targetState = selector(draft)
      let statePath: string[] | null

      if (!Array.isArray(path)) {
        statePath = toPath(path)
      } else {
        statePath = path
      }

      // Only update if the values are different
      const currentValue = get(targetState, statePath as PropertyPath)
      if (!isEqual(currentValue, value)) {
        set(targetState, statePath as PropertyPath, value)
      }
    })
  }
}
