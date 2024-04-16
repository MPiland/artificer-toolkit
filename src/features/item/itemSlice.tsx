import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const itemSlice = createSlice({
  name: 'item',
  initialState: { filters: {}, scrollPosition: null },
  reducers: {
    setItem: (state, { payload }) => {
      state.filters = payload
    },
    clearFilter: (state) => {
      state.filters = {}
    },
    setScrollPosition: (state, action: PayloadAction<any>) => {
      state.scrollPosition = action.payload
    },
  },
})

export const { setItem, clearFilter, setScrollPosition } = itemSlice.actions

export default itemSlice.reducer

export const selectFilter = (state: RootState) => state.item.filters
export const getScrollPosition = (state: RootState) => state.item.scrollPosition
