import type { User } from '@supabase/supabase-js'
import { http, HttpResponse, type RequestHandler } from 'msw'
import type {
  AuthoredDraftDto,
  RaceResponseDto
} from '@artificer-toolkit/schema/api/content'
import type { RaceAuthoringInputDto } from '@artificer-toolkit/schema/subjects/race'
import {
  masterRaceResponseFixture,
  ownedBaseRaceFixture,
  ownedBaseRaceResponseFixture
} from '../race.fixtures'

type RaceRouteView = 'active' | 'draft'

export interface RaceRouteStoryScenario {
  draft: AuthoredDraftDto | null
  label: string
  params: {
    racePublicId: string
    raceSlug: string
  }
  response: RaceResponseDto
  saveHandlers?: RequestHandler[]
  view: RaceRouteView
}

export const raceStoryUser = {
  id: 'story-user',
  email: 'piland.mark@gmail.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-04-01T12:00:00.000Z'
} as User

const routeParams = {
  racePublicId: 'dragonborn',
  raceSlug: 'dragonborn'
}

const longDescription = [
  ownedBaseRaceFixture.description,
  'Their clans preserve ancestral rites, battlefield oaths, and draconic traditions that shape how each lineage understands duty.',
  'Some dragonborn bind those customs into formal houses while others carry them through wandering companies, mercenary orders, or temple schools.'
].join(' ')

export const authenticatedDraftEditScenario: RaceRouteStoryScenario = {
  label: 'Dragonborn',
  params: routeParams,
  response: ownedBaseRaceResponseFixture,
  draft: createRaceDraft({
    ...ownedBaseRaceFixture,
    label: 'Dragonborn Copy',
    status: 'DRAFT'
  }),
  view: 'draft'
}

export const activeLockedScenario: RaceRouteStoryScenario = {
  label: 'Elf',
  params: {
    racePublicId: 'elf',
    raceSlug: 'elf'
  },
  response: masterRaceResponseFixture,
  draft: null,
  view: 'active'
}

export const draftSaveSuccessScenario: RaceRouteStoryScenario = {
  ...authenticatedDraftEditScenario,
  saveHandlers: [
    http.post('*/api/trpc/content.races.saveDraft', async ({ request }) => {
      const race = readBatchedInput<RaceAuthoringInputDto>(await request.json())

      return trpcJson(createRaceDraft(race))
    })
  ]
}

export const draftSaveFailureScenario: RaceRouteStoryScenario = {
  ...authenticatedDraftEditScenario,
  saveHandlers: [
    http.post('*/api/trpc/content.races.saveDraft', () => HttpResponse.json([{
      error: {
        message: 'Could not save that draft yet.',
        code: -32603,
        data: {
          code: 'INTERNAL_SERVER_ERROR',
          httpStatus: 500
        }
      }
    }], { status: 500 }))
  ]
}

export const invalidDraftRecoveryScenario: RaceRouteStoryScenario = {
  label: 'Dragonborn',
  params: routeParams,
  response: ownedBaseRaceResponseFixture,
  draft: {
    ...createRaceDraft(ownedBaseRaceFixture),
    payload: {
      id: ownedBaseRaceFixture.id,
      label: ownedBaseRaceFixture.label,
      category: 'BROKEN'
    }
  },
  view: 'draft'
}

export const longEdgeContentScenario: RaceRouteStoryScenario = {
  label: 'Dragonborn Copy',
  params: routeParams,
  response: {
    ...ownedBaseRaceResponseFixture,
    item: {
      ...ownedBaseRaceFixture,
      label: 'Dragonborn Copy With Ceremonial Clan Titles',
      quote: 'The forge remembers every oath, every scale, and every spark that shaped the first breath.',
      description: longDescription
    }
  },
  draft: createRaceDraft({
    ...ownedBaseRaceFixture,
    label: 'Dragonborn Copy With Ceremonial Clan Titles',
    quote: 'The forge remembers every oath, every scale, and every spark that shaped the first breath.',
    description: longDescription,
    status: 'DRAFT'
  }),
  view: 'draft'
}

export function createRaceLoaderData(scenario: RaceRouteStoryScenario) {
  return {
    breadcrumbLabel: scenario.label,
    draft: scenario.draft,
    parentResponse: null,
    raceId: scenario.response?.item?.id ?? scenario.draft?.subjectId ?? routeParams.racePublicId,
    references: {
      heritages: [
        { value: 'draconic', label: 'Draconic' },
        { value: 'elven', label: 'Elven' }
      ],
      races: [
        { value: 'dragonborn', label: 'Dragonborn' },
        { value: 'elf', label: 'Elf' }
      ],
      speeds: [
        { value: 'walk', label: 'Walking' }
      ]
    },
    response: scenario.response,
    view: scenario.view
  }
}

export function raceStoryHandlers(scenario: RaceRouteStoryScenario) {
  return scenario.saveHandlers ?? []
}

function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

function readBatchedInput<TInput>(body: unknown): TInput {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return (body as { 0: TInput })[0]
}

function createRaceDraft(race: RaceAuthoringInputDto): AuthoredDraftDto {
  return {
    subjectKind: 'RACE',
    subjectId: race.id,
    publicId: race.id,
    userId: race.userId ?? raceStoryUser.id,
    systemId: race.systemId,
    label: race.label,
    description: race.description,
    status: 'DRAFT',
    category: race.category,
    draftState: 'ACTIVE_WITH_DRAFT',
    baseActiveUpdatedAt: null,
    createdAt: '2024-04-01T12:00:00.000Z',
    updatedAt: '2024-04-01T12:00:00.000Z',
    id: `${race.id}-draft`,
    payload: race
  }
}
