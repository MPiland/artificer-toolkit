import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createServerApi } from './api'
import { server } from '#test/msw/server'

const spellItem = {
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

const spellDetail = {
  publicId: '2',
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
  payload: {
    ...spellDetail.item,
    status: 'DRAFT'
  },
  baseActiveUpdatedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
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
        return trpcJson({ items: [spellItem], meta: {}, drafts: [] })
      })
    )

    const response = await createServerApi().content.spells.list()

    expect(response.items[0]?.permissions.canCopy).toBe(true)
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
    expect.assertions(7)
    server.use(
      http.post('*/api/trpc/nodeRuntime.resolve', async ({ request }) => {
        expectNoSerializedAuth(request)
        expect(readBatchedInput<{ mapId: string }>(await request.json()).mapId).toBe('spell')
        return trpcJson({
          mapId: 'spell',
          clearPaths: [],
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
                      clearPaths: [],
                      options: [{ value: 'evocation', label: 'Evocation' }]
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
      values: {}
    })

    expect(response.steps[0]?.sections[0]?.nodes[0]?.options?.[0]?.value).toBe('evocation')
  })
})
