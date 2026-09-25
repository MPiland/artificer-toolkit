import { z } from '../zod.js'
import {
  authEmailConfirmationSearchSchema,
  passwordInputSchema,
  usernameInputSchema
} from './auth.js'

export const accountEmailConfirmationSearchSchema = z.object({
  ...authEmailConfirmationSearchSchema.shape,
  emailChanged: z.optional(z.literal('1'))
})

const nullableTrimmedText = (maxLength: number) =>
  z.pipe(
    z.nullable(z.string().check(z.trim()).check(z.maxLength(maxLength))),
    z.transform((value) => value || null)
  )

export const accountProfileDtoSchema = z.strictObject({
  username: z.nullable(usernameInputSchema),
  bio: z.nullable(z.string().check(z.maxLength(500)))
})

export type AccountProfileDto = z.infer<typeof accountProfileDtoSchema>

export const accountProfileUpdateInputSchema = z.strictObject({
  username: z.optional(usernameInputSchema),
  bio: nullableTrimmedText(500)
})

export type AccountProfileUpdateInput = z.input<typeof accountProfileUpdateInputSchema>

export const accountRollPreferencesDtoSchema = z.strictObject({
  autoRollDice: z.boolean()
})

export type AccountRollPreferencesDto = z.infer<typeof accountRollPreferencesDtoSchema>

export const setAutoRollDiceInputSchema = z.strictObject({
  autoRollDice: z.boolean()
})

export type SetAutoRollDiceInput = z.infer<typeof setAutoRollDiceInputSchema>

export const accountUsernameStatusInputSchema = z.strictObject({
  username: z.string().check(z.maxLength(100))
})

export type AccountUsernameStatusInput = z.infer<typeof accountUsernameStatusInputSchema>

export const accountUsernameStatusDtoSchema = z.strictObject({
  status: z.enum(['available', 'taken', 'not_allowed'])
})

export type AccountUsernameStatusDto = z.infer<typeof accountUsernameStatusDtoSchema>

export const accountEmailUpdateInputSchema = z.strictObject({
  email: z.string().check(z.trim()).check(z.email())
})

export type AccountEmailUpdateInput = z.infer<typeof accountEmailUpdateInputSchema>

export const accountPasswordUpdateInputSchema = z.strictObject({
  email: z.string().check(z.trim()).check(z.email()),
  currentPassword: z.string().check(z.minLength(1)),
  password: passwordInputSchema
})

export type AccountPasswordUpdateInput = z.infer<typeof accountPasswordUpdateInputSchema>

export const accountDeleteInputSchema = z.strictObject({
  email: z.string().check(z.trim()).check(z.email()),
  currentPassword: z.string().check(z.minLength(1))
})

export type AccountDeleteInput = z.infer<typeof accountDeleteInputSchema>
