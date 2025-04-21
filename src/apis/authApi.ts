import { useMutation } from '@tanstack/react-query'
import {
  signIn,
  signUp,
  confirmSignUp,
  autoSignIn,
  signOut,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth'
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

type Reset = {
  username: string
  password: string
  confirmationCode: string
}

const handleSignUp = async (credentials: Credentials) => {
  const { username, password, persist } = credentials
  try {
    const { nextStep } = await signUp({
      username: username,
      password: password,
      options: {
        userAttributes: {
          email: username,
        },
        autoSignIn: true,
      },
    })

    if (persist) {
      cognitoUserPoolsTokenProvider.setKeyValueStorage(defaultStorage)
    } else {
      cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage)
    }

    if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
      return 'CONFIRM_SIGN_UP'
    }

    return 'DONE'
  } catch (err: any) {
    if ('name' in err && err.name === 'UsernameExistsException') {
      return 'USERNAME_EXISTS'
    } else {
      console.error('Error signing up:', err)
    }
  }
}

const handleConfirmSignUp = async (credentials: Confirm) => {
  try {
    const { username, confirmationCode } = credentials

    const { isSignUpComplete, nextStep } = await confirmSignUp({
      username: username,
      confirmationCode: confirmationCode,
    })

    if (isSignUpComplete) {
      if (nextStep.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
        try {
          const { isSignedIn } = await autoSignIn()

          if (isSignedIn) {
            return 'SIGNED_IN'
          }
        } catch (err) {
          console.error(err)
        }
      }
    }
  } catch (err: any) {
    if ('name' in err && err.name === 'CodeMismatchException') {
      console.error('Error confirming sign up:', err)
      return 'CODE_MISMATCH'
    }
    return console.error('Error confirming sign up:', err)
  }
}

export const handleResendSignUpCode = async (username: string) => {
  try {
    await resendSignUpCode({ username })
  } catch (err) {
    return console.error('Error resending confirmation code:', err)
  }
}

export const handleConfirmPasswordReset = async (credentials: Reset) => {
  try {
    const { username, password, confirmationCode } = credentials
    await confirmResetPassword({
      username: username,
      newPassword: password,
      confirmationCode: confirmationCode,
    })
    return 'DONE'
  } catch (err) {
    console.error('Error confirming password reset:', err)
    return err
  }
}

const handleSignIn = async (credentials: Credentials) => {
  try {
    const { username, password, persist } = credentials

    const { isSignedIn, nextStep } = await signIn({
      username: username,
      password: password,
    })

    if (persist) {
      cognitoUserPoolsTokenProvider.setKeyValueStorage(defaultStorage)
    } else {
      cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage)
    }

    if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
      return 'CONFIRM_SIGN_UP'
    }
    if (isSignedIn) {
      return 'SIGNED_IN'
    }
  } catch (err: any) {
    if ('name' in err && err.name === 'NotAuthorizedException') {
      return 'NOT_AUTHORIZED'
    }
    console.error('Error signing in:', err)
  }
}

export const useSignUp = () => {
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      const result = await handleSignUp(credentials)

      return result
    },
  })
}

export const useConfirmSignUp = () => {
  return useMutation({
    mutationFn: async (credentials: Confirm) => {
      const result = await handleConfirmSignUp(credentials)

      return result
    },
  })
}

export const useConfirmPasswordReset = () => {
  return useMutation({
    mutationFn: async (credentials: Reset) => {
      const result = await handleConfirmPasswordReset(credentials)

      return result
    },
  })
}

export const useSignIn = () => {
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      const result = await handleSignIn(credentials)

      return result
    },
  })
}

export const useSignOut = () => {
  return useMutation({
    mutationFn: async () => {
      await signOut()
      return 'DONE'
    },
  })
}

export const useResetPassword = () => {
  return useMutation({
    mutationFn: async (username: string) => {
      try {
        const { nextStep } = await resetPassword({ username })
        if (nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
          return 'CONFIRM_RESET_PASSWORD_WITH_CODE'
        } else {
          return 'DONE'
        }
      } catch (err) {
        console.error('Error resetting password:', err)
        return err
      }
    },
  })
}
