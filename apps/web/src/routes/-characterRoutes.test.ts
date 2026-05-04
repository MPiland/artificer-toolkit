import { describe, expect, it } from 'vitest'
import { getRouter } from '#app/router'

describe('character routes', () => {
  it('matches the character list route', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/characters')

    expect(matches.at(-1)?.routeId).toBe('/_authed/characters/')
  })

  it('matches the create builder route', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/characters/new')

    expect(matches.at(-1)?.routeId).toBe('/_authed/characters/new')
  })

  it('matches the edit builder route', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/characters/test-character/edit')

    expect(matches.at(-1)?.routeId).toBe('/_authed/characters/$characterId/edit')
  })

  it('matches the placeholder sheet route for direct character URLs', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/characters/test-character')

    expect(matches.at(-1)?.routeId).toBe('/_authed/characters/$characterId/')
  })
})
