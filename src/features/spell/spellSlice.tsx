import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const spellSlice = createSlice({
  name: 'spell',
  initialState: { filters: {}, scrollPosition: null },
  reducers: {
    setFilter: (state, action: PayloadAction<any>) => {
      state.filters = action.payload
    },
    clearFilter: (state) => {
      state.filters = {}
    },
    setScrollPosition: (state, action: PayloadAction<any>) => {
      state.scrollPosition = action.payload
    },
  },
})
export default spellSlice.reducer

export const { setFilter, clearFilter, setScrollPosition } = spellSlice.actions

export const selectFilter = (state: RootState) => state.spell.filters
export const getScrollPosition = (state: RootState) =>
  state.spell.scrollPosition
