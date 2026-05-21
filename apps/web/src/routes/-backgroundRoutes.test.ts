import { describe, expect, it } from 'vitest'
import { getRouter } from '#app/router'

describe('background routes', () => {
  it('matches the frozen detail index child for direct background URLs', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/backgrounds/bg_2gosc6qe4g0/haunted-one')

    expect(matches.map((match) => match.routeId)).toEqual(
      expect.arrayContaining([
        '/_authed/backgrounds/$backgroundPublicId',
        '/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/'
      ])
    )
    expect(matches.at(-1)?.routeId).toBe('/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/')
  })

  it('matches the edit route as nested child content', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/backgrounds/bg_2gosc6qe4g0/haunted-one/edit')

    expect(matches.map((match) => match.routeId)).toEqual(
      expect.arrayContaining([
        '/_authed/backgrounds/$backgroundPublicId',
        '/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
      ])
    )
    expect(matches.at(-1)?.routeId).toBe('/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit')
  })

  it('matches legacy UUID background URLs through the same handle route', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/backgrounds/00000000-0000-0000-0020-000100000000')

    expect(matches.at(-1)?.routeId).toBe('/_authed/backgrounds/$backgroundPublicId')
  })
})
