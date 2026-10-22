import {
  authInvitationRedeemInputSchema,
  authPasswordResetInputSchema,
  authPasswordRecoveryVerificationInputSchema,
  authRecoveryCommandSchema,
  authSignInInputSchema,
  authSignUpInputSchema,
  type AuthInvitationRedeemInput,
  type AuthPasswordResetInput,
  type AuthPasswordRecoveryVerificationInput,
  type AuthSignInInput,
  type AuthSignUpInput
} from '@artificer-toolkit/schema/api/auth'
import { clearPrivateContentSnapshots } from '#app/data/contentSnapshots/privateContent'
import { betterAuthClient } from './betterAuthClient'

export interface AuthResult {
  ok: boolean
  message?: string
}

type SignInInput = AuthSignInInput

type SignUpInput = AuthSignUpInput

interface RequestPasswordResetInput {
  email: string
}

type ResetPasswordInput = AuthPasswordResetInput

type VerifyPasswordRecoveryInput = AuthPasswordRecoveryVerificationInput

type CompleteInvitationInput = AuthInvitationRedeemInput

export interface AuthClient {
  completeInvitation(input: CompleteInvitationInput): Promise<AuthResult>
  signIn(input: SignInInput): Promise<AuthResult>
  signUp(input: SignUpInput): Promise<AuthResult>
  requestPasswordReset(input: RequestPasswordResetInput): Promise<AuthResult>
  verifyPasswordRecovery(input: VerifyPasswordRecoveryInput): Promise<AuthResult>
  resetPassword(input: ResetPasswordInput): Promise<AuthResult>
  signOut(): Promise<AuthResult>
}

function isRateLimited(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 429
}

export const browserAuthClient: AuthClient = {
  async completeInvitation(input) {
    const parsed = authInvitationRedeemInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message }
    }

    try {
      const result = await betterAuthClient.$fetch('/invitation/redeem', {
        method: 'POST',
        body: parsed.data
      })
      return result.error
        ? { ok: false, message: 'Could not complete registration.' }
        : { ok: true }
    } catch {
      return {
        ok: false,
        message: 'Could not complete registration.'
      }
    }
  },
  async signIn(input) {
    const parsed = authSignInInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Check your email or username and password, then try again.'
      }
    }

    try {
      const result = parsed.data.identifier.includes('@')
        ? await betterAuthClient.signIn.email({
            email: parsed.data.identifier,
            password: parsed.data.password
          })
        : await betterAuthClient.signIn.username({
            username: parsed.data.identifier,
            password: parsed.data.password
          })
      return result.error
        ? {
            ok: false,
            message: isRateLimited(result.error)
              ? 'Too many sign-in attempts. Try again shortly.'
              : result.error.status === 403 && result.error.code === 'EMAIL_NOT_VERIFIED'
                ? 'Confirm your email before signing in. Check your inbox for a new confirmation link.'
                : 'Check your email or username and password, then try again.'
          }
        : { ok: true }
    } catch (error) {
      if (isRateLimited(error)) {
        return {
          ok: false,
          message: 'Too many sign-in attempts. Try again shortly.'
        }
      }
      return {
        ok: false,
        message: 'Check your email or username and password, then try again.'
      }
    }
  },
  async signUp(input) {
    const parsed = authSignUpInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false, message: 'Check the form and try again.' }

    try {
      const result = await betterAuthClient.signUp.email({
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.username,
        username: parsed.data.username
      })
      return result.error
        ? { ok: false, message: 'Could not create your account. Try again.' }
        : { ok: true }
    } catch {
      return {
        ok: false,
        message: 'Could not create your account. Try again.'
      }
    }
  },
  async requestPasswordReset(input) {
    const parsed = authRecoveryCommandSchema.safeParse({
      ...input,
      operation: 'REQUEST'
    })
    if (!parsed.success) return { ok: false, message: 'Check the email address and try again.' }

    try {
      const result = await betterAuthClient.emailOtp.requestPasswordReset({
        email: parsed.data.email
      })
      return result.error
        ? {
            ok: false,
            message: "We couldn't send a verification code. Try again."
          }
        : { ok: true }
    } catch {
      return {
        ok: false,
        message: "We couldn't send a verification code. Try again."
      }
    }
  },
  async verifyPasswordRecovery(input) {
    const parsed = authPasswordRecoveryVerificationInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message }
    }

    try {
      const result = await betterAuthClient.emailOtp.checkVerificationOtp({
        email: parsed.data.email,
        otp: parsed.data.token,
        type: 'forget-password'
      })
      return result.error
        ? {
            ok: false,
            message: 'That verification code is invalid or has expired.'
          }
        : { ok: true }
    } catch {
      return {
        ok: false,
        message: 'That verification code is invalid or has expired.'
      }
    }
  },
  async resetPassword(input) {
    const parsed = authPasswordResetInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message }
    }

    try {
      const result = await betterAuthClient.emailOtp.resetPassword({
        email: parsed.data.email,
        otp: parsed.data.token,
        password: parsed.data.password
      })
      return result.error
        ? { ok: false, message: "We couldn't update your password. Try again." }
        : { ok: true }
    } catch {
      return {
        ok: false,
        message: "We couldn't update your password. Try again."
      }
    }
  },
  async signOut() {
    try {
      const result = await betterAuthClient.signOut()
      if (result.error) return { ok: false, message: 'Could not sign out. Try again.' }
      await clearPrivateContentSnapshots()
      return { ok: true }
    } catch {
      return { ok: false, message: 'Could not sign out. Try again.' }
    }
  }
}
