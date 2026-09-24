import { QueryClient } from '@tanstack/react-query'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { EncounterBlueprintDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterBlueprintListInputSchema } from '@artificer-toolkit/schema/api/encounterBlueprintPages'
import { getCampaignEncounters, getEncounterBlueprints } from './queries'

const gameSystemId = '00000000-0000-4000-8000-000000000001'
const campaignId = '00000000-0000-4000-8000-000000000002'
const blueprint = {
  id: '00000000-0000-4000-8000-000000000003',
  gameSystemId,
  name: 'Fixture Blueprint',
  version: 1,
  enemies: [],
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
  setupChecksum: 'a'.repeat(64)
} satisfies EncounterBlueprintDto

function client() {
  return new ConvexReactClient('https://unit-test.convex.cloud', { logger: false })
}

afterEach(() => vi.restoreAllMocks())

it('reads campaign encounters from the native query endpoint', async () => {
  const convex = client()
  const query = vi.spyOn(convex, 'query').mockResolvedValue([])
  const queryClient = new QueryClient()

  await expect(queryClient.fetchQuery(getCampaignEncounters(campaignId, convex))).resolves.toEqual(
    []
  )
  expect(getFunctionName(query.mock.calls[0]![0])).toBe(
    getFunctionName(convexApi.encounters.projectionReads.list)
  )
  expect(query.mock.calls[0]![1]).toEqual({ campaignId })
})

it('loads all Blueprint pages, including an empty continuation page', async () => {
  const convex = client()
  const query = vi.spyOn(convex, 'query').mockImplementation(async (...[, input]) => {
    const cursor = encounterBlueprintListInputSchema.parse(input).paginationOpts.cursor
    if (cursor === null) return { page: [], isDone: false, continueCursor: 'next' }
    return { page: [blueprint], isDone: true, continueCursor: '' }
  })
  const queryClient = new QueryClient()

  await expect(
    queryClient.fetchQuery(getEncounterBlueprints(gameSystemId, convex))
  ).resolves.toEqual([blueprint])
  expect(query).toHaveBeenCalledTimes(2)
  expect(query.mock.calls.map(([, input]) => input)).toEqual([
    { gameSystemId, paginationOpts: { cursor: null, numItems: 48 } },
    { gameSystemId, paginationOpts: { cursor: 'next', numItems: 48 } }
  ])
})

it('rejects a nonadvancing Blueprint cursor', async () => {
  const convex = client()
  vi.spyOn(convex, 'query').mockResolvedValue({
    page: [],
    isDone: false,
    continueCursor: 'same'
  })
  const queryClient = new QueryClient()

  await expect(
    queryClient.fetchQuery(getEncounterBlueprints(gameSystemId, convex))
  ).rejects.toThrow('Encounter Blueprint pagination did not advance.')
})
