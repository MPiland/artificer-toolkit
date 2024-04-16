import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const backgroundSlice = createSlice({
  name: 'background',
  initialState: { filters: {}, scrollPosition: null },
  reducers: {
    setFilter: (state, { payload }) => {
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

export const { setFilter, clearFilter, setScrollPosition } =
  backgroundSlice.actions

export const selectFilter = (state: RootState) => state.background.filters
export const getScrollPosition = (state: RootState) =>
  state.background.scrollPosition
