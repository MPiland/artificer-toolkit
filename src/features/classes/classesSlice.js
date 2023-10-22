import { createSlice } from '@reduxjs/toolkit'
import { initialState } from './classesApiSlice'

const classesSlice = createSlice({
  name: 'classes',
  initialState: { data: initialState, filters: {} },
  reducers: {
    setClassesFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearClassesFilter: (state) => {
      state.filters = null
    },
  },
})

export const selectClassesFilter = (state) => state.classes.filters

export const { setClassesFilter, clearClassesFilter } = classesSlice.actions

export default classesSlice.reducer
