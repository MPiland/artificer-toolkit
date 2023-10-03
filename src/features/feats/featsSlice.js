import { createSlice } from '@reduxjs/toolkit'

const featsSlice = createSlice({
  name: 'feats',
  initialState: { data: null },
  reducers: {
    setFeats: (state, { payload }) => {
      state.data = payload
    },
  },
})

export const { setFeats } = featsSlice.actions

export default featsSlice.reducer

export const selectFeats = (state) => state.feats.data
