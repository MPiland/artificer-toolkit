import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const raceSlice = createSlice({
  name: 'race',
  initialState: { filters: {}, scrollPosition: null },
  reducers: {
    setFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearFilter: (state) => {
      state.filters = {}
    },
    setScrollPosition: (state, action: PayloadAction<any>) => {
      state.scrollPosition = action.payload
    },
  },
})

export const { setFilter, clearFilter, setScrollPosition } = raceSlice.actions

export default raceSlice.reducer

export const selectFilter = (state: RootState) => state.race.filters
export const getScrollPosition = (state: RootState) => state.race.scrollPosition
