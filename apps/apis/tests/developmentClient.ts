import type { ConvexHttpClient } from 'convex/browser'
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from 'convex/server'

// Shared call surface for the real HTTP client and the local transactional test adapter.
export type DevelopmentClient = Pick<ConvexHttpClient, 'query'> & {
  mutation<Reference extends FunctionReference<'mutation'>>(
    reference: Reference,
    ...args: OptionalRestArgs<Reference>
  ): Promise<FunctionReturnType<Reference>>
}
