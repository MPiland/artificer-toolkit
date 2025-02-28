import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { set as lSet, get, camelCase, PropertyPath } from 'lodash'
import { produce } from 'immer'
import { FormDataType, SectionDataType } from '../types/form'
import { formSlice, FormSlice } from './formSlice'
import { featureSlice, FeatureSlice } from './featureSlice'
import { optionSlice, OptionSlice } from './optionsSlice'
import { AncestryOption, Feature, FeatureOption, FeatureSubfeature } from '../../amplify/gql/types'
import { SectionSlice, sectionSlice } from './sectionSlice'
import { subfeatureSlice, SubfeatureSlice } from './subfeatureSlice'
import { ancestrySlice, AncestrySlice } from './ancestrySlice'
import { diceSlice, DiceSlice } from './diceSlice'

export type SupportedStates =
  | FormDataType
  | Feature
  | FeatureOption
  | AncestryOption
  | SectionDataType
  | FeatureSubfeature
  | DiceSlice

export type CombinedSlice = FormSlice &
  FeatureSlice &
  OptionSlice &
  SectionSlice &
  SubfeatureSlice &
  AncestrySlice &
  DiceSlice

const isNumber = (str: string): boolean => {
  return !isNaN(parseFloat(str)) && isFinite(Number(str))
}

export const addField = ({
  path,
  value,
  selector,
}: {
  path: string | string[]
  value?: any
  selector: (state: CombinedSlice) => SupportedStates
}) => {
  return (state: CombinedSlice) => {
    return produce(state, (draft) => {
      const targetState = selector(draft)
      const existing = get(targetState, path)

      if (existing) {
        if (!value) {
          // If existing is an array of arrays, add a new array
          if (Array.isArray(existing) && existing.length > 0 && Array.isArray(existing[0])) {
            get(targetState, path).push([])
          } else {
            get(targetState, path).push({})
          }
        } else {
          lSet(targetState, path, value)
        }
      } else {
        lSet(targetState, path, value || [{}])
      }
    })
  }
}

export const removeField = ({
  path,
  selector,
}: {
  path: string | string[]
  selector: (state: CombinedSlice) => SupportedStates
}) => {
  return (state: CombinedSlice) => {
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
          delete targetState[statePath[0] as keyof SupportedStates]
        }
      } else {
        const newPath = statePath.slice(0, -1)
        const array = get(targetState, newPath)
        lSet(
          targetState,
          newPath,
          array.filter((_: any, index: number) => index !== Number(lastKey))
        )
      }
    })
  }
}

export const updateField = ({
  path,
  value,
  selector,
}: {
  path: string | string[]
  value: any
  selector: (state: CombinedSlice) => SupportedStates
}) => {
  return (state: CombinedSlice) => {
    return produce(state, (draft) => {
      const targetState = selector(draft)
      let statePath: string[] | null

      if (!Array.isArray(path)) {
        statePath = path.split('.')
      } else {
        statePath = path
      }

      lSet(targetState, statePath as PropertyPath, value)

      if (statePath && statePath[statePath.length - 1] === 'label') {
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

export const reset = ({ value, selector }: { value: any; selector: (state: CombinedSlice) => SupportedStates }) => {
  return (state: CombinedSlice) => {
    return produce(state, (draft: any) => {
      const targetStateKey = Object.keys(draft).find((key) => selector(draft) === draft[key])
      if (targetStateKey) {
        draft[targetStateKey] = { ...value }
      }
    })
  }
}

export const useStore = create<CombinedSlice>()(
  persist(
    (...a) => ({
      ...formSlice(...a),
      ...featureSlice(...a),
      ...optionSlice(...a),
      ...sectionSlice(...a),
      ...subfeatureSlice(...a),
      ...ancestrySlice(...a),
      ...diceSlice(...a),
    }),
    {
      name: 'at-app-form',
    }
  )
)
