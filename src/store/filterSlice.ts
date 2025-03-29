import { produce } from 'immer'
import { StateCreator } from 'zustand'
import { Class, Equipment, Spell } from '../../amplify/gql/types'
import { DeepKeyOf } from '../types/form'
import { get, set as lSet } from 'lodash'

// Define the overall filter state
export interface FilterState {
  spells?: Partial<Spell>
  equipment?: Partial<Equipment>
  classes?: Partial<Class>
}

export type StoreFormType = keyof FilterState

// Define the filter slice
export interface FilterSlice {
  filterState: FilterState
  setFilter: <T extends StoreFormType, K extends DeepKeyOf<FilterState[T]>>(formType: T, path: K, value: any) => void
  resetFilters: (formType: StoreFormType) => void
  clearAllFilters: () => void
}

export const filterSlice: StateCreator<FilterSlice> = (set) => ({
  filterState: {},

  setFilter: (formType, path, value) =>
    set(
      produce((state: FilterSlice) => {
        // Initialize if needed
        if (!state.filterState[formType]) {
          state.filterState[formType] = {}
        }

        const typedFilter = state.filterState[formType] as Record<string, any>

        if (value === null) {
          // For removal, we need to handle nested paths
          const pathParts = String(path).split('.')
          const lastPart = pathParts.pop()

          if (pathParts.length > 0) {
            // For nested paths, get the parent object
            const parentPath = pathParts.join('.')
            const parent = get(typedFilter, parentPath)

            if (parent && typeof parent === 'object' && lastPart && lastPart in parent) {
              delete parent[lastPart]
            }
          } else {
            // For top-level paths
            if (lastPart && lastPart in typedFilter) {
              delete typedFilter[lastPart]
            }
          }
        } else {
          // For updates, use lodash.set to handle nested paths
          lSet(typedFilter, path, value)
        }
      })
    ),

  resetFilters: (formType) =>
    set(
      produce((state: FilterSlice) => {
        state.filterState[formType] = {}
      })
    ),

  clearAllFilters: () => set({ filterState: {} }),
})
