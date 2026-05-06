import { describe, expect, it } from 'vitest'
import { getRouter } from '#app/router'

describe('systems routes', () => {
  it('matches the systems list route', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/systems')

    expect(matches.at(-1)?.routeId).toBe('/_authed/systems/')
  })

  it('matches the systems detail route', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/systems/dnd5e-2014')

    expect(matches.at(-1)?.routeId).toBe('/_authed/systems/$systemId')
  })
})
