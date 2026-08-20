import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { SpellAuthoringInputDto } from '@artificer-toolkit/schema/subjects/spell'
import { ApiError, createServerApi } from './api'
import { server } from '#test/msw/server'

const spellItem = {
  id: 'magic-missile',
  publicId: '1',
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
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

const spellListResponse = {
  drafts: [],
  items: [spellItem],
  meta: {},
  page: { nextCursor: null, previousCursor: null, totalCount: 1 },
  summary: { activeCount: 1, masterCount: 1, ownedCount: 0 }
}

const spellDetail = {
  publicId: '2',
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  draft: null,
  item: {
    kind: 'SPELL',
    id: 'copy-spell',
    label: 'Magic Missile Copy',
    status: 'ACTIVE',
    description: 'Force darts that strike unerringly.',
    castingTime: {
      unit: 'ROUND',
      amount: 1
    },
    level: 1,
    classIds: ['wizard'],
    magicSchoolId: 'evocation',
    userId: 'test-user',
    systemId: 'dnd5e-2014'
  },
  provenance: {
    kind: 'OWNED',
    ownerUserId: 'test-user'
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

const spellDraft = {
  id: 'draft-1',
  subjectKind: 'SPELL',
  subjectId: 'copy-spell',
  publicId: '2',
  userId: 'test-user',
  systemId: 'dnd5e-2014',
  label: 'Magic Missile Copy',
  status: 'DRAFT',
  draftState: 'DRAFT_ONLY',
  baseActiveUpdatedAt: null,
  payload: {
    ...spellDetail.item,
    status: 'DRAFT'
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

const spellInput = {
  kind: 'SPELL',
  id: 'copy-spell',
  label: 'Magic Missile Copy',
  description: 'Force darts that strike unerringly.',
  castingTime: {
    unit: 'ROUND',
    amount: 1
  },
  level: 1,
  classIds: ['wizard'],
  magicSchoolId: 'evocation',
  systemId: 'dnd5e-2014'
} satisfies SpellAuthoringInputDto

function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

function readBatchedInput<TInput>(body: unknown): TInput {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return (body as { 0: TInput })[0]
}

function expectNoSerializedAuth(request: Request) {
  expect(request.headers.get('authorization')).toBeNull()
  expect(request.headers.get('x-artificer-trpc')).toBe('1')
  expect(request.url).not.toContain('test-token')
  expect(request.url).not.toContain('Bearer')
  expect(request.url).not.toContain('Authorization')
}

describe('tRPC api adapter', () => {
  it('uses the same-origin tRPC endpoint without serializing bearer auth', async () => {
    expect.assertions(7)
    server.use(
      http.get('*/api/trpc/content.spells.list', ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/trpc/content.spells.list')
        expectNoSerializedAuth(request)
        return trpcJson(spellListResponse)
      })
    )

    const response = await createServerApi().content.spells.list({
      direction: 'FORWARD',
      limit: 48,
      sort: 'name'
    })

    expect(response.items[0]?.permissions.canCopy).toBe(true)
  })

  it('keeps concurrent server API calls on request-isolated batch clients', async () => {
    let requestCount = 0
    server.use(
      http.get('*/api/trpc/content.spells.list', () => {
        requestCount += 1
        return trpcJson(spellListResponse)
      })
    )

    await Promise.all([
      createServerApi().content.spells.list({ direction: 'FORWARD', limit: 48, sort: 'name' }),
      createServerApi().content.spells.list({ direction: 'FORWARD', limit: 48, sort: 'name' })
    ])

    expect(requestCount).toBe(2)
  })

  it('routes authored duplication through the tRPC procedure', async () => {
    expect.assertions(7)
    server.use(
      http.post('*/api/trpc/content.spells.duplicate', async ({ request }) => {
        expectNoSerializedAuth(request)
        const body = await request.json()
        expect(readBatchedInput<{ id: string }>(body).id).toBe('magic-missile')
        return trpcJson(spellDraft)
      })
    )

    const response = await createServerApi().content.spells.duplicate('magic-missile')

    expect(response?.payload.label).toBe('Magic Missile Copy')
  })

  it('activates a stored authored draft through the tRPC draft procedure', async () => {
    expect.assertions(7)
    server.use(
      http.post('*/api/trpc/content.spells.activateDraft', async ({ request }) => {
        expectNoSerializedAuth(request)
        const body = await request.json()
        expect(readBatchedInput<{ id: string }>(body).id).toBe('copy-spell')
        return trpcJson(spellDetail)
      })
    )

    const response = await createServerApi().content.spells.activateDraft('copy-spell')

    if (!response) {
      throw new Error('Expected activate draft response.')
    }
    if (!response.item) {
      throw new Error('Expected activated spell item.')
    }

    expect(response.item.label).toBe('Magic Missile Copy')
  })

  it('normalizes successful discard responses to undefined', async () => {
    expect.assertions(7)
    server.use(
      http.post('*/api/trpc/characters.discardDraft', async ({ request }) => {
        expectNoSerializedAuth(request)
        const body = await request.json()
        expect(readBatchedInput<{ id: string }>(body).id).toBe('character-1')
        return trpcJson({ ok: true })
      })
    )

    await expect(createServerApi().characters.discardDraft('character-1')).resolves.toBeUndefined()
  })

  it('resolves node runtime models through the tRPC adapter', async () => {
    expect.assertions(9)
    server.use(
      http.post('*/api/trpc/nodeRuntime.resolve', async ({ request }) => {
        expectNoSerializedAuth(request)
        expect(readBatchedInput<{ mapId: string }>(await request.json()).mapId).toBe('spell')
        return trpcJson({
          mapId: 'spell',
          clearPaths: [],
          scopes: [],
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
                    {
                      id: 'magicSchoolId',
                      path: ['magicSchoolId'],
                      label: 'Magic School',
                      kind: 'INPUT',
                      type: 'SELECT_SINGLE',
                      visible: true,
                      required: false,
                      hiddenBehavior: 'KEEP',
                      clearPaths: [],
                      options: [{ value: 'evocation', label: 'Evocation' }],
                      authoring: { exposure: 'author' }
                    }
                  ]
                }
              ]
            }
          ]
        })
      })
    )

    const response = await createServerApi().nodeRuntime.resolve({
      mapId: 'spell',
      systemId: 'system-1',
      values: {}
    })

    const node = response.steps[0]?.sections[0]?.nodes[0]
    expect(node?.kind).toBe('INPUT')
    if (!node || node.kind !== 'INPUT') {
      throw new Error('Expected the mocked runtime node to be an input.')
    }
    expect(node.type).toBe('SELECT_SINGLE')
    if (node.type !== 'SELECT_SINGLE') {
      throw new Error('Expected the mocked runtime node to be a single select.')
    }
    expect(node.options[0]?.value).toBe('evocation')
  })

  it('retains authored validation issues on API errors', async () => {
    server.use(
      http.post('*/api/trpc/content.spells.saveDraft', () =>
        HttpResponse.json(
          [
            {
              error: {
                code: -32600,
                message: 'Validation failed',
                data: {
                  code: 'BAD_REQUEST',
                  httpStatus: 400,
                  path: 'content.spells.saveDraft',
                  validationIssues: [
                    {
                      code: 'invalid_type',
                      message: 'Expected a string',
                      path: ['classIds', 1]
                    }
                  ]
                }
              }
            }
          ],
          { status: 400 }
        )
      )
    )

    let caught: unknown
    try {
      await createServerApi().content.spells.saveDraft(spellInput)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ApiError)
    expect(caught).toMatchObject({
      status: 400,
      validationIssues: [
        {
          code: 'invalid_type',
          message: 'Expected a string',
          path: ['classIds', 1]
        }
      ]
    })
  })
})
