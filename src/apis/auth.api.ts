import type { ToOptions } from '@tanstack/react-router'
import {
  InitiateAuthCommand,
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  type InitiateAuthCommandInput,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { CognitoJwtVerifier } from 'aws-jwt-verify'

const getStorage = () => (localStorage.getItem('cognito-persist') === 'true' ? localStorage : sessionStorage)

export const getToken = (key: string) => getStorage().getItem(key)
const setToken = (key: string, value: string) => getStorage().setItem(key, value)
const clearStorage = () => getStorage().clear()

const client = new CognitoIdentityProviderClient({
  region: import.meta.env.VITE_AWS_DEFAULT_REGION,
})

export const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
})

export const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  tokenUse: 'access',
  clientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
})

export const getFriendlyErrorMessage = (error: { name: string }): { error: number; message: string } => {
  switch (error.name) {
    case 'UserNotFoundException':
      return {
        error: 1,
        message: 'Incorrect email or password.',
      }
    case 'UsernameExistsException':
      return {
        error: 2,
        message: 'If an account with this email exists, a confirmation or login link will be sent.',
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
        link: '.',
      }
    }
  }
}

export const signUp = async ({ email, password }: { email: string; password: string; persist: boolean }) => {
  const command = new SignUpCommand({
    ClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
    Username: email,
    Password: password,
  })

  try {
    const response = await client.send(command)
    if (response.UserConfirmed) {
      const signInResponse = await signIn({ email, password })
      return signInResponse
    } else {
      // User needs to confirm signup
      return getFriendlyAuthMessage('CONFIRM_SIGN_UP')
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error signing up:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const resendSignUpCode = async ({ email }: { email: string }) => {
  try {
    const command = new ResendConfirmationCodeCommand({
      ClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      Username: email,
    })

    await client.send(command)
    return getFriendlyAuthMessage('CONFIRM_SIGN_UP')
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error resending confirmation code:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const confirmSignUp = async ({
  email,
  confirmationCode,
}: {
  email: string
  confirmationCode: string
  persist: boolean
}) => {
  const command = new ConfirmSignUpCommand({
    ClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
  })

  try {
    const result = await client.send(command)
    if (result.Session) {
      const idToken = (await signIn({ email, session: result.Session })) as string
      if (idToken) {
        const userAttributes = await idTokenVerifier.verify(idToken!)
        const initDomainData = userAttributes['custom: init_domain_data']
        const initFeatureData = userAttributes['custom: init_feature_data']
        if (!initDomainData) {
          console.log({ userAttributes })
          // await initUserDomainData({ userId: userAttributes.sub as string, email })
        }
        if (!initFeatureData) {
          console.log({ userAttributes })
          // await initUserFeatureData({ userId: userAttributes.sub as string, email })
        }
      }
      return getFriendlyAuthMessage()
    }
    return getFriendlyAuthMessage()
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error confirming sign up:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const signIn = async ({ email, password, session }: { email: string; password?: string; session?: string }) => {
  let authParams: InitiateAuthCommandInput['AuthParameters']
  let authFlow: InitiateAuthCommandInput['AuthFlow']
  if (password) {
    authFlow = 'USER_PASSWORD_AUTH'
    authParams = {
      USERNAME: email,
      PASSWORD: password,
    }
  } else if (session) {
    authFlow = 'USER_SRP_AUTH'
    authParams = {
      USERNAME: email,
      SESSION: session,
    }
  }

  const command = new InitiateAuthCommand({
    AuthFlow: authFlow,
    ClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
    AuthParameters: authParams,
  })

  try {
    const response = await client.send(command)
    if (response.AuthenticationResult) {
      const { AccessToken, RefreshToken, IdToken } = response.AuthenticationResult
      if (!AccessToken || !RefreshToken || !IdToken) {
        throw new Error('No authentication result')
      }

      setToken('cognito-access-token', AccessToken)
      setToken('cognito-refresh-token', RefreshToken)
      setToken('cognito-id-token', IdToken)

      if (session) {
        const userAttributes = await idTokenVerifier.verify(IdToken!)
        const initDomainData = userAttributes['custom: init_domain_data']
        const initFeatureData = userAttributes['custom: init_feature_data']
        console.log({ userAttributes })
        console.log({ userAttributes })
        if (!initDomainData) {
          // await initUserDomainData({ IdToken })
        }
        if (!initFeatureData) {
          // await initUserFeatureData({ IdToken })
        }
        return IdToken
      } else {
        return getFriendlyAuthMessage()
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error signing up:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}
export const resetPassword = async ({ email }: { email: string }) => {
  try {
    const command = new ForgotPasswordCommand({
      ClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      Username: email,
    })

    await client.send(command)
    return getFriendlyAuthMessage('CONFIRM_RESET_PASSWORD_WITH_CODE')
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
    const command = new ConfirmForgotPasswordCommand({
      ClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      Username: email,
      Password: password,
      ConfirmationCode: confirmationCode,
    })

    await client.send(command)

    return {
      success: 5,
      link: '/login',
    } as { success: number; link: ToOptions['to'] }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error confirming password reset:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const signOut = async () => {
  try {
    const accessToken = localStorage.getItem('cognito-access-token')
    if (accessToken) {
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken,
      })

      await client.send(command)

      clearStorage()
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error signing out:', err)
    }
  }
}

export const initUserDomainData = async ({ idToken }: { idToken: string }) => {
  try {
    await fetch(import.meta.env.VITE_AWS_INIT_USER_DOMAIN_DATA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    })
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error initializing user data:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const initUserFeatureData = async ({ idToken }: { idToken: string }) => {
  try {
    await fetch(import.meta.env.VITE_AWS_INIT_USER_FEATURE_DATA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`, // ✅ pass the token here
      },
    })
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log('Error initializing user data:', err)
    }
    return getFriendlyErrorMessage(err as { name: string })
  }
}

export const verifyUser = async () => {
  const accessToken = getToken('cognito-access-token')
  const idToken = getToken('cognito-id-token')
  const refreshToken = getToken('cognito-refresh-token')

  if (!accessToken || !idToken) {
    return { user: null, tokens: null }
  }

  const now = Math.floor(Date.now() / 1000)

  const verifyToken = async (token: string, verifier: typeof idTokenVerifier | typeof accessTokenVerifier) => {
    try {
      const decoded = await verifier.verify(token)
      const expired = decoded.exp && decoded.exp < now
      return { decoded, expired }
    } catch (err) {
      if (import.meta.env.DEV) console.log('Token verification failed:', err)
      return { decoded: null, expired: true }
    }
  }

  const [idTokenResult, accessTokenResult] = await Promise.all([
    verifyToken(idToken, idTokenVerifier),
    verifyToken(accessToken, accessTokenVerifier),
  ])

  // If either token is expired, attempt refresh
  if ((idTokenResult.expired || accessTokenResult.expired) && refreshToken) {
    try {
      const refreshCommand = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      })

      const refreshResponse = await client.send(refreshCommand)
      if (!refreshResponse.AuthenticationResult?.AccessToken || !refreshResponse.AuthenticationResult?.IdToken) {
        throw new Error('Failed to refresh tokens')
      }

      const newIdToken = refreshResponse.AuthenticationResult.IdToken
      const newAccesToken = refreshResponse.AuthenticationResult.AccessToken

      setToken('cognito-access-token', newAccesToken)
      setToken('cognito-id-token', newIdToken)

      const decodedIdToken = await idTokenVerifier.verify(newIdToken)

      return { user: decodedIdToken, tokens: refreshResponse.AuthenticationResult.AccessToken }
    } catch (err) {
      if (import.meta.env.DEV) console.log('Error refreshing tokens:', err)
      await signOut()
      return { user: null, tokens: null }
    }
  }

  if (!idTokenResult.decoded) {
    await signOut()
    return { user: null, tokens: null }
  }

  // Tokens valid, return decoded ID token and current access token
  return { user: idTokenResult.decoded, tokens: accessToken }
}
