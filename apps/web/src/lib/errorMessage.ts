import { rateLimitedErrorDataSchema } from '@artificer-toolkit/schema/api/rateLimits'
import { ConvexError } from 'convex/values'

/** The message to show for a failed request; rate-limit rejections keep their server message. */
export function errorMessage(error: Error): string {
  if (error instanceof ConvexError) {
    const limited = rateLimitedErrorDataSchema.safeParse(error.data)
    if (limited.success) return limited.data.message
  }
  return error.message
}
