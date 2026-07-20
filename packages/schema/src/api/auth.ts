import { z } from 'zod'

export const authSignUpInputSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1),
  password: z.string().min(8)
})

export type AuthSignUpInput = z.infer<typeof authSignUpInputSchema>

export const authInviteConfirmationInputSchema = z.object({
  tokenHash: z.string().min(1)
})

export type AuthInviteConfirmationInput = z.infer<typeof authInviteConfirmationInputSchema>
