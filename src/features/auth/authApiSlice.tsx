import { apiSlice } from '../../app/api/apiSlice'
import { setCredentials } from './authSlice'

interface Credentials {
  username: string
  password: string
}

type data = {
  accessToken: string
  id: string
}

interface GoogleCredentials {
  code: string
}

export const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation<data, Credentials>({
      query: (credentials) => ({
        url: '/auth/register',
        method: 'POST',
        body: { ...credentials },
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setCredentials(data))
        } catch (err) {
          console.log(err)
        }
      },
    }),
    login: builder.mutation<data, Credentials>({
      query: (credentials) => ({
        url: '/auth',
        method: 'POST',
        body: { ...credentials },
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setCredentials(data))
        } catch (err) {
          console.log(err)
        }
      },
    }),
    sendLogout: builder.mutation<unknown, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          setTimeout(() => {
            dispatch(apiSlice.util.resetApiState())
          }, 300)
        } catch (err) {
          console.log(err)
        }
      },
    }),
    refresh: builder.mutation<data, void>({
      query: () => ({
        url: '/auth/refresh',
        method: 'GET',
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setCredentials(data))
        } catch (err) {
          console.log(err)
        }
      },
    }),
    googleLogin: builder.mutation<data, GoogleCredentials>({
      query: (initialUserData) => ({
        url: '/auth/google',
        method: 'POST',
        body: { ...initialUserData },
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setCredentials(data))
        } catch (err) {
          console.log(err)
        }
      },
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
