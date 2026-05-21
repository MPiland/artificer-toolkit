import { describe, expect, it } from 'vitest'
import { getRouter } from '#app/router'

describe('spell routes', () => {
  it('matches the frozen detail index child for direct spell URLs', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/spells/sp_2gosc6qe4g0/acid-arrow')

    expect(matches.map((match) => match.routeId)).toEqual(
      expect.arrayContaining([
        '/_authed/spells/$spellPublicId',
        '/_authed/spells/$spellPublicId/$spellSlug',
        '/_authed/spells/$spellPublicId/$spellSlug/'
      ])
    )
    expect(matches.at(-1)?.routeId).toBe('/_authed/spells/$spellPublicId/$spellSlug/')
  })

  it('matches the edit route as nested child content', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/spells/sp_2gosc6qe4g0/acid-arrow/edit')

    expect(matches.map((match) => match.routeId)).toEqual(
      expect.arrayContaining([
        '/_authed/spells/$spellPublicId',
        '/_authed/spells/$spellPublicId/$spellSlug',
        '/_authed/spells/$spellPublicId/$spellSlug/edit'
      ])
    )
    expect(matches.at(-1)?.routeId).toBe('/_authed/spells/$spellPublicId/$spellSlug/edit')
  })

  it('matches legacy UUID spell URLs through the same handle route', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/spells/00000000-0000-0000-0020-000100000000')

    expect(matches.at(-1)?.routeId).toBe('/_authed/spells/$spellPublicId')
  })
})
