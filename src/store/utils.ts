import type { FeatureFormDataType, FormDataType, SectionFormDataType, AncestryOptionInput } from '@/types'
import { produce, type Draft } from 'immer'
import { get, set, PropertyPath, toPath } from 'lodash'
import type { FormStore } from './formStore'
import type { FeatureStore } from './featureStore'
import type { AncestryStore } from './ancestryStore'
import type { SenseStore } from './senseStore'
import type { OptionStore } from './optionStore'
import type { ModifierStore } from './modifierStore'
import type { SpellStore } from './spellStore'
import type { ProficiencyStore } from './proficiencyStore'
import type { ExpertiseStore } from './expertiseStore'
import type { FeatStore } from './featStore'

export type States = FormDataType | FeatureFormDataType | SectionFormDataType | AncestryOptionInput
type Stores =
  | FormStore
  | FeatureStore
  | AncestryStore
  | SenseStore
  | OptionStore
  | ModifierStore
  | SpellStore
  | ProficiencyStore
  | ExpertiseStore
  | FeatStore

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

      set(targetState, statePath as PropertyPath, value)
    })
  }
}
