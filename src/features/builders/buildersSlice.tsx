import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const buildersSlice = createSlice({
  name: 'builders',
  initialState: { data: null },
  reducers: {
    setBuilders: (state, { payload }) => {
      state.data = payload
    },
  },
})

export const { setBuilders } = buildersSlice.actions

export default buildersSlice.reducer

export const selectBuilders = (state: RootState) => state.builders.data
