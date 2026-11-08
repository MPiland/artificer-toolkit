import { ConvexError } from 'convex/values'
import { EncounterDomainRejection } from '@artificer-toolkit/encounter-persistence/domainRejections'

/**
 * A handler that reports `EncounterDomainRejection` as a `ConvexError` with the same data. Every
 * query and mutation builder wraps its handlers with this once, so no handler translates on its
 * own. Actions reach Encounter code only through wrapped functions.
 */
export function translateDomainRejections<Ctx, Args extends unknown[], Result>(
  handler: (ctx: Ctx, ...args: Args) => Result | Promise<Result>
): (ctx: Ctx, ...args: Args) => Promise<Result> {
  return async (ctx, ...args) => {
    try {
      return await handler(ctx, ...args)
    } catch (error) {
      // The Encounter package's refusal reaches clients as the `ConvexError` it always was.
      throw error instanceof EncounterDomainRejection ? new ConvexError(error.data) : error
    }
  }
}
