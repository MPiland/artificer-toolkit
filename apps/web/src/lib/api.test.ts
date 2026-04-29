import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createServerApi } from './api'
import { server } from '#test/msw/server'

const API_BASE = 'http://localhost:3001'

const spellItem = {
  id: 'magic-missile',
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
  item: {
    kind: 'SPELL',
    id: 'magic-missile',
    label: 'Magic Missile',
    status: 'ACTIVE',
    description: 'Force darts that strike unerringly.',
    castingTime: {
      unit: 'ROUND',
      amount: 1
    },
    level: 1,
    classIds: ['wizard'],
    magicSchoolId: 'evocation',
    userId: 'master',
    systemId: 'dnd5e-2014'
  },
  provenance: spellItem.provenance,
  permissions: spellItem.permissions
}

const spellDraft = {
  id: 'draft-1',
  subjectKind: 'SPELL',
  subjectId: 'copy-spell',
  userId: 'test-user',
  systemId: 'dnd5e-2014',
  label: 'Magic Missile Copy',
  status: 'DRAFT',
  draftState: 'DRAFT_ONLY',
  payload: {
    ...spellDetail.item,
    id: 'copy-spell',
    label: 'Magic Missile Copy',
    status: 'DRAFT',
    userId: 'test-user'
  },
  baseActiveUpdatedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('REST api adapter', () => {
  it('attaches bearer auth and parses authored list responses', async () => {
    expect.assertions(2)
    server.use(
      http.get(`${API_BASE}/content/spells`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer test-token')
        return HttpResponse.json({ items: [spellItem], meta: {} })
      })
    )

    const response = await createServerApi('test-token').content.spells.list()

    expect(response.items[0]?.permissions.canCopy).toBe(true)
  })

  it('duplicates an authored detail as a sidecar draft copy', async () => {
    expect.assertions(6)
    server.use(
      http.get(`${API_BASE}/content/spells/magic-missile`, () => HttpResponse.json(spellDetail)),
      http.post(`${API_BASE}/content/spells/draft`, async ({ request }) => {
        const body = await request.json() as {
          subjectKind: string
          subjectId: string
          label: string
          payload: { id: string, label: string, status: string }
        }
        expect(body.subjectKind).toBe('SPELL')
        expect(body.subjectId).not.toBe('magic-missile')
        expect(body.label).toBe('Magic Missile Copy')
        expect(body.payload.id).toBe(body.subjectId)
        expect(body.payload.status).toBe('DRAFT')
        return HttpResponse.json({
          ...spellDraft,
          subjectId: body.subjectId,
          payload: body.payload
        })
      })
    )

    const response = await createServerApi('test-token').content.spells.duplicate('magic-missile')

    expect(response?.payload.label).toBe('Magic Missile Copy')
  })

  it('activates a stored authored draft through the draft endpoint', async () => {
    expect.assertions(2)
    server.use(
      http.post(`${API_BASE}/content/spells/copy-spell/draft/activate`, async ({ request }) => {
        const body = await request.json() as { subjectKind: string, subjectId: string }
        expect(body).toEqual({ subjectKind: 'SPELL', subjectId: 'copy-spell' })
        return HttpResponse.json({
          ...spellDetail,
          item: {
            ...spellDetail.item,
            id: 'copy-spell',
            label: 'Magic Missile Copy',
            status: 'ACTIVE',
            userId: 'test-user'
          }
        })
      })
    )

    const response = await createServerApi('test-token').content.spells.activateDraft('copy-spell')

    expect(response.item.label).toBe('Magic Missile Copy')
  })

  it('resolves node runtime models through the REST adapter', async () => {
    expect.assertions(3)
    server.use(
      http.post(`${API_BASE}/node-runtime/resolve`, async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer test-token')
        const body = await request.json() as { mapId: string }
        expect(body.mapId).toBe('spell')
        return HttpResponse.json({
          mapId: 'spell',
          clearPaths: [],
          sections: [{
            id: 'basics',
            label: 'Basics',
            order: 10,
            nodes: [{
              id: 'magicSchoolId',
              path: ['magicSchoolId'],
              label: 'Magic School',
              kind: 'INPUT',
              type: 'SELECT_SINGLE',
              visible: true,
              required: false,
              clearPaths: [],
              options: [{ value: 'evocation', label: 'Evocation' }]
            }]
          }]
        })
      })
    )

    const response = await createServerApi('test-token').nodeRuntime.resolve({
      mapId: 'spell',
      values: {}
    })

    expect(response.sections[0]?.nodes[0]?.options?.[0]?.value).toBe('evocation')
  })
})
