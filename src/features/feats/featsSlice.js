import { createSlice } from '@reduxjs/toolkit'

const featsSlice = createSlice({
  name: 'feats',
  initialState: { data: null, filters: {} },
  reducers: {
    setFeats: (state, { payload }) => {
      state.data = payload
    },
    setFeatsFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearFeatsFilter: (state) => {
      state.filters = null
    },
  },
})

export const { setFeats, setFeatsFilter, clearFeatsFilter } = featsSlice.actions

export default featsSlice.reducer

export const selectFeats = (state) => state.feats.data
export const selectFeatsFilter = (state) => state.feats.filters
