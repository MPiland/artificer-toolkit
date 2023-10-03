import { createSlice } from '@reduxjs/toolkit'

const classesSlice = createSlice({
  name: 'classes',
  initialState: { data: null },
  reducers: {
    setClasses: (state, { payload }) => {
      state.data = payload
    },
  },
})

export const { setClasses } = classesSlice.actions

export default classesSlice.reducer

export const selectClasses = (state) => state.classes.data