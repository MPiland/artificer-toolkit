import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { authApiSlice } from './authApiSlice'
import { RootState } from '../../app/store'

interface AuthState {
  token: string | null
  id: string | null
}

export const authSlice = createSlice({
  name: 'auth',
  initialState: { token: null, id: null } as AuthState,
  reducers: {
    setCredentials: (
      state,
      { payload }: PayloadAction<{ accessToken: string; id: string }>
    ) => {
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

export const selectCurrentToken = (state: RootState) => state.auth.token
export const selectCurrentId = (state: RootState) => state.auth.id
