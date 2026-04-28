import { http, HttpResponse } from 'msw'

const API_BASE = 'http://localhost:3001'

export const handlers = [
  http.get(`${API_BASE}/systems`, () => HttpResponse.json([
    {
      id: 'dnd5e-2014',
      label: 'D&D 5e (2014)'
    }
  ])),
  http.get(`${API_BASE}/content/spells`, () => HttpResponse.json({
    items: [
      {
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
    ],
    meta: {}
  }))
]
