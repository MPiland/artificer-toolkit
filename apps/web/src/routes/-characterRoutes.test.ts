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

  it('keeps the create loader read-only and defers draft opening to the mounted client', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/routes/_authed/characters/new.tsx'),
      'utf8'
    )
    expect(source).toContain('loadSystemList(context.queryClient)')
    expect(source).not.toContain('createServerApi')
    expect(source).not.toContain('randomUUID')
    expect(source).not.toContain('.mutation(')
    expect(source).not.toContain('characters.resolve')
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

  it('loads common Sheet facts and requests a draft only when the active Sheet is unavailable', () => {
    const source = readFileSync(join(process.cwd(), characterSheetRouteSource), 'utf8')

    expect(source).toMatch(
      /ensureQueryData\(\s*getCharacterSheetSlice\(routeCharacterId, 'COMMON'\)/
    )
    expect(source).toContain('ensureQueryData(getCharacterDraft(routeCharacterId))')
    expect(source).toContain('const draft = response')
    expect(source).toContain('? null')
    expect(source).not.toContain('Promise.all')
    expect(source).not.toContain('createServerApi')
    expect(source).not.toContain('setQueryData')
    expect(source).not.toContain('removeQueries')
  })

  it('loads the draft and the active Character without resolving the Builder on the server', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/routes/_authed/characters/$characterPublicId/$characterSlug/edit.tsx'
      ),
      'utf8'
    )

    expect(source).toContain(
      'ensureQueryData(getCharacterBuilderActiveCharacter(routeCharacterId))'
    )
    expect(source).toContain('ensureQueryData(getCharacterDraft(routeCharacterId))')
    expect(source).not.toContain('builder.get')
    expect(source).not.toContain('createServerApi')
    expect(source).not.toContain('characters.resolve')
    expect(source).not.toContain('setQueryData')
  })
})
