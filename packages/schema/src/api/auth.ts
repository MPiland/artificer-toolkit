import { z } from 'zod'

export const usernameInputSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/)

export const authSignUpInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: usernameInputSchema
})

export type AuthSignUpInput = z.infer<typeof authSignUpInputSchema>

export const authInviteConfirmationInputSchema = z.object({
  tokenHash: z.string().min(1)
})

export type AuthInviteConfirmationInput = z.infer<typeof authInviteConfirmationInputSchema>
