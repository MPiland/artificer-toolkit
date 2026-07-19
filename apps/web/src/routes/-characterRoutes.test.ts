import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expectRouteTreeToDeclare } from './-routeTreeSource.testUtils'

const characterSheetRouteSource =
  'src/routes/_authed/characters/$characterPublicId/$characterSlug/index.tsx'

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

  it('populates Sheet cache only under the canonical character identity', () => {
    const source = readFileSync(join(process.cwd(), characterSheetRouteSource), 'utf8')

    expect(source).toContain('routeUsesCanonicalId')
    expect(source).toContain('client.characters.sheet(routeCharacterId)')
    expect(source).toContain('getCharacterSheet(characterId, client).queryKey')
    expect(source).toContain('getCharacterSheet(routeCharacterId, client).queryKey')
  })
})
