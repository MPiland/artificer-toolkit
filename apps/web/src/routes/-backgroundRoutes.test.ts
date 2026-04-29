import { describe, expect, it } from 'vitest'
import { getRouter } from '#app/router'

describe('background routes', () => {
  it('matches the view route through the background detail index child', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/backgrounds/test-background')

    expect(matches.map((match) => match.routeId)).toEqual(
      expect.arrayContaining(['/_authed/backgrounds/$backgroundId', '/_authed/backgrounds/$backgroundId/'])
    )
    expect(matches.at(-1)?.routeId).toBe('/_authed/backgrounds/$backgroundId/')
  })

  it('matches the edit route as nested child content', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/backgrounds/test-background/edit')

    expect(matches.map((match) => match.routeId)).toEqual(
      expect.arrayContaining(['/_authed/backgrounds/$backgroundId', '/_authed/backgrounds/$backgroundId/edit'])
    )
    expect(matches.at(-1)?.routeId).toBe('/_authed/backgrounds/$backgroundId/edit')
  })
})
