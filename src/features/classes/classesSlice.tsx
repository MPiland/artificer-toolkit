import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

const initialState = {
  filters: {},
}

export const classesSlice = createSlice({
  name: 'classes',
  initialState,
  reducers: {
    setClassesFilter: (state, action: PayloadAction<any>) => {
      state.filters = action.payload
    },
    clearClassesFilter: (state) => {
      state.filters = {}
    },
  },
})

export const selectClassesFilter = (state: RootState) => state.classes.filters

export const { setClassesFilter, clearClassesFilter } = classesSlice.actions

export default classesSlice.reducer
