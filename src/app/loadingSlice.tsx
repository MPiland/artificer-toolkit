import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export const loadingSlice = createSlice({
  name: 'loading',
  initialState: { status: true },
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.status = action.payload
    },
    clearLoading: (state) => {
      state.status = false
    },
  },
})

export const { setLoading, clearLoading } = loadingSlice.actions

export const selectLoadingStatus = (state: { loading: { status: boolean } }) =>
  state.loading.status

export default loadingSlice.reducer
