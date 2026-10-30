import { Suspense } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouterState } from '@tanstack/react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { authoredCatalogueItemSchema } from '@artificer-toolkit/schema/api/authoredCatalogue'
import {
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeResolveRequestDtoSchema
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { compactNodeRuntimeResponse } from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import { RaceCataloguePage } from '#domains/races/pages/RaceCataloguePage'
import {
  authoredCreateRouteLoaderData,
  authoredRouteStoryDrafts,
  authoredRouteStoryResponses,
  createEditLoaderData
} from '#domains/authoredRouteStory.fixtures'
import { masterRaceFixture, raceListResponseFixture } from '#domains/races/race.fixtures'
import { RaceDetailPage } from '#domains/races/pages/RaceDetailPage'
import {
  normalizeFixtureNodeRuntimeValues,
  resolveFixtureNodeRuntime
} from '#test/nodeRuntimeResolver'
import { warmFixtureAuthoredSources } from '@artificer-toolkit/authoring/tests/srdSourceReader'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { AuthoringLayout } from '../layout/AuthoringLayout'

const convexMocks = vi.hoisted(() => ({
  loadMore: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
  usePaginatedQuery: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useAction: () => vi.fn(),
  useConvex: () => convexMocks,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted', loadMore: vi.fn() }),
  useQuery: (_reference: unknown, args: unknown) => {
    if (args === 'skip') return undefined
    if (typeof args === 'object' && args !== null && 'type' in args) {
      return { assetId: null, revision: 0 }
    }
    throw new Error('Unexpected active Convex query in GuidedEntryJourneys.')
  }
}))

const contentCatalogueMock = vi.hoisted(() => vi.fn())

vi.mock('#app/data/contentSnapshots/useContentCatalogue', () => ({
  useContentCatalogue: contentCatalogueMock
}))

vi.mock('convex-helpers/react', () => ({
  usePaginatedQuery: convexMocks.usePaginatedQuery
}))

vi.mock('#app/query/createAppQueryClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/query/createAppQueryClient')>()
  return {
    ...actual,
    createAppQueryClient: () => {
      const client = actual.createAppQueryClient()
      client.setQueryDefaults(['convexQuery'], {
        queryFn: async () => {
          throw new Error('Unexpected active Convex query in GuidedEntryJourneys.')
        }
      })
      client.setQueryDefaults(['convexQuery', getFunctionName(api.media.assets.avatar)], {
        queryFn: async () => null
      })
      client.setQueryDefaults(['convexQuery', getFunctionName(api.authoring.nodeRuntime.resolve)], {
        queryFn: async ({ queryKey }) =>
          compactNodeRuntimeResponse(
            await resolveFixtureNodeRuntime(nodeRuntimeResolveRequestDtoSchema.parse(queryKey[2]))
          )
      })
      return client
    }
  }
})

const ownedDraftLoaderData = createEditLoaderData('race', 'ownedDraft')
const ownedDraft = ownedDraftLoaderData.authoringData.draft

if (!ownedDraft) throw new Error('Expected the race journey fixture to include a draft.')

const copiedRaceAuthoringData = {
  ...ownedDraftLoaderData.authoringData,
  response: null,
  draft: {
    ...ownedDraft,
    baseActiveUpdatedAt: null,
    draftState: 'DRAFT_ONLY' as const
  }
}
const ownedResponse = { ...authoredRouteStoryResponses.race, draft: null, hasDraft: false }
const ownedRace = ownedResponse.item!

beforeAll(warmFixtureAuthoredSources, 60_000)

beforeEach(() => {
  convexMocks.loadMore.mockClear()
  convexMocks.mutation.mockClear()
  convexMocks.query.mockReset().mockImplementation(resolveNormalization)
  convexMocks.usePaginatedQuery.mockClear()
  contentCatalogueMock.mockReturnValue({
    items: raceListResponseFixture.items.map((item) =>
      authoredCatalogueItemSchema.parse({
        id: item.id,
        publicId: item.publicId,
        systemId: item.systemId,
        label: item.label,
        description: item.description,
        category: item.category,
        provenance: item.provenance,
        permissions: item.permissions
      })
    ),
    summary: { activeCount: 1, masterCount: 1, ownedCount: 0, categories: ['BASE'] },
    updating: false,
    isPending: false,
    isError: false
  })
  convexMocks.mutation.mockResolvedValue(authoredRouteStoryDrafts.race)
  convexMocks.usePaginatedQuery.mockReturnValue({
    isLoading: false,
    loadMore: convexMocks.loadMore,
    results: [],
    status: 'Exhausted'
  })
})

function resolveNormalization(reference: Parameters<typeof getFunctionName>[0], input: unknown) {
  if (getFunctionName(reference) !== getFunctionName(api.authoring.nodeRuntime.normalizeValues)) {
    throw new Error('Expected native node-runtime normalization.')
  }
  return normalizeFixtureNodeRuntimeValues(nodeRuntimeNormalizeValuesRequestDtoSchema.parse(input))
}

function GuidedRaceDestination() {
  return <AuthoringLayout data={copiedRaceAuthoringData} domain='race' mode='edit' />
}

function CatalogueJourney() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (pathname === '/races/new') {
    return (
      <AuthoringLayout
        data={authoredCreateRouteLoaderData.authoringData}
        domain='race'
        mode='create'
      />
    )
  }

  if (pathname.endsWith('/edit')) return <GuidedRaceDestination />

  return (
    <Suspense fallback={<span>Loading races…</span>}>
      <RaceCataloguePage />
    </Suspense>
  )
}

function DetailJourney() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (pathname.endsWith('/edit')) return <GuidedRaceDestination />

  return (
    <RaceDetailPage draft={null} raceId={ownedRace.id} response={ownedResponse} view='active' />
  )
}

describe('Guided authored entry journeys', () => {
  it('opens the starting-point choice from catalogue Create', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/races'>
        <CatalogueJourney />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('button', { name: 'Create Race' }))

    expect(await screen.findByRole('heading', { name: 'How do you want to begin?' })).toHaveFocus()
  })

  it('opens Guided Basics after copying from the catalogue', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/races'>
        <CatalogueJourney />
      </TestRouterProvider>
    )

    const [elfRow] = await screen.findAllByRole('row', { name: /Elf/ })
    if (!elfRow) throw new Error('Expected the race catalogue to include Elf.')
    await user.click(within(elfRow).getByRole('button', { name: /Duplicate/i }))

    expect(convexMocks.mutation).toHaveBeenCalledOnce()
    expect(convexMocks.mutation).toHaveBeenCalledWith(expect.anything(), {
      subjectKind: 'RACE',
      subjectId: masterRaceFixture.id
    })

    expect(await screen.findByRole('heading', { name: 'Start with the basics' })).toHaveFocus()
    expect(
      screen.queryByRole('heading', { name: 'How do you want to begin?' })
    ).not.toBeInTheDocument()
  })

  it('opens Guided Basics after copying from an item detail page', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/races/dragonborn/dragonborn'>
        <DetailJourney />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('button', { name: 'Duplicate' }))

    expect(convexMocks.mutation).toHaveBeenCalledOnce()
    expect(convexMocks.mutation).toHaveBeenCalledWith(expect.anything(), {
      subjectKind: 'RACE',
      subjectId: ownedRace.id
    })

    expect(await screen.findByRole('heading', { name: 'Start with the basics' })).toHaveFocus()
    expect(
      screen.queryByRole('heading', { name: 'How do you want to begin?' })
    ).not.toBeInTheDocument()
  })
})
