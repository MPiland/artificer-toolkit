import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const builderSlice = createSlice({
  name: 'builder',
  initialState: { data: null },
  reducers: {
    setBuilders: (state, { payload }) => {
      state.data = payload
    },
  },
})

export const { setBuilders } = builderSlice.actions

export default builderSlice.reducer

export const selectBuilders = (state: RootState) => state.builder.data
