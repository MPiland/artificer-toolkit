import type { QueryClient } from '@tanstack/react-query'
import type { ConvexReactClient, Watch } from 'convex/react'
import { getFunctionName } from 'convex/server'

/**
 * The one query a composed story answers with its own value instead of the seeded deployment's
 * (D218), for example the full-quota state a seeded account cannot reach. It serves every read of
 * that function through the query client; stories set it in the `queryOverride` parameter, naming
 * the query with `getFunctionName` because Storybook merges parameters and would flatten a
 * function reference.
 */
export type StoryQueryOverride = { query: string; value: unknown }

/** A subscription that never reports, so the live deployment cannot replace the served value. */
const inertWatch: Watch<never> = {
  onUpdate: () => () => undefined,
  localQueryResult: () => undefined,
  journal: () => undefined
}

export function installQueryOverride(
  { query, value }: StoryQueryOverride,
  queryClient: QueryClient,
  client: ConvexReactClient
) {
  // ConvexQueryClient subscribes every `convexQuery` key through `watchQuery` and lets the server's
  // push replace the cache, so serving the value from the query function alone would not hold.
  queryClient.setQueryDefaults(['convexQuery', query], { queryFn: async () => value })
  const watchQuery = client.watchQuery.bind(client)
  Object.defineProperty(client, 'watchQuery', {
    value: ((reference, ...rest) =>
      getFunctionName(reference) === query
        ? inertWatch
        : watchQuery(reference, ...rest)) satisfies ConvexReactClient['watchQuery']
  })
}
