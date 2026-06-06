import { describe, expect, it } from 'vitest'
import { expectRouteTreeToDeclare } from './-routeTreeSource.testUtils'

describe('systems routes', () => {
  it('declares the systems list route', () => {
    expectRouteTreeToDeclare(['/_authed/systems/'])
  })

  it('declares the systems detail route', () => {
    expectRouteTreeToDeclare(['/_authed/systems/$systemId'])
  })
})
