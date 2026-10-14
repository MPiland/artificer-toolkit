import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { expandNodeRuntimeResponse } from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { getNodeRuntimeResolve } from '#app/data/nodeRuntime/queries'
import { authoredRouteStoryRecords, authoredRouteStorySystem } from '#domains/authoredRouteStory.fixtures'
import { configureAuthoredRouteStoryQueries } from './authoredRouteStory.utils'
import { resolveFixtureNodeRuntime } from './nodeRuntimeResolver'

describe('authored route story node-runtime resolution', () => {
  it.each(['creature', 'spell'] as const)(
    'answers the real %s resolve query in the transport shape the client expands',
    async (domain) => {
      const values = authoredRouteStoryRecords[domain]
      const queryClient = new QueryClient()
      configureAuthoredRouteStoryQueries(queryClient)

      const response = await queryClient.fetchQuery(
        getNodeRuntimeResolve({ mapId: domain, systemId: authoredRouteStorySystem.id, values })
      )

      expect(expandNodeRuntimeResponse(response)).toEqual(
        await resolveFixtureNodeRuntime({ mapId: domain, systemId: authoredRouteStorySystem.id, values })
      )
    }
  )
})
