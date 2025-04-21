import { produce } from 'immer'
import { createStore } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Class, Equipment, Spell } from '../../amplify/gql/types'
import type { DeepKeyOf } from '../types/form'
import { get, set as lSet } from 'lodash'

// Define the overall filter state
export interface FilterState {
  spells?: Partial<Spell>
  equipment?: Partial<Equipment>
  classes?: Partial<Class>
}

export type StoreFormType = keyof FilterState

// Define the filter slice
export interface FilterStore {
  filterState: FilterState
  setFilter: <T extends StoreFormType>(context: T, path: DeepKeyOf<FilterState[T]>, value: any) => void
  resetFilters: (context: StoreFormType) => void
  clearAllFilters: () => void
}

export const useFilterStore = createStore<FilterStore>()(
  persist(
    (set) => ({
      filterState: {},

      setFilter: (context, path, value) =>
        set(
          produce((state: FilterStore) => {
            // Initialize if needed
            if (!state.filterState[context]) {
              state.filterState[context] = {}
            }

            const typedFilter = state.filterState[context] as Record<string, any>

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

      resetFilters: (context) =>
        set(
          produce((state: FilterStore) => {
            state.filterState[context] = {}
          })
        ),

      clearAllFilters: () => set({ filterState: {} }),
    }),
    {
      name: 'atapp-filter-store',
    }
  )
)
