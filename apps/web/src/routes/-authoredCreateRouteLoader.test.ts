import { QueryClient } from '@tanstack/react-query'
import { expect, it } from 'vitest'
import { getSystem, getSystemListPage } from '#app/data/systems/queries'
import { authoredRouteStorySystem } from '#domains/authoredRouteStory.fixtures'
import { loadAuthoredCreateRouteData } from './-authoredCreateRouteLoader'

it('loads every native System page and the selected exact System without a legacy client', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const first = { id: authoredRouteStorySystem.id, label: 'First' }
  const second = { id: '22222222-2222-4222-8222-222222222222', label: 'Second' }
  client.setQueryData(getSystemListPage().queryKey, {
    page: [first],
    isDone: false,
    continueCursor: 'page-2'
  })
  client.setQueryData(getSystemListPage('page-2').queryKey, {
    page: [second],
    isDone: true,
    continueCursor: ''
  })
  client.setQueryData(getSystem(first.id).queryKey, authoredRouteStorySystem)
  const result = await loadAuthoredCreateRouteData(client)
  expect(result.authoringData).toEqual({
    system: authoredRouteStorySystem,
    systems: [first, second]
  })
  client.clear()
})

it('retains an empty System selection instead of inventing a default System', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(getSystemListPage().queryKey, { page: [], isDone: true, continueCursor: '' })
  expect((await loadAuthoredCreateRouteData(client)).authoringData).toEqual({
    system: null,
    systems: []
  })
  client.clear()
})
