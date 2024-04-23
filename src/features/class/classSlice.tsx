import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const classSlice = createSlice({
  name: 'class',
  initialState: { filters: {}, scrollPosition: null, selectedRace: null },
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

export const { setFilter, clearFilter, setScrollPosition } = classSlice.actions

export default classSlice.reducer

export const selectFilter = (state: RootState) => state.class.filters
export const getScrollPosition = (state: RootState) => state.class.scrollPosition
