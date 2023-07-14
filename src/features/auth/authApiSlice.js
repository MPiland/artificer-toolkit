import { apiSlice } from '../../app/api/apiSlice'

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
