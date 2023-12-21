import { createSlice } from '@reduxjs/toolkit'

const featsSlice = createSlice({
  name: 'feats',
  initialState: { filters: {} },
  reducers: {
    setFeatsFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearFeatsFilter: (state) => {
      state.filters = null
    },
  },
})

export const { setFeatsFilter, clearFeatsFilter } = featsSlice.actions

export default featsSlice.reducer

export const selectFeatsFilter = (state) => state.feats.filters
