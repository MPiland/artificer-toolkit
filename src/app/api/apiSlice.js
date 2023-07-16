import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const baseQuery = fetchBaseQuery({
  baseUrl:
    process.env.NODE_ENV === 'production'
      ? 'https://at-beta-api.onrender.com'
      : 'http://localhost:3500',
  credentials: 'include',
  prepareHeaders: async (headers, { getState }) => {
    const token = localStorage.getItem('auth')
    if (!!token) {
      console.log('token exists')
      headers.set('authorization', `Bearer ${token}`)
    }
    return headers
  },
})

const baseQueryWithReauth = async (args, api, extraOptions) => {
  // console.log('base query args', args) // request url, method, body
  // console.log('base query api', api) // signal, dispatch, getState()
  // console.log('base query extraOptions', extraOptions) // custom like {shout: true}

  let result = await baseQuery(args, api, extraOptions)

  // If you want, handle other status codes, too
  if (result?.error?.status === 403) {
    console.log('sending refresh token')

    // Send refresh token to get new access token
    const refreshResult = await baseQuery('/auth/refresh', api, extraOptions)

    if (refreshResult?.data) {
      // Retry original query with new access token
      result = await baseQuery(args, api, extraOptions)
    } else {
      if (refreshResult?.error?.status === 403) {
        refreshResult.error.data.message = 'Your login has expired.'
      }
      return refreshResult
    }
  }

  return result
}

export const apiSlice = createApi({
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Character', 'Spell', 'Builder', 'Feature', 'Race', 'Item'],
  endpoints: (builder) => ({}),
})
