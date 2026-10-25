import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { SystemListItemDto } from '@artificer-toolkit/schema/api/systems'
import type { GameSystemRuleCapabilityDto } from '@artificer-toolkit/schema/api/rulesRuntime'
import { getSystem, getSystemRuleCapability, getSystemSummary } from '#app/data/systems/queries'
import {
  authoredRouteStorySystem,
  authoredRouteStorySystems
} from '#domains/authoredRouteStory.fixtures'
import { loadAuthoredRouteSystem } from '#app/routes/-authoredRouteSystem'
import { SystemDetailPage } from './SystemDetailPage'

const mocks = vi.hoisted(() => ({
  definitionWorkspace: vi.fn<
    (props: { gameSystemId: string; definitionFamilyKeys: readonly string[] }) => null
  >(() => null)
}))

vi.mock('./SystemDefinitionWorkspace', () => ({
  SystemDefinitionWorkspace: mocks.definitionWorkspace
}))

function renderSystemDetail(
  summary: SystemListItemDto | null,
  capability: GameSystemRuleCapabilityDto | null = null
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const systemQuery = vi.fn(async () => authoredRouteStorySystem)
  const summaryQuery = vi.fn(async () => summary)
  const capabilityQuery = vi.fn(async () => capability)
  expect(getSystemRuleCapability(authoredRouteStorySystem.id).queryKey).toEqual([
    'convexQuery',
    getFunctionName(api.content.systems.capability),
    { id: authoredRouteStorySystem.id }
  ])
  expect(getSystemRuleCapability(authoredRouteStorySystem.id).queryFn).toBeUndefined()
  queryClient.setQueryDefaults(getSystem(authoredRouteStorySystem.id).queryKey, {
    queryFn: systemQuery
  })
  queryClient.setQueryDefaults(getSystemSummary(authoredRouteStorySystem.id).queryKey, {
    queryFn: summaryQuery
  })
  queryClient.setQueryDefaults(getSystemRuleCapability(authoredRouteStorySystem.id).queryKey, {
    queryFn: capabilityQuery
  })
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading System</div>}>
          <SystemDetailPage systemId={authoredRouteStorySystem.id} />
        </Suspense>
      </QueryClientProvider>
    </MantineProvider>
  )
  return { queryClient, systemQuery, summaryQuery, capabilityQuery }
}

describe('SystemDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the exact System and catalogue summary through Convex and shares the authored-route cache', async () => {
    const { queryClient, systemQuery, summaryQuery, capabilityQuery } = renderSystemDetail({
      ...authoredRouteStorySystems[0]!,
      rulesCatalogues: [
        { id: '66666666-6666-4666-8666-666666666666', label: '2014 SRD', description: null }
      ]
    })

    expect(
      await screen.findByRole('heading', { name: authoredRouteStorySystem.label })
    ).toBeVisible()
    expect(screen.getByText('2014 SRD')).toBeVisible()
    expect(await loadAuthoredRouteSystem(queryClient, authoredRouteStorySystem.id)).toEqual(
      authoredRouteStorySystem
    )
    expect(await loadAuthoredRouteSystem(queryClient, null)).toBeNull()
    expect(systemQuery).toHaveBeenCalledTimes(1)
    expect(summaryQuery).toHaveBeenCalledTimes(1)
    expect(capabilityQuery).toHaveBeenCalledTimes(1)
  })

  it('shows unavailable when the exact catalogue summary is absent', async () => {
    renderSystemDetail(null)
    expect(await screen.findByText('This Game System is unavailable.')).toBeVisible()
  })

  it('offers authored publisher families without exposing generated Effect-action roots', async () => {
    renderSystemDetail(authoredRouteStorySystems[0]!, {
      gameSystemId: authoredRouteStorySystem.id,
      contractVersion: 1,
      authoredRootKinds: ['effect'],
      contentKinds: [],
      definitionFamilyKeys: ['effect-action', 'sense', 'rules-runtime-graph'],
      factContracts: [],
      operationContracts: []
    })
    await screen.findByRole('heading', { name: authoredRouteStorySystem.label })
    expect(mocks.definitionWorkspace.mock.calls[0]?.[0]).toEqual({
      gameSystemId: authoredRouteStorySystem.id,
      definitionFamilyKeys: ['sense', 'rules-runtime-graph']
    })
    expect(screen.queryByText('Effect Action')).not.toBeInTheDocument()
  })
})
