import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const raceSlice = createSlice({
  name: 'race',
  initialState: { filters: {} },
  reducers: {
    setRaceFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearRaceFilter: (state) => {
      state.filters = {}
    },
  },
})

export const { setRaceFilter, clearRaceFilter } = raceSlice.actions

export default raceSlice.reducer

export const selectRacesFilter = (state: RootState) => state.race.filters
