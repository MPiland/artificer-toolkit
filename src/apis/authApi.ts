import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GetUserCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const client = new CognitoIdentityProviderClient({
  region: import.meta.env.VITE_AWS_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION,
})
const clientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || process.env.COGNITO_USER_POOL_CLIENT_ID

export const getUserCommand = async () => {
  const accessToken = sessionStorage.getItem('artificerToolkitToken')

  if (accessToken) {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    })

    const userAttributesResponse = await client.send(command)

    return userAttributesResponse
  }
}

export const getFriendlyErrorMessage = (error: any): { error: number; message: string } => {
  switch (error.name) {
    case 'UsernameExistsException':
      return {
        error: 1,
        message: 'An account with this email already exists.',
      }
    case 'UserNotFoundException':
      return {
        error: 2,
        message: 'No account found with this email.',
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

export const signUp = async ({ password, email }: { password: string; email: string; persist: boolean }) => {
  try {
    const command = new SignUpCommand({
      ClientId: clientId,
      Username: email,
      Password: password,
    })

    const response = await client.send(command)
    return response
  } catch (err) {
    console.log(err)
    return getFriendlyErrorMessage(err)
  }
}

export const confirmSignUp = async ({ email, code }: { email: string; code: string }) => {
  const command = new ConfirmSignUpCommand({
    ClientId: clientId,
    Username: email,
    ConfirmationCode: code,
  })

  try {
    const response = await client.send(command)
    return response
  } catch (error) {
    console.log('Confirm sign up error', error)
    return getFriendlyErrorMessage(error)
  }
}

export const signIn = async ({ email, password, persist }: { email: string; password: string; persist: boolean }) => {
  const input: InitiateAuthCommandInput = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
    ClientId: clientId,
  }

  const command = new InitiateAuthCommand(input)

  try {
    const response = await client.send(command)
    if (response.AuthenticationResult) {
      if (response.AuthenticationResult.AccessToken) {
        if (persist && response.AuthenticationResult.RefreshToken) {
          localStorage.setItem('artificerToolkitRefresh', response.AuthenticationResult.RefreshToken)
        }
        sessionStorage.setItem('artificerToolkitToken', response.AuthenticationResult.AccessToken)

        return response
      } else {
        return getFriendlyErrorMessage({})
      }
    } else {
      return getFriendlyErrorMessage({})
    }
  } catch (error) {
    console.log('Sign in error', error)
    return getFriendlyErrorMessage(error)
  }
}

export const resendConfirmationCode = async ({ email }: { email: string }) => {
  const command = new ResendConfirmationCodeCommand({
    ClientId: clientId,
    Username: email,
  })

  try {
    const response = await client.send(command)
    return response
  } catch (error) {
    console.log('Resend confirmation code error', error)
    return getFriendlyErrorMessage(error)
  }
}

export const forgotPassword = async (email: string) => {
  const command = new ForgotPasswordCommand({
    ClientId: clientId,
    Username: email,
  })
  await client.send(command)
}

export const confirmForgotPassword = async ({
  email,
  code,
  newPassword,
}: {
  email: string
  code: string
  newPassword: string
}) => {
  const command = new ConfirmForgotPasswordCommand({
    ClientId: clientId,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  })

  try {
    const response = await client.send(command)
    return response
  } catch (error) {
    console.log('Confirm forgot password error', error)
    return getFriendlyErrorMessage(error)
  }
}

export const refreshTokens = async (refreshToken: string) => {
  const input: InitiateAuthCommandInput = {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
    ClientId: clientId,
  }

  const command = new InitiateAuthCommand(input)

  try {
    const response = await client.send(command)

    if (response.AuthenticationResult) {
      const { AccessToken, IdToken, RefreshToken } = response.AuthenticationResult

      const userAttributesResponse = await getUserCommand()

      // Store the tokens
      if (AccessToken && IdToken) {
        sessionStorage.setItem('artificerToolkitToken', AccessToken)
        sessionStorage.setItem('artificerToolkitIdToken', IdToken)
      }

      // Store the refresh token if needed
      if (RefreshToken) {
        localStorage.setItem('artificerToolkitRefresh', RefreshToken)
      }

      // Return the new session, including user attributes
      return {
        tokens: { AccessToken, IdToken, RefreshToken },
        user: userAttributesResponse?.UserAttributes,
      }
    } else {
      throw new Error('Unable to refresh tokens')
    }
  } catch (error) {
    if (error.name === 'RefreshTokenExpiredException') {
      // Handle expired refresh token
      console.log('Refresh token expired. Please log in again.')
      // You could log the user out here and redirect to the login page
      throw new Error('Session expired. Please log in again.')
    } else {
      console.log('Error refreshing tokens', error)
      throw error
    }
  }
}

export const signOut = async () => {
  const accessToken = sessionStorage.getItem('artificerToolkitToken')

  if (!accessToken) {
    // If there's no token, just clear storage and exit
    localStorage.removeItem('artificerToolkitRefresh')
    sessionStorage.removeItem('artificerToolkitToken')
    sessionStorage.removeItem('artificerToolkitIdToken')
    return { success: true, message: 'No active session found.' }
  }

  const command = new GlobalSignOutCommand({
    AccessToken: accessToken,
  })

  try {
    await client.send(command)
  } catch (error) {
    console.log('Sign out error', error)
    // Don't block logout even if AWS signout fails
  } finally {
    // Clear tokens regardless of signout success
    localStorage.removeItem('artificerToolkitRefresh')
    sessionStorage.removeItem('artificerToolkitToken')
    sessionStorage.removeItem('artificerToolkitIdToken')
  }

  return { success: true, message: 'Signed out successfully.' }
}
