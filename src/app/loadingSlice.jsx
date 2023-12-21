import { createSlice } from '@reduxjs/toolkit'

const loadingSlice = createSlice({
  name: 'loading',
  initialState: { status: true },
  reducers: {
    setLoading: (state, { payload }) => {
      state.status = payload
    },
    clearLoading: (state, action) => {
      state.status = false
    },
  },
})

export const { setLoading, clearLoading } = loadingSlice.actions

export const selectLoadingStatus = (state) => state.loading.status

export default loadingSlice.reducer
