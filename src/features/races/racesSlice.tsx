import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const racesSlice = createSlice({
  name: 'races',
  initialState: { filters: {} },
  reducers: {
    setRacesFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearRacesFilter: (state) => {
      state.filters = {}
    },
  },
})

export const { setRacesFilter, clearRacesFilter } = racesSlice.actions

export default racesSlice.reducer

export const selectRacesFilter = (state: RootState) => state.races.filters
