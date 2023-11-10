import { createSlice } from '@reduxjs/toolkit'

const itemsSlice = createSlice({
  name: 'items',
  initialState: { filters: {} },
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
