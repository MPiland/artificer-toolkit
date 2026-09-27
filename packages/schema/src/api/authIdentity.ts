import { z } from '../zod.js'

/**
 * The authenticated caller. Every Convex function resolves it, so it stays apart from the auth
 * form schemas: each call then constructs only this (D52).
 */
export const authIdentityDtoSchema = z.strictObject({
  userId: z.uuid(),
  role: z.enum(['user', 'superadmin'])
})

export type AuthIdentityDto = z.infer<typeof authIdentityDtoSchema>
