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
    const matches = router.matchRoutes('/characters/ch_2gosc6qe4g0/astra-vale/edit')

    expect(matches.at(-1)?.routeId).toBe('/_authed/characters/$characterPublicId/$characterSlug/edit')
  })

  it('matches the character sheet route for direct character URLs', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/characters/ch_2gosc6qe4g0/astra-vale')

    expect(matches.at(-1)?.routeId).toBe('/_authed/characters/$characterPublicId/$characterSlug/')
  })

  it('matches legacy UUID character URLs through the same handle route', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/characters/00000000-0000-0000-0020-000100000000')

    expect(matches.at(-1)?.routeId).toBe('/_authed/characters/$characterPublicId')
  })
})
