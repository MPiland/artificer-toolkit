import { z } from '../zod.js'
import { applicationFeatureFlagsDtoSchema } from './applicationConfig.js'
import { authIdentityDtoSchema } from './authIdentity.js'

// Server-to-server rate-limit context only; this is never an account credential.
export const authProxyContextDtoSchema = z.strictObject({
  ip: z.union([z.ipv4(), z.ipv6()]),
  method: z.enum(['GET', 'POST']),
  path: z
    .string()
    .check(z.maxLength(256))
    .check(z.regex(/^\/api\/auth\/[A-Za-z0-9/_-]+$/))
})
export type AuthProxyContextDto = z.infer<typeof authProxyContextDtoSchema>

export const authEmailDeliveryInputSchema = z
  .strictObject({
    action: z.enum(['signup', 'recovery', 'invite', 'email_change']),
    recipient: z.email().check(z.maxLength(320)),
    actionUrl: z.url().check(z.maxLength(4096)),
    token: z.optional(z.string().check(z.regex(/^\d{6}$/)))
  })
  .check(
    z.superRefine((value, context) => {
      if (value.action === 'recovery' && !value.token) {
        context.addIssue({
          code: 'custom',
          path: ['token'],
          message: 'Recovery requires a verification code.'
        })
      }
    })
  )

export type AuthEmailDeliveryInput = z.infer<typeof authEmailDeliveryInputSchema>

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export const passwordInputSchema = z
  .string()
  .check(
    z.minLength(
      PASSWORD_MIN_LENGTH,
      `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`
    )
  )
  .check(
    z.maxLength(
      PASSWORD_MAX_LENGTH,
      `Use no more than ${PASSWORD_MAX_LENGTH} characters for your password.`
    )
  )

export const usernameInputSchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(3))
  .check(z.maxLength(30))
  .check(z.regex(/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/))

export const authoringExperienceSchema = z.enum(['guided', 'advanced'])
export type AuthoringExperience = z.infer<typeof authoringExperienceSchema>

export const authSessionUserDtoSchema = z.extend(authIdentityDtoSchema, {
  email: z.email().check(z.maxLength(320)),
  username: z.nullable(usernameInputSchema),
  registrationCompleted: z.boolean(),
  authoringExperience: authoringExperienceSchema
})
export type AuthSessionUserDto = z.infer<typeof authSessionUserDtoSchema>

export const authSessionSnapshotDtoSchema = z.strictObject({
  user: z.nullable(authSessionUserDtoSchema),
  featureFlags: applicationFeatureFlagsDtoSchema,
  isSuperAdmin: z.boolean()
})
export type AuthSessionSnapshotDto = z.infer<typeof authSessionSnapshotDtoSchema>

export const setAuthoringExperienceInputSchema = z.strictObject({
  experience: authoringExperienceSchema
})
export type SetAuthoringExperienceInput = z.infer<typeof setAuthoringExperienceInputSchema>

export const authSignInInputSchema = z.strictObject({
  identifier: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(320)),
  password: z.string().check(z.minLength(1)).check(z.maxLength(PASSWORD_MAX_LENGTH))
})

export type AuthSignInInput = z.infer<typeof authSignInInputSchema>

export const authUsernameSignInInputSchema = z.strictObject({
  username: usernameInputSchema,
  password: z.string().check(z.minLength(1)).check(z.maxLength(PASSWORD_MAX_LENGTH))
})

export type AuthUsernameSignInInput = z.infer<typeof authUsernameSignInInputSchema>

export const authSessionCredentialsDtoSchema = z.strictObject({
  accessToken: z.string().check(z.minLength(1)),
  refreshToken: z.string().check(z.minLength(1))
})

export type AuthSessionCredentialsDto = z.infer<typeof authSessionCredentialsDtoSchema>

export const authSignUpInputSchema = z.strictObject({
  email: z.string().check(z.email()),
  password: passwordInputSchema,
  username: usernameInputSchema
})

export type AuthSignUpInput = z.infer<typeof authSignUpInputSchema>

export const authPasswordUpdateInputSchema = z.strictObject({
  password: passwordInputSchema
})

export type AuthPasswordUpdateInput = z.infer<typeof authPasswordUpdateInputSchema>

export const authRecoveryCommandSchema = z.discriminatedUnion('operation', [
  z.strictObject({
    operation: z.literal('REQUEST'),
    email: z.email().check(z.maxLength(320))
  }),
  z.strictObject({
    operation: z.literal('CHECK'),
    email: z.email().check(z.maxLength(320)),
    token: z.string().check(z.regex(/^\d{6}$/))
  }),
  z.strictObject({
    operation: z.literal('RESET'),
    email: z.email().check(z.maxLength(320)),
    token: z.string().check(z.regex(/^\d{6}$/)),
    password: passwordInputSchema
  })
])
export type AuthRecoveryCommand = z.infer<typeof authRecoveryCommandSchema>

export const authPasswordResetInputSchema = z.omit(authRecoveryCommandSchema._zod.def.options[2], {
  operation: true
})
export type AuthPasswordResetInput = z.infer<typeof authPasswordResetInputSchema>

export const authRecoveryResultSchema = z.discriminatedUnion('success', [
  z.strictObject({ success: z.literal(true) }),
  z.strictObject({
    success: z.literal(false),
    status: z.number().check(z.int()).check(z.gte(400)).check(z.lte(499)),
    code: z.string().check(z.maxLength(128)),
    message: z.string().check(z.maxLength(512))
  })
])
export type AuthRecoveryResult = z.infer<typeof authRecoveryResultSchema>

export const authPasswordRecoveryVerificationInputSchema = z.strictObject({
  email: z.string().check(z.trim()).check(z.email()),
  token: z.string().check(z.regex(/^\d{6}$/, 'Enter the six-digit verification code.'))
})

export type AuthPasswordRecoveryVerificationInput = z.infer<
  typeof authPasswordRecoveryVerificationInputSchema
>

export const authInvitationCompletionInputSchema = z.extend(authPasswordUpdateInputSchema, {
  username: usernameInputSchema
})

export type AuthInvitationCompletionInput = z.infer<typeof authInvitationCompletionInputSchema>

export const authInvitationIssueInputSchema = z.strictObject({
  email: z.pipe(
    z.email().check(z.maxLength(320)),
    z.transform((value) => value.toLowerCase())
  )
})

export const authInvitationRedeemInputSchema = z.extend(authInvitationIssueInputSchema, {
  token: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
  username: usernameInputSchema,
  password: passwordInputSchema
})
export type AuthInvitationRedeemInput = z.infer<typeof authInvitationRedeemInputSchema>
// Trusted server preparation only; the public redemption input never accepts a credential hash.
export const authInvitationRedeemPreparedInputSchema = z.extend(authInvitationRedeemInputSchema, {
  passwordHash: z.string().check(z.regex(/^[a-f0-9]{32}:[a-f0-9]{128}$/))
})
export type AuthInvitationRedeemPreparedInput = z.infer<
  typeof authInvitationRedeemPreparedInputSchema
>

export const authEmailConfirmationSearchSchema = z.object({
  error: z.optional(z.catch(z.string().check(z.maxLength(128)), 'INVALID_CALLBACK'))
})
