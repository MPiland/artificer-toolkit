import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Route as BackgroundDetailIndexRoute } from './_authed/backgrounds/$backgroundId/index'
import { Route as CreatureDetailIndexRoute } from './_authed/creatures/$creatureId/index'
import { Route as EquipmentDetailIndexRoute } from './_authed/equipment/$equipmentId/index'
import { Route as FeatDetailIndexRoute } from './_authed/feats/$featId/index'
import { Route as RaceDetailIndexRoute } from './_authed/races/$raceId/index'
import { Route as SpellDetailIndexRoute } from './_authed/spells/$spellId/index'

type DetailRoute = {
  options: {
    beforeLoad?: (args: { params: Record<string, string> }) => unknown
  }
}

const frozenDetailRoutes = [
  {
    name: 'spell',
    route: SpellDetailIndexRoute,
    idParam: 'spellId',
    idValue: 'test-spell',
    to: '/spells/$spellId/edit'
  },
  {
    name: 'background',
    route: BackgroundDetailIndexRoute,
    idParam: 'backgroundId',
    idValue: 'test-background',
    to: '/backgrounds/$backgroundId/edit'
  },
  {
    name: 'feat',
    route: FeatDetailIndexRoute,
    idParam: 'featId',
    idValue: 'test-feat',
    to: '/feats/$featId/edit'
  },
  {
    name: 'race',
    route: RaceDetailIndexRoute,
    idParam: 'raceId',
    idValue: 'test-race',
    to: '/races/$raceId/edit'
  },
  {
    name: 'creature',
    route: CreatureDetailIndexRoute,
    idParam: 'creatureId',
    idValue: 'test-creature',
    to: '/creatures/$creatureId/edit'
  },
  {
    name: 'equipment',
    route: EquipmentDetailIndexRoute,
    idParam: 'equipmentId',
    idValue: 'test-equipment',
    to: '/equipment/$equipmentId/edit'
  }
] as const

const authoredListRoutes = [
  {
    name: 'spell',
    sourcePath: 'src/routes/_authed/spells/index.tsx',
    expectedViewTarget: 'to: \'/spells/$spellId/edit\''
  },
  {
    name: 'background',
    sourcePath: 'src/routes/_authed/backgrounds/index.tsx',
    expectedViewTarget: 'to: \'/backgrounds/$backgroundId/edit\''
  },
  {
    name: 'feat',
    sourcePath: 'src/routes/_authed/feats/index.tsx',
    expectedViewTarget: 'to: \'/feats/$featId/edit\''
  },
  {
    name: 'race',
    sourcePath: 'src/routes/_authed/races/index.tsx',
    expectedViewTarget: 'to: \'/races/$raceId/edit\''
  },
  {
    name: 'creature',
    sourcePath: 'src/routes/_authed/creatures/index.tsx',
    expectedViewTarget: 'to: \'/creatures/$creatureId/edit\''
  },
  {
    name: 'equipment',
    sourcePath: 'src/routes/_authed/equipment/index.tsx',
    expectedViewTarget: 'to: \'/equipment/$equipmentId/edit\''
  }
] as const

describe('authored detail routes', () => {
  it.each(frozenDetailRoutes)('redirects $name detail index routes to edit', ({ idParam, idValue, route, to }) => {
    const beforeLoad = (route as DetailRoute).options.beforeLoad

    expect(beforeLoad).toBeDefined()
    expect(() => beforeLoad?.({ params: { [idParam]: idValue } })).toThrow(
      expect.objectContaining({
        options: expect.objectContaining({
          params: { [idParam]: idValue },
          to
        })
      })
    )
  })

  it.each(authoredListRoutes)('uses the edit route for $name list view actions', ({ expectedViewTarget, sourcePath }) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8')

    expect(source).toContain('onView={(item) => navigate({')
    expect(source).toContain(expectedViewTarget)
  })
})
