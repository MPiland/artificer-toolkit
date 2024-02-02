import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const featsSlice = createSlice({
  name: 'feats',
  initialState: { filters: {} },
  reducers: {
    setFeatsFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearFeatsFilter: (state) => {
      state.filters = {}
    },
  },
})

export const { setFeatsFilter, clearFeatsFilter } = featsSlice.actions

export default featsSlice.reducer

export const selectFeatsFilter = (state: RootState) => state.feats.filters
