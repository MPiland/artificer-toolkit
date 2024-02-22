import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query'
import { RootState } from '../store'

type CustomError = {
  status: number
  data: {
    message: string
    // Add other properties if necessary
  }
}

const baseQuery = fetchBaseQuery({
  baseUrl:
    import.meta.env.MODE === 'production'
      ? 'https://api.artificertoolkit.app'
      : 'http://localhost:3500',
  credentials: 'include',
  prepareHeaders: async (headers, { getState }) => {
    const state = (await getState()) as RootState
    const token = state.auth.token
    if (token) {
      console.log('token exists')
      headers.set('authorization', `Bearer ${token}`)
    }
    return headers
  },
})

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions)

  if (result?.error?.status === 403) {
    console.log('sending refresh token')

    // Send refresh token to get new access token
    const refreshResult = await baseQuery('/auth/refresh', api, extraOptions)

    if (refreshResult?.data) {
      // Retry original query with new access token
      result = await baseQuery(args, api, extraOptions)
    } else {
      if (refreshResult?.error?.status === 403) {
        const customError: CustomError = {
          status: 403,
          data: {
            message: 'Your login has expired.',
          },
        }
        return Promise.reject(customError)
      }
      return refreshResult
    }
  }

  return result
}

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
  tagTypes: ['Spell', 'Item', 'Builder', 'Class', 'Race', 'Feat'],
})
