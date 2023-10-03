import { createSlice } from '@reduxjs/toolkit'

const itemsSlice = createSlice({
  name: 'items',
  initialState: { data: null },
  reducers: {
    setItems: (state, { payload }) => {
      state.data = payload
    },
  },
})

export const { setItems } = itemsSlice.actions

export default itemsSlice.reducer

export const selectItems = (state) => state.items.data
