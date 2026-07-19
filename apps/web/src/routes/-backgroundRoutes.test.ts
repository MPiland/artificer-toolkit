import { describe, it } from 'vitest'
import { expectRouteTreeToDeclare } from './-routeTreeSource.testUtils'

describe('background routes', () => {
  it('declares the frozen detail index child for direct background URLs', () => {
    expectRouteTreeToDeclare([
      '/_authed/backgrounds/$backgroundPublicId',
      '/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/'
    ])
  })

  it('declares the edit route as nested child content', () => {
    expectRouteTreeToDeclare([
      '/_authed/backgrounds/$backgroundPublicId',
      '/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
    ])
  })

  it('declares the legacy UUID background handle route', () => {
    expectRouteTreeToDeclare(['/_authed/backgrounds/$backgroundPublicId'])
  })
})
