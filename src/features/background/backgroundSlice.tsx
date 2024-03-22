import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const backgroundSlice = createSlice({
  name: 'background',
  initialState: { filters: {} },
  reducers: {
    setBackgroundFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearBackgroundFilter: (state) => {
      state.filters = {}
    },
  },
})

export const selectBackgroundsFilter = (state: RootState) =>
  state.background.filters

export const { setBackgroundFilter, clearBackgroundFilter } =
  backgroundSlice.actions
