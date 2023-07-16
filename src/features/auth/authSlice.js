import { createSlice } from '@reduxjs/toolkit'
import { authApiSlice } from './authApiSlice'

const authSlice = createSlice({
  name: 'auth',
  initialState: { token: null },
  reducers: {
    setCredentials: ({ payload }) => {
      localStorage.setItem('auth', JSON.stringify(payload.accessToken))
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        authApiSlice.endpoints.login.matchFulfilled,
        ({ payload }) => {
          localStorage.setItem('auth', JSON.stringify(payload.accessToken))
        }
      )
      .addMatcher(
        authApiSlice.endpoints.googleLogin.matchFulfilled,
        ({ payload }) => {
          localStorage.setItem('auth', JSON.stringify(payload.accessToken))
        }
      )
      .addMatcher(
        authApiSlice.endpoints.register.matchFulfilled,
        ({ payload }) => {
          localStorage.setItem('auth', JSON.stringify(payload.accessToken))
        }
      )
      .addMatcher(authApiSlice.endpoints.sendLogout.matchFulfilled, () => {
        localStorage.clear()
      })
  },
})

export const { setCredentials } = authSlice.actions

export default authSlice.reducer

export const selectCurrentToken = (state) => state.auth.token
