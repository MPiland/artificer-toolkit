import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const itemsSlice = createSlice({
  name: 'items',
  initialState: { filters: {} },
  reducers: {
    setItemsFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearItemsFilter: (state) => {
      state.filters = {}
    },
  },
})

export const { setItemsFilter, clearItemsFilter } = itemsSlice.actions

export default itemsSlice.reducer

export const selectItemsFilter = (state: RootState) => state.items.filters
