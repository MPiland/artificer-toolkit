import { createSlice } from '@reduxjs/toolkit'

const racesSlice = createSlice({
  name: 'races',
  initialState: { data: null, filters: {} },
  reducers: {
    setRaces: (state, { payload }) => {
      state.data = payload
    },
    setRacesFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearRacesFilter: (state) => {
      state.filters = null
    },
  },
})

export const { setRaces, setRacesFilter, clearRacesFilter } = racesSlice.actions

export default racesSlice.reducer

export const selectRaces = (state) => state.races.data
export const selectRacesFilter = (state) => state.races.filters
