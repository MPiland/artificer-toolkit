import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const featSlice = createSlice({
  name: 'feat',
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

export const { setFilter, clearFilter, setScrollPosition } = featSlice.actions

export default featSlice.reducer

export const selectFilter = (state: RootState) => state.feat.filters
export const getScrollPosition = (state: RootState) => state.feat.scrollPosition
