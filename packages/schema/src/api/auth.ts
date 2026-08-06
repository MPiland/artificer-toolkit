import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export const passwordInputSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`)
  .max(PASSWORD_MAX_LENGTH, `Use no more than ${PASSWORD_MAX_LENGTH} characters for your password.`)

export const usernameInputSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/)

export const authSignInInputSchema = z.strictObject({
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH)
})

export type AuthSignInInput = z.infer<typeof authSignInInputSchema>

export const authUsernameSignInInputSchema = z.strictObject({
  username: usernameInputSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH)
})

export type AuthUsernameSignInInput = z.infer<typeof authUsernameSignInInputSchema>

export const authSessionCredentialsDtoSchema = z.strictObject({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1)
})

export type AuthSessionCredentialsDto = z.infer<typeof authSessionCredentialsDtoSchema>

export const authSignUpInputSchema = z.strictObject({
  email: z.string().email(),
  password: passwordInputSchema,
  username: usernameInputSchema
})

export type AuthSignUpInput = z.infer<typeof authSignUpInputSchema>

export const authPasswordUpdateInputSchema = z.strictObject({
  password: passwordInputSchema
})

export type AuthPasswordUpdateInput = z.infer<typeof authPasswordUpdateInputSchema>

export const authInvitationCompletionInputSchema = authPasswordUpdateInputSchema.extend({
  username: usernameInputSchema
})

export type AuthInvitationCompletionInput = z.infer<typeof authInvitationCompletionInputSchema>

export const authInviteConfirmationInputSchema = z.object({
  tokenHash: z.string().min(1)
})

export type AuthInviteConfirmationInput = z.infer<typeof authInviteConfirmationInputSchema>
