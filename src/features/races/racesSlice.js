import { createSlice } from '@reduxjs/toolkit'

const racesSlice = createSlice({
  name: 'races',
  initialState: { data: null },
  reducers: {
    setRaces: (state, { payload }) => {
      state.data = payload
    },
  },
})

export const { setRaces } = racesSlice.actions

export default racesSlice.reducer

export const selectRaces = (state) => state.races.data
