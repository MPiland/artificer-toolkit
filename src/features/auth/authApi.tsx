import { useMutation } from '@tanstack/react-query'
import { signIn, signUp, confirmSignUp, autoSignIn, signOut } from 'aws-amplify/auth'
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito'
import { defaultStorage, sessionStorage } from 'aws-amplify/utils'

type Credentials = {
  username: string
  password: string
  persist: boolean
}

type Confirm = {
  username: string
  confirmationCode: string
}

export const useSignUp = () => {
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      const { username, password, persist } = credentials

      if (persist) {
        cognitoUserPoolsTokenProvider.setKeyValueStorage(defaultStorage)
      } else {
        cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage)
      }

      const result = await signUp({
        username: username,
        password: password,
        options: {
          userAttributes: {
            email: username,
          },
          autoSignIn: true,
        },
      })

      return result
    },
  })
}

export const useConfirmSignUp = () => {
  return useMutation({
    mutationFn: async (credentials: Confirm) => {
      const { username, confirmationCode } = credentials

      const { isSignUpComplete } = await confirmSignUp({
        username: username,
        confirmationCode: confirmationCode,
      })

      if (isSignUpComplete) {
        const { isSignedIn } = await autoSignIn()

        return isSignedIn
      }
    },
  })
}

export const useSignIn = () => {
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      const { username, password, persist } = credentials

      if (persist) {
        cognitoUserPoolsTokenProvider.setKeyValueStorage(defaultStorage)
      } else {
        cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage)
      }

      const result = await signIn({
        username: username,
        password: password,
      })

      return result
    },
  })
}

export const useSignOut = () => {
  return useMutation({
    mutationFn: async () => {
      const result = await signOut()

      return result
    },
  })
}
