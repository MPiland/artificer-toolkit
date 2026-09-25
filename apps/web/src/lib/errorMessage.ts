import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import { rateLimitedErrorDataSchema } from '@artificer-toolkit/schema/api/rateLimits'
import { ConvexError } from 'convex/values'

/** The message to show for a failed request; rate-limit and domain rejections keep theirs. */
export function errorMessage(error: Error): string {
  if (error instanceof ConvexError) {
    const limited = rateLimitedErrorDataSchema.safeParse(error.data)
    if (limited.success) return limited.data.message
    const rejected = domainRejectionErrorDataSchema.safeParse(error.data)
    if (rejected.success) return rejected.data.message
  }
  return error.message
}
