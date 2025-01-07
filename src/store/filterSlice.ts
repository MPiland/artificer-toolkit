import { produce } from 'immer'
import { set as lSet} from 'lodash'

export interface FilterState {
  value: string
  level?: string[]
  classes?: string[]
  school?: string[]
  damage?: {
    primary?: { type: string[] }
    secondary?: { type: string[] }
  }
  condition?: { type: string[] }
  saveAbility?: { type: string[] }
  action?: { type: string[] }
  duration?: { type: string[] }
  range?: { type: string[] }
  shape?: { type: string[] }
  category?: string[]
  properties?: { type: string[] }
  armorClass?: string[]
}

export interface FilterSlice {
  filter: FilterState
  setFilter: (action: { type: string; value: any }) => void
  resetFilter: () => void
}

export const filterSlice = (set: any): FilterSlice => ({
  filter: {
    value: '',
  },
  setFilter: (action) =>
    set(
      produce((state: FilterSlice) => {
        lSet(state.filter, action.type, action.value)
      })
    ),
  resetFilter: () =>
    set(
      produce((state: FilterSlice) => {
        state.filter = { value: '' }
      })
    ),
})
