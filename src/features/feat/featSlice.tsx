import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const featSlice = createSlice({
  name: 'feat',
  initialState: { filters: {} },
  reducers: {
    setFeatFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearFeatFilter: (state) => {
      state.filters = {}
    },
  },
})

export const { setFeatFilter, clearFeatFilter } = featSlice.actions

export default featSlice.reducer

export const selectFeatsFilter = (state: RootState) => state.feat.filters
