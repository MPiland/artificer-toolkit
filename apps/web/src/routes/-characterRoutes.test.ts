import { describe, expect, it } from 'vitest'
import { expectRouteTreeToDeclare } from './-routeTreeSource.testUtils'

describe('character routes', () => {
  it('declares the character list route', () => {
    expectRouteTreeToDeclare(['/_authed/characters/'])
  })

  it('declares the create builder route', () => {
    expectRouteTreeToDeclare(['/_authed/characters/new'])
  })

  it('declares the edit builder route', () => {
    expectRouteTreeToDeclare(['/_authed/characters/$characterPublicId/$characterSlug/edit'])
  })

  it('declares the character sheet route for direct character URLs', () => {
    expectRouteTreeToDeclare(['/_authed/characters/$characterPublicId/$characterSlug/'])
  })

  it('declares the legacy UUID character handle route', () => {
    expectRouteTreeToDeclare(['/_authed/characters/$characterPublicId'])
  })
})
