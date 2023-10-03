import { createSlice } from '@reduxjs/toolkit'

const buildersSlice = createSlice({
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

export const selectBuilders = (state) => state.builders.data
