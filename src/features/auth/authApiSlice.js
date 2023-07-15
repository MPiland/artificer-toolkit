import { apiSlice } from '../../app/api/apiSlice'
import { setCredentials } from './authSlice'

export const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation({
      query: (initialUserData) => ({
        url: '/auth/register',
        method: 'POST',
        body: { ...initialUserData },
      }),
    }),
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth',
        method: 'POST',
        body: { ...credentials },
      }),
    }),
    sendLogout: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
    }),
    refresh: builder.mutation({
      query: () => ({
        url: '/auth/refresh',
        method: 'GET',
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          const { accessToken } = data
          dispatch(setCredentials({ accessToken }))
        } catch (err) {
          console.log(err)
        }
      },
    }),
    googleLogin: builder.mutation({
      query: (initialUserData) => ({
        url: '/auth/google',
        method: 'POST',
        body: { ...initialUserData },
      }),
    }),
  }),
})

export const {
  useRegisterMutation,
  useLoginMutation,
  useGoogleLoginMutation,
  useSendLogoutMutation,
  useRefreshMutation,
} = authApiSlice
