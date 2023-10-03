import { createSlice } from '@reduxjs/toolkit'
import { authApiSlice } from './authApiSlice'

export const authSlice = createSlice({
  name: 'auth',
  initialState: { token: null, id: null },
  reducers: {
    setCredentials: (state, { payload }) => {
      state.token = payload.accessToken
      state.id = payload.id
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      authApiSlice.endpoints.sendLogout.matchFulfilled,
      (state) => {
        state.token = null
        localStorage.removeItem('persist')
      }
    )
  },
})

export const { setCredentials } = authSlice.actions

export default authSlice.reducer

export const selectCurrentToken = (state) => state.auth.token
export const selectCurrentId = (state) => state.auth.id
