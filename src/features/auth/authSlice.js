import { createSlice } from '@reduxjs/toolkit'
import { authApiSlice } from './authApiSlice'

const authSlice = createSlice({
  name: 'auth',
  initialState: { token: null },
  reducers: {
    setCredentials: (state, { payload }) => {
      state.token = payload.accessToken
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        authApiSlice.endpoints.login.matchFulfilled,
        (state, { payload }) => {
          state.token = payload.accessToken
        }
      )
      .addMatcher(
        authApiSlice.endpoints.googleLogin.matchFulfilled,
        (state, { payload }) => {
          state.token = payload.accessToken
        }
      )
      .addMatcher(
        authApiSlice.endpoints.register.matchFulfilled,
        (state, { payload }) => {
          state.token = payload.accessToken
        }
      )
      .addMatcher(authApiSlice.endpoints.sendLogout.matchFulfilled, (state) => {
        state.token = null
        localStorage.clear()
      })
  },
})

export const { setCredentials } = authSlice.actions

export default authSlice.reducer

export const selectCurrentToken = (state) => state.auth.token
