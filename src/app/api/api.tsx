export type CustomError = {
  status: number
  data: {
    message: string
  }
}

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: CustomError
  }
}

const baseQuery = async (endpoint: string, options: RequestInit = {}) => {
  const accessToken = sessionStorage.getItem('accessToken')

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
  }

  const response = await fetch(
    `${
      import.meta.env.MODE === 'production' ? 'https://api.artificertoolkit.app' : 'http://localhost:3500'
    }${endpoint}`,
    {
      ...options,
      headers: {
        ...headers,
        ...options.headers, // Allow overriding default headers
      },
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    const customError: CustomError = {
      status: response.status,
      data: errorData,
    }
    throw customError // Throw error to trigger onError in Tanstack Query
  }

  return response
}

const baseQueryWithReauth = async (endpoint: string, options: RequestInit = {}) => {
  let result

  try {
    result = await baseQuery(endpoint, options)
  } catch (error: any) {
    if (error.status === 403) {
      console.log('sending refresh token')

      // Send refresh token to get new access token
      const refreshRes = await baseQuery('/auth/refresh', options)
      const refreshResult = {
        status: refreshRes.status,
        data: await refreshRes.json(),
      }

      if (refreshResult?.data) {
        // Retry original query with new access token
        try {
          result = await baseQuery(endpoint, options)
          return result
        } catch (retryError: any) {
          return Promise.reject(retryError) // Propagate retry error
        }
      } else {
        if (refreshResult?.status === 403) {
          const customError: CustomError = {
            status: 403,
            data: {
              message: 'Your login has expired.',
            },
          }
          return Promise.reject(customError)
        }
        return refreshRes
      }
    } else {
      return Promise.reject(error) // Propagate other errors
    }
  }

  return result
}

export default baseQueryWithReauth
