import { useMutation } from '@tanstack/react-query'
import baseQueryWithReauth from '../../app/api/api'

type Credentials = {
  username: string
  password: string
}

type GoogleCredentials = {
  code: string
}

export const useRegister = () => {
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      const result = await baseQueryWithReauth('/auth/login', {
        // Adjust login endpoint
        method: 'POST',
        body: JSON.stringify(credentials),
      })

      const data = await result.json()

      if (!result.ok) {
        console.error(data.message)
        throw new Error(data.message) // Handle errors appropriately
      }

      sessionStorage.setItem('accessToken', data.accessToken) // Store token
      return data
    },
  })
}

export const useLogin = () => {
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      const result = await baseQueryWithReauth('/auth/login', {
        // Adjust login endpoint
        method: 'POST',
        body: JSON.stringify(credentials),
      })

      return result
    },
    onSuccess: async (result) => {
      const data = await result.json()
      sessionStorage.setItem('accessToken', data.accessToken)
      return data
    },
    onError: (err) => {
      console.error(err.data.message)
      throw new Error(err.data.message)
    },
  })
}

export const useGoogleFetchLogin = () => {
  return useMutation({
    mutationFn: async (initialUserData: GoogleCredentials) => {
      const result = await baseQueryWithReauth('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ initialUserData }),
      })

      return result
    },
    onSuccess: async (result) => {
      const data = await result.json()
      sessionStorage.setItem('accessToken', data.accessToken)
      return data
    },
    onError: (err) => {
      console.error(err.data.message)
      throw new Error(err.data.message)
    },
  })
}

export const useRefresh = () => {
  return useMutation({
    mutationFn: async () => {
      const result = await baseQueryWithReauth('/auth/refresh', {
        method: 'GET',
      })

      return result
    },
    onSuccess: async (result) => {
      const data = await result.json()
      sessionStorage.setItem('accessToken', data.accessToken)
      return data
    },
    onError: (err) => {
      console.error(err.data.message)
      throw new Error(err.data.message)
    },
  })
}

export const useLogout = () => {
  return useMutation({
    mutationFn: async () => {
      await baseQueryWithReauth('/auth/logout', {
        method: 'POST',
      })
    },
    onSuccess: () => {
      setTimeout(() => {
        localStorage.removeItem('persist')
      }, 300)
    },
    onError: (err) => {
      console.error(err)
    },
  })
}
