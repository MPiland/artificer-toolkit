import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const itemSlice = createSlice({
  name: 'item',
  initialState: { filters: {} },
  reducers: {
    setItemFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearItemFilter: (state) => {
      state.filters = {}
    },
  },
})

export const { setItemFilter, clearItemFilter } = itemSlice.actions

export default itemSlice.reducer

export const selectItemsFilter = (state: RootState) => state.item.filters
