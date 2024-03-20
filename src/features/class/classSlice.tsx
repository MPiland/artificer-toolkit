import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const classSlice = createSlice({
  name: 'class',
  initialState: {
    filters: {},
  },
  reducers: {
    setClassFilter: (state, action: PayloadAction<any>) => {
      state.filters = action.payload
    },
    clearClassFilter: (state) => {
      state.filters = {}
    },
  },
})

export const selectClassFilter = (state: RootState) => state.class.filters

export const { setClassFilter, clearClassFilter } = classSlice.actions

export default classSlice.reducer
