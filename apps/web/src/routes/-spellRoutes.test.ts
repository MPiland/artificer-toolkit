import { describe, expect, it } from 'vitest'
import { getRouter } from '#app/router'

describe('spell routes', () => {
  it('matches the view route through the spell detail index child', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/spells/test-spell')

    expect(matches.map((match) => match.routeId)).toEqual(
      expect.arrayContaining(['/_authed/spells/$spellId', '/_authed/spells/$spellId/'])
    )
    expect(matches.at(-1)?.routeId).toBe('/_authed/spells/$spellId/')
  })

  it('matches the edit route as nested child content', () => {
    const router = getRouter(null)
    const matches = router.matchRoutes('/spells/test-spell/edit')

    expect(matches.map((match) => match.routeId)).toEqual(
      expect.arrayContaining(['/_authed/spells/$spellId', '/_authed/spells/$spellId/edit'])
    )
    expect(matches.at(-1)?.routeId).toBe('/_authed/spells/$spellId/edit')
  })
})
