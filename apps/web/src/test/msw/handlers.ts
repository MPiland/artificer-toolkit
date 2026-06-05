import { http, HttpResponse } from 'msw'
import type { NodeRuntimeResolveRequestDto, NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { RaceAuthoringInputDto } from '@artificer-toolkit/schema/subjects/race'
import {
  ownedBaseRaceFixture,
  ownedBaseRaceResponseFixture,
  raceListResponseFixture,
  raceRuntimeFixture
} from '#domains/races/race.fixtures'

export const handlers = [
  http.get('*/api/trpc/systems.list', () => trpcJson([
    {
      id: 'dnd5e-2014',
      label: 'D&D 5e (2014)'
    }
  ])),
  http.get('*/api/trpc/content.spells.list', () => trpcJson({
    items: [
      {
        id: 'magic-missile',
        publicId: '1',
        label: 'Magic Missile',
        description: 'Force darts that strike unerringly.',
        status: 'ACTIVE',
        userId: 'master',
        systemId: 'dnd5e-2014',
        level: 1,
        magicSchoolId: 'Evocation',
        castingTimeUnit: 'ACTION',
        castingTimeAmount: 1,
        provenance: {
          kind: 'MASTER',
          ownerUserId: null
        },
        permissions: {
          canView: true,
          canEdit: false,
          canCopy: true,
          canDelete: false
        }
      }
    ],
    drafts: [],
    meta: {}
  })),
  http.get('*/api/trpc/content.races.list', () => trpcJson(raceListResponseFixture)),
  http.get('*/api/trpc/content.races.get', () => trpcJson(ownedBaseRaceResponseFixture)),
  http.get('*/api/trpc/content.races.getDraft', () => trpcJson(null)),
  http.post('*/api/trpc/content.races.saveDraft', async ({ request }) => {
    const race = readBatchedInput<RaceAuthoringInputDto>(await request.json())

    return trpcJson(createRaceDraft(race))
  }),
  http.post('*/api/trpc/content.races.activate', () => trpcJson(ownedBaseRaceResponseFixture)),
  http.post('*/api/trpc/content.races.activateDraft', () => trpcJson(ownedBaseRaceResponseFixture)),
  http.post('*/api/trpc/content.races.deleteActive', () => trpcJson({ ok: true })),
  http.post('*/api/trpc/content.races.discardDraft', () => trpcJson({ ok: true })),
  http.post('*/api/trpc/content.races.duplicate', () => trpcJson(createRaceDraft({
    ...ownedBaseRaceFixture,
    id: `${ownedBaseRaceFixture.id}-copy`,
    label: `${ownedBaseRaceFixture.label} Copy`
  }))),
  http.post('*/api/trpc/nodeRuntime.resolve', async ({ request }) => {
    const body = readBatchedInput<NodeRuntimeResolveRequestDto>(await request.json())

    if (body.mapId === 'spell') {
      return trpcJson(buildSpellRuntimeResponse(body))
    }

    if (body.mapId === 'race') {
      return trpcJson(raceRuntimeFixture)
    }

    return trpcJson({
      mapId: body.mapId,
      steps: [],
      clearPaths: []
    } satisfies NodeRuntimeResolveResponseDto)
  })
]

function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

function readBatchedInput<TInput>(body: unknown): TInput {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return (body as { 0: TInput })[0]
}

function createRaceDraft(race: RaceAuthoringInputDto) {
  return {
    subjectKind: 'RACE',
    subjectId: race.id,
    publicId: race.id,
    userId: race.userId ?? 'story-user',
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

function buildSpellRuntimeResponse(body: NodeRuntimeResolveRequestDto): NodeRuntimeResolveResponseDto {
  const components = Array.isArray(body.values.components)
    ? body.values.components.map((value) => String(value))
    : []
  const hasMaterial = components.includes('MATERIAL')

  return {
    mapId: 'spell',
    clearPaths: hasMaterial ? [] : [['materialDescription']],
    steps: [
      {
        id: 'basics',
        label: 'Basics',
        order: 10,
        sections: [
          {
            id: 'basics',
            label: 'Basics',
            order: 10,
            nodes: [
              textNode('label', ['label'], 'Name'),
              numberNode('level', ['level'], 'Level'),
              selectNode('classIds', ['classIds'], 'Classes', 'SELECT_MULTI', [
                { value: 'wizard', label: 'Wizard' },
                { value: 'sorcerer', label: 'Sorcerer' }
              ])
            ]
          }
        ]
      },
      {
        id: 'casting',
        label: 'Casting',
        order: 20,
        sections: [
          {
            id: 'casting',
            label: 'Casting',
            order: 20,
            nodes: [
              selectNode('magicSchoolId', ['magicSchoolId'], 'Magic School', 'SELECT_SINGLE', [
                { value: 'evocation', label: 'Evocation' },
                { value: 'abjuration', label: 'Abjuration' }
              ]),
              selectNode('attributes', ['attributes'], 'Attributes', 'SELECT_MULTI', [
                { value: 'CONCENTRATION', label: 'Concentration' },
                { value: 'RITUAL', label: 'Ritual' },
                { value: 'ADDS_TO_WEAPON_ATTACK', label: 'Adds to weapon attack' }
              ]),
              selectNode('components', ['components'], 'Components', 'SELECT_MULTI', [
                { value: 'VERBAL', label: 'Verbal' },
                { value: 'SOMATIC', label: 'Somatic' },
                { value: 'MATERIAL', label: 'Material' }
              ]),
              {
                ...textNode('materialDescription', ['materialDescription'], 'Material Description'),
                visible: hasMaterial,
                hiddenBehavior: 'CLEAR',
                clearPaths: hasMaterial ? [] : [['materialDescription']]
              }
            ]
          }
        ]
      }
    ]
  }
}

function textNode(
  id: string,
  path: readonly string[],
  label: string
): NodeRuntimeResolveResponseDto['steps'][number]['sections'][number]['nodes'][number] {
  return {
    id,
    path: [...path],
    label,
    kind: 'INPUT',
    type: 'TEXT',
    visible: true,
    required: false,
    clearPaths: []
  }
}

function numberNode(
  id: string,
  path: readonly string[],
  label: string
): NodeRuntimeResolveResponseDto['steps'][number]['sections'][number]['nodes'][number] {
  return {
    id,
    path: [...path],
    label,
    kind: 'INPUT',
    type: 'NUMBER',
    visible: true,
    required: false,
    clearPaths: []
  }
}

function selectNode(
  id: string,
  path: readonly string[],
  label: string,
  type: 'SELECT_SINGLE' | 'SELECT_MULTI',
  options: NonNullable<NodeRuntimeResolveResponseDto['steps'][number]['sections'][number]['nodes'][number]['options']>
): NodeRuntimeResolveResponseDto['steps'][number]['sections'][number]['nodes'][number] {
  return {
    id,
    path: [...path],
    label,
    kind: 'INPUT',
    type,
    visible: true,
    required: false,
    clearPaths: [],
    options
  }
}
