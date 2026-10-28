import { ConvexError } from 'convex/values'
import { EncounterDomainRejection } from '@artificer-toolkit/encounter-persistence/domainRejections'

type Handler = (ctx: never, args: never) => unknown
type Definition = Handler | { handler: Handler }

function translatedHandler(handler: Handler): Handler {
  return async (ctx, args) => {
    try {
      return await handler(ctx, args)
    } catch (error) {
      // The Encounter package's refusal reaches clients as the `ConvexError` it always was.
      throw error instanceof EncounterDomainRejection ? new ConvexError(error.data) : error
    }
  }
}

/**
 * A Convex function builder whose functions report `EncounterDomainRejection` as a `ConvexError`
 * with the same data. Every query and mutation builder is wrapped once here, so no handler
 * translates on its own. Actions reach Encounter code only through wrapped functions.
 */
export function withDomainRejections<Builder extends (definition: never) => unknown>(
  builder: Builder
): Builder {
  // Convex builders are generic over their context and arguments; the wrapper reads only the
  // definition's handler and passes everything else through, so it sees them untyped.
  const registerWith = builder as unknown as (definition: Definition) => unknown
  const register = (definition: Definition) => {
    if (typeof definition === 'function') return registerWith(translatedHandler(definition))
    const handler = translatedHandler(definition.handler)
    // Copies descriptors, not values: a spread would run every `get args()`/`get returns()` at
    // module load, and Convex re-evaluates modules on every call (D59).
    return registerWith(
      Object.defineProperties(
        { handler },
        { ...Object.getOwnPropertyDescriptors(definition), handler: { value: handler } }
      )
    )
  }
  // Only the handler is replaced, so the builder's own signature still describes the wrapper.
  return register as unknown as Builder
}
