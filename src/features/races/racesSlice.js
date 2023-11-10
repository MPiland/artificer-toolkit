import { createSlice } from '@reduxjs/toolkit'

const racesSlice = createSlice({
  name: 'races',
  initialState: { filters: {} },
  reducers: {
    setRacesFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearRacesFilter: (state) => {
      state.filters = null
    },
  },
})

export const { setRacesFilter, clearRacesFilter } = racesSlice.actions

export default racesSlice.reducer

export const selectRacesFilter = (state) => state.races.filters
