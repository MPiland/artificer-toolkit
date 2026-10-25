import type { GameSystemRuleCapabilityDto } from '@artificer-toolkit/schema/api/rulesRuntime'
import type { SystemListItemDto } from '@artificer-toolkit/schema/api/systems'
import { api } from '@artificer-toolkit/apis/convex/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import type { ReactNode } from 'react'
import { afterEach, expect, it } from 'vitest'
import { authoredRouteStorySystems } from '#domains/authoredRouteStory.fixtures'
import { getSystemRuleCapability } from '#app/data/systems/queries'
import { useShellNavigation } from './useShellNavigation'

const clients: QueryClient[] = []
afterEach(() => clients.splice(0).forEach((client) => client.clear()))

function system(index: number): SystemListItemDto {
  return {
    ...authoredRouteStorySystems[0]!,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    label: `System ${index}`
  }
}

function setup(
  systems: SystemListItemDto[],
  capabilityFor: (id: string) => Pick<GameSystemRuleCapabilityDto, 'contentKinds'> | Error
) {
  const queryFn = ({ queryKey }: { queryKey: readonly unknown[] }) => {
    if (queryKey[1] === getFunctionName(api.content.systems.list)) {
      return { page: systems, isDone: true, continueCursor: '' }
    }
    const result = capabilityFor((queryKey[2] as { id: string }).id)
    if (result instanceof Error) throw result
    return result
  }
  const client = new QueryClient({ defaultOptions: { queries: { queryFn, retry: false } } })
  clients.push(client)
  const hook = renderHook(() => useShellNavigation(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  })
  return { ...hook, client }
}

const contentLabels = (navigation: ReturnType<typeof useShellNavigation>) =>
  navigation.find((group) => group.label === 'Content')?.items.map((item) => item.label)

it('builds Content from the union of kinds published by every visible System', async () => {
  const hook = setup([system(1), system(2)], (id) =>
    id === system(1).id ? { contentKinds: ['SPELL', 'CLASS'] } : { contentKinds: ['CLASS', 'RACE'] }
  )

  await waitFor(() => expect(contentLabels(hook.result.current)).toBeDefined())
  expect(contentLabels(hook.result.current)).toEqual(['Spells', 'Races', 'Classes'])
})

it('shows the empty state when the user can see no System', async () => {
  const hook = setup([], () => ({ contentKinds: ['SPELL'] }))

  await waitFor(() =>
    expect(hook.result.current.find((group) => group.label === 'Content')?.emptyLabel).toBe(
      'No Game System content available'
    )
  )
  expect(contentLabels(hook.result.current)).toEqual([])
})

it('shows no Content group rather than a partial one when a capability read fails', async () => {
  const hook = setup([system(1), system(2)], (id) =>
    id === system(1).id ? { contentKinds: ['SPELL'] } : new Error('capability unavailable')
  )

  await waitFor(() =>
    expect(hook.client.getQueryState(getSystemRuleCapability(system(2).id).queryKey)?.status).toBe(
      'error'
    )
  )
  expect(contentLabels(hook.result.current)).toBeUndefined()
})
