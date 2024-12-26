import { create } from 'zustand'
import { set as lSet, get, camelCase, PropertyPath, merge } from 'lodash'
import { produce } from 'immer'
import { FormDataType, SectionDataType } from '../types/form'
import { formSlice, FormSlice } from './formSlice'
import { featureSlice, FeatureSlice } from './featureSlice'
import { optionSlice, OptionSlice } from './optionsSlice'
import { AncestryFeature, Feature, FeatureOption, Subfeature } from '../../amplify/API'
import { SectionSlice, sectionSlice } from './sectionSlice'
import { subfeatureSlice, SubfeatureSlice } from './subfeatureSlice'
import { ancestrySlice, AncestrySlice } from './ancestrySlice'

export type SupportedStates = FormDataType | Feature | FeatureOption | AncestryFeature | SectionDataType | Subfeature

export type CombinedSlice = FormSlice & FeatureSlice & OptionSlice & SectionSlice & SubfeatureSlice & AncestrySlice

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
      let statePath: string[] | null

      if (!Array.isArray(path)) {
        statePath = path.split('.')
      } else {
        statePath = path
      }

      if (get(targetState, statePath as PropertyPath)) {
        if (!value) {
          get(targetState, statePath as PropertyPath).push({})
        } else {
          lSet(targetState, statePath as PropertyPath, value)
        }
      } else {
        lSet(targetState, statePath as PropertyPath, value ? value : [{}])
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
      let statePath: string[] | null

      if (!Array.isArray(path)) {
        statePath = path.split('.')
      } else {
        statePath = path
      }

      const lastKey = statePath[statePath.length - 1]
      if (!isNumber(lastKey)) {
        const newPath = [...statePath]
        newPath.pop()
        if (statePath.length > 1) {
          const newObject = { ...get(targetState, newPath) }
          delete newObject[statePath[statePath.length - 1]]
          lSet(targetState, newPath, newObject)
        } else {
          const newObject = { ...targetState }
          delete newObject[statePath[0]]
          lSet(targetState, '', newObject)
        }
      } else {
        const newPath = statePath.slice(0, -1)
        lSet(
          targetState,
          newPath,
          get(targetState, newPath).filter((_: any, index: number) => index !== Number(lastKey))
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

      let newData: any
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          const currentData = get(targetState, statePath as PropertyPath, [])
          newData = merge(currentData, value)
        } else {
          const currentData = get(targetState, statePath as PropertyPath, {})
          newData = merge(currentData, value)
        }
      }
      if (typeof value === 'string') {
        newData = value
      }
      lSet(targetState, statePath as PropertyPath, newData)

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
    return produce(state, (draft) => {
      const targetState = selector(draft)

      lSet(targetState, '', value)
    })
  }
}

export const useStore = create<CombinedSlice>()((...a) => ({
  ...formSlice(...a),
  ...featureSlice(...a),
  ...optionSlice(...a),
  ...sectionSlice(...a),
  ...subfeatureSlice(...a),
  ...ancestrySlice(...a),
}))
