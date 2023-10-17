import { createSelector, createSlice } from '@reduxjs/toolkit'

const classesSlice = createSlice({
  name: 'classes',
  initialState: { data: null, filters: {} },
  reducers: {
    setClasses: (state, { payload }) => {
      state.data = payload
    },
    setClassesFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearClassesFilter: (state) => {
      state.filters = null
    },
  },
})

export const { setClasses, setClassesFilter, clearClassesFilter } =
  classesSlice.actions

export default classesSlice.reducer

export const selectClasses = (state) => state.classes.data
export const selectClassesFilter = (state) => state.classes.filters

export const selectSubClasses = createSelector(selectClasses, (state) =>
  state?.filter((stateItem) => stateItem.category.name === 'subclass')
)
