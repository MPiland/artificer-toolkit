import { createSlice } from '@reduxjs/toolkit'
import { initialState } from './itemsApiSlice'

const itemsSlice = createSlice({
  name: 'items',
  initialState: { data: initialState, filters: {} },
  reducers: {
    setItemsFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearItemsFilter: (state) => {
      state.filters = null
    },
  },
})

export const { setItemsFilter, clearItemsFilter } = itemsSlice.actions

export default itemsSlice.reducer

export const selectItemsFilter = (state) => state.items.filters
