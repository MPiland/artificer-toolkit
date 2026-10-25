import { QueryClient } from '@tanstack/react-query'
import { expect, it } from 'vitest'
import { getSystem, getSystemListPage } from '#app/data/systems/queries'
import { authoredRouteStorySystem } from '#domains/authoredRouteStory.fixtures'
import { loadAuthoredCreateRouteData } from './-authoredCreateRouteLoader'

const noSystemRequested = undefined

it('loads every native System page and the requested exact System without a legacy client', async () => {
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
  const result = await loadAuthoredCreateRouteData(client, first.id)
  expect(result.authoringData).toEqual({
    system: authoredRouteStorySystem,
    systems: [first, second]
  })
  client.clear()
})

it('retains an empty System selection instead of inventing a default System', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(getSystemListPage().queryKey, { page: [], isDone: true, continueCursor: '' })
  expect((await loadAuthoredCreateRouteData(client, noSystemRequested)).authoringData).toEqual({
    system: null,
    systems: []
  })
  client.clear()
})

it('chooses no System when several exist and none is requested', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const systems = [
    { id: authoredRouteStorySystem.id, label: 'First' },
    { id: '22222222-2222-4222-8222-222222222222', label: 'Second' }
  ]
  client.setQueryData(getSystemListPage().queryKey, {
    page: systems,
    isDone: true,
    continueCursor: ''
  })
  expect((await loadAuthoredCreateRouteData(client, noSystemRequested)).authoringData).toEqual({
    system: null,
    systems
  })
  client.clear()
})

it('uses the only System without a request and ignores an unknown requested System', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const only = { id: authoredRouteStorySystem.id, label: 'Only' }
  client.setQueryData(getSystemListPage().queryKey, {
    page: [only],
    isDone: true,
    continueCursor: ''
  })
  client.setQueryData(getSystem(only.id).queryKey, authoredRouteStorySystem)
  expect((await loadAuthoredCreateRouteData(client, noSystemRequested)).authoringData.system).toBe(
    authoredRouteStorySystem
  )
  expect((await loadAuthoredCreateRouteData(client, 'unknown')).authoringData.system).toBeNull()
  client.clear()
})
