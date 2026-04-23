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
    items: [],
    meta: {}
  }))
]
