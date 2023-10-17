import { createSlice } from '@reduxjs/toolkit'

const itemsSlice = createSlice({
  name: 'items',
  initialState: { data: null, filters: {} },
  reducers: {
    setItems: (state, { payload }) => {
      state.data = payload
    },
    setItemsFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearItemsFilter: (state) => {
      state.filters = null
    },
  },
})

export const { setItems, setItemsFilter, clearItemsFilter } = itemsSlice.actions

export default itemsSlice.reducer

export const selectItems = (state) => state.items.data
export const selectItemsFilter = (state) => state.items.filters
