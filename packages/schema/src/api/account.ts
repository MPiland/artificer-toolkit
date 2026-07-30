import { z } from 'zod'
import { usernameInputSchema } from './auth.js'

const nullableTrimmedText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .transform((value) => value || null)

export const accountProfileDtoSchema = z.strictObject({
  username: usernameInputSchema,
  name: z.string().max(100).nullable(),
  bio: z.string().max(500).nullable()
})

export type AccountProfileDto = z.infer<typeof accountProfileDtoSchema>

export const accountProfileUpdateInputSchema = z.strictObject({
  username: usernameInputSchema,
  name: nullableTrimmedText(100),
  bio: nullableTrimmedText(500)
})

export type AccountProfileUpdateInput = z.input<typeof accountProfileUpdateInputSchema>

export const accountUsernameStatusInputSchema = z.strictObject({
  username: z.string().max(100)
})

export type AccountUsernameStatusInput = z.infer<typeof accountUsernameStatusInputSchema>

export const accountUsernameStatusDtoSchema = z.strictObject({
  status: z.enum(['available', 'taken', 'not_allowed'])
})

export type AccountUsernameStatusDto = z.infer<typeof accountUsernameStatusDtoSchema>

export const accountEmailUpdateInputSchema = z.strictObject({
  email: z.string().trim().email()
})

export type AccountEmailUpdateInput = z.infer<typeof accountEmailUpdateInputSchema>

export const accountPasswordUpdateInputSchema = z.strictObject({
  email: z.string().trim().email(),
  currentPassword: z.string().min(1),
  password: z.string().min(8).max(128)
})

export type AccountPasswordUpdateInput = z.infer<typeof accountPasswordUpdateInputSchema>

export const accountDeleteInputSchema = z.strictObject({
  email: z.string().trim().email(),
  currentPassword: z.string().min(1)
})

export type AccountDeleteInput = z.infer<typeof accountDeleteInputSchema>
