import { z } from '../zod.js'

/** `ConvexError` data for a rejected rate-limited write. The message is safe to show to users. */
export const rateLimitedErrorDataSchema = z.strictObject({
  code: z.literal('RATE_LIMITED'),
  message: z.string().check(z.minLength(1)).check(z.maxLength(200)),
  retryAfterMs: z.number().check(z.int()).check(z.nonnegative())
})
export type RateLimitedErrorData = z.infer<typeof rateLimitedErrorDataSchema>
