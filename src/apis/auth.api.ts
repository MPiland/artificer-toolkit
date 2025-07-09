import {
  signIn as AWSSignIn,
  signUp as AWSSignUp,
  confirmSignUp as AWSConfirmSignUp,
  autoSignIn,
  resendSignUpCode as AWSResendSignUpCode,
  resetPassword as AWSResetPassword,
  confirmResetPassword as AWSConfirmResetPassword,
  confirmSignIn as AWSConfirmSignIn,
  signOut as AWSSignOut,
} from 'aws-amplify/auth'
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito'
import { defaultStorage, sessionStorage } from 'aws-amplify/utils'
import type { ToOptions } from '@tanstack/react-router'
import { post } from 'aws-amplify/api'

export const getFriendlyErrorMessage = (error: { name: string }): { error: number; message: string } => {
  switch (error.name) {
    case 'UserNotFoundException':
      return {
        error: 1,
        message: 'Incorrect email or password.',
      }
    case 'NotAuthorizedException':
      return {
        error: 3,
        message: 'Incorrect email or password.',
      }
    case 'UserNotConfirmedException':
      return {
        error: 4,
        message: 'Your account is not confirmed. Please check your email for the confirmation code.',
      }
    case 'CodeMismatchException':
      return {
        error: 5,
        message: 'The confirmation code is incorrect. Please try again.',
      }
    case 'ExpiredCodeException':
      return {
        error: 6,
        message: 'The confirmation code has expired. Please request a new one.',
      }
    case 'InvalidPasswordException':
      return {
        error: 7,
        message: 'Password does not meet security requirements.',
      }
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return {
        error: 8,
        message: 'Too many attempts. Please try again later.',
      }
    case 'InvalidParameterException':
      return {
        error: 9,
        message: 'Invalid input. Please check your information.',
      }
    default:
      return {
        error: 0,
        message: 'An unexpected error occurred. Please try again.',
      }
  }
}

export const getFriendlyAuthMessage = (message?: string): { success: number; link: ToOptions['to'] } => {
  switch (message) {
    case 'RESET_PASSWORD': {
      return {
        success: 1,
        link: '/reset-password',
      }
    }
    case 'CONFIRM_SIGN_UP':
    case 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE': {
      return {
        success: 2,
        link: '/register/confirm',
      }
    }
    case 'CONFIRM_RESET_PASSWORD_WITH_CODE': {
      return {
        success: 3,
        link: '/reset-password/confirm',
      }
    }
    default: {
      return {
        success: 0,
        link: '',
      }
    }
  }
}

export const signUp = async ({ email, password, persist }: { email: string; password: string; persist: boolean }) => {
  try {
    const { nextStep } = await AWSSignUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
        },
        autoSignIn: true,
      },
    })

    console.log('next step successful')

    if (persist) {
      cognitoUserPoolsTokenProvider.setKeyValueStorage(defaultStorage)
    } else {
      cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage)
    }

    return getFriendlyAuthMessage(nextStep?.signUpStep)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error signing up:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const signIn = async ({ email, password, persist }: { email: string; password: string; persist: boolean }) => {
  try {
    const { nextStep } = await AWSSignIn({
      username: email,
      password,
    })

    if (persist) {
      cognitoUserPoolsTokenProvider.setKeyValueStorage(defaultStorage)
    } else {
      cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage)
    }

    return getFriendlyAuthMessage(nextStep?.signInStep)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error signing in:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const confirmSignUp = async ({ email, confirmationCode }: { email: string; confirmationCode: string }) => {
  try {
    const { isSignUpComplete, nextStep } = await AWSConfirmSignUp({
      username: email,
      confirmationCode,
    })

    if (isSignUpComplete) {
      if (nextStep?.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
        try {
          await autoSignIn()
          return {
            success: 4,
            link: '/home',
          } as { success: number; link: ToOptions['to'] }
        } catch (err) {
          if (import.meta.env.DEV) {
            console.log('Error signing in after sign up:', err)
          }
          return getFriendlyErrorMessage(err as { name: string })
        }
      } else {
        return getFriendlyAuthMessage(nextStep?.signUpStep)
      }
    } else {
      return getFriendlyAuthMessage(nextStep?.signUpStep)
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error confirming sign up:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const confirmSignIn = async ({ challengeResponse }: { challengeResponse: string }) => {
  try {
    const { nextStep } = await AWSConfirmSignIn({ challengeResponse })
    return getFriendlyAuthMessage(nextStep?.signInStep)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error confirming sign in:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const resendSignUpCode = async ({ email }: { email: string }) => {
  try {
    await AWSResendSignUpCode({ username: email })
    return getFriendlyAuthMessage()
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error resending confirmation code:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const resetPassword = async ({ email }: { email: string }) => {
  try {
    const { nextStep } = await AWSResetPassword({
      username: email,
      options: {
        autoSignIn: true,
      },
    })

    return getFriendlyAuthMessage(nextStep?.resetPasswordStep)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error resetting password:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const confirmResetPassword = async ({
  email,
  password,
  confirmationCode,
}: {
  email: string
  password: string
  confirmationCode: string
}) => {
  try {
    await AWSConfirmResetPassword({
      username: email,
      newPassword: password,
      confirmationCode,
    })
    return {
      success: 5,
      link: '/login',
    } as { success: number; link: ToOptions['to'] }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Error confirming password reset:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const signOut = async () => {
  try {
    await AWSSignOut()
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Error signing out:', err)
    }
  }
}

export const initUserData = async ({ userId, email }: { userId: string; email: string }) => {
  console.log({ userId, email })
  try {
    await post({
      apiName: 'InitUserDomainData',
      path: '/init-user-domain-data',
      options: {
        retryStrategy: {
          strategy: 'no-retry',
        },
        body: {
          userId,
          email,
        },
      },
    }).response

    await post({
      apiName: 'InitUserFeatureData',
      path: '/init-user-feature-data',
      options: {
        retryStrategy: {
          strategy: 'no-retry',
        },
        body: {
          userId,
          email,
        },
      },
    }).response
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Error initializing user data:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}
