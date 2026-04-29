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

  it('duplicates an authored detail as a new draft copy', async () => {
    expect.assertions(4)
    server.use(
      http.get(`${API_BASE}/content/spells/magic-missile`, () => HttpResponse.json(spellDetail)),
      http.post(`${API_BASE}/content/spells`, async ({ request }) => {
        const body = await request.json() as { id: string, label: string, status: string }
        expect(body.id).not.toBe('magic-missile')
        expect(body.label).toBe('Magic Missile Copy')
        expect(body.status).toBe('DRAFT')
        return HttpResponse.json({ ...spellDetail, item: body })
      })
    )

    const response = await createServerApi('test-token').content.spells.duplicate('magic-missile')

    expect(response?.item.label).toBe('Magic Missile Copy')
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
