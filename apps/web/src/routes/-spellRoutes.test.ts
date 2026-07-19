import { describe, it } from 'vitest'
import { expectRouteTreeToDeclare } from './-routeTreeSource.testUtils'

describe('spell routes', () => {
  it('declares the frozen detail index child for direct spell URLs', () => {
    expectRouteTreeToDeclare([
      '/_authed/spells/$spellPublicId',
      '/_authed/spells/$spellPublicId/$spellSlug',
      '/_authed/spells/$spellPublicId/$spellSlug/'
    ])
  })

  it('declares the edit route as nested child content', () => {
    expectRouteTreeToDeclare([
      '/_authed/spells/$spellPublicId',
      '/_authed/spells/$spellPublicId/$spellSlug',
      '/_authed/spells/$spellPublicId/$spellSlug/edit'
    ])
  })

  it('declares the legacy UUID spell handle route', () => {
    expectRouteTreeToDeclare(['/_authed/spells/$spellPublicId'])
  })
})
