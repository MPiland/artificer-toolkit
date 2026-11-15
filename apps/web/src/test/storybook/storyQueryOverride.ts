import type { QueryClient } from '@tanstack/react-query'
import type { ConvexReactClient, Watch } from 'convex/react'
import { getFunctionName, makeFunctionReference } from 'convex/server'
import type { Value } from 'convex/values'

/**
 * The one query a composed story answers with a value built from the seeded deployment's own
 * answer instead of the deployment's (D218): the full-quota state a seeded account cannot reach, or
 * a Sheet slice carrying one more action. `derive` receives what the deployment answers for the
 * read and returns what the story serves, so a variant starts from real data and cannot drift from
 * it. `args` narrows the override to the reads whose arguments contain those values, such as one
 * Sheet slice of `sheetSlices.get`. Stories set it in the `queryOverride` parameter, naming the
 * query with `getFunctionName` because Storybook merges parameters and would flatten a function
 * reference.
 */
export type StoryQueryOverride = {
  query: string
  args?: Record<string, string>
  derive: (served: unknown) => unknown
}

/** A subscription that never reports, so the live deployment cannot replace the served value. */
const inertWatch: Watch<never> = {
  onUpdate: () => () => undefined,
  localQueryResult: () => undefined,
  journal: () => undefined
}

export function installQueryOverride(
  { query, args = {}, derive }: StoryQueryOverride,
  queryClient: QueryClient,
  client: ConvexReactClient
) {
  const selects = (read: Record<string, unknown>) =>
    Object.entries(args).every(([name, value]) => read[name] === value)
  // ConvexQueryClient subscribes every `convexQuery` key through `watchQuery` and lets the server's
  // push replace the cache, so serving the value from the query function alone would not hold.
  // A `convexQuery` key holds the read's Convex arguments, which is what `client.query` takes.
  queryClient.setQueryDefaults(['convexQuery', query, args], {
    queryFn: async ({ queryKey }) =>
      derive(
        await client.query(
          makeFunctionReference<'query'>(query),
          queryKey[2] as Record<string, Value>
        )
      )
  })
  const watchQuery = client.watchQuery.bind(client)
  Object.defineProperty(client, 'watchQuery', {
    value: ((reference, ...rest) =>
      getFunctionName(reference) === query && selects(rest[0] ?? {})
        ? inertWatch
        : watchQuery(reference, ...rest)) satisfies ConvexReactClient['watchQuery']
  })
}
