import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const authoredDetailRoutes = [
  {
    name: 'spell',
    sourcePath: 'src/routes/_authed/spells/$spellPublicId/$spellSlug/index.tsx',
    expectedPage: 'SpellDetailPage'
  },
  {
    name: 'background',
    sourcePath: 'src/routes/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/index.tsx',
    expectedPage: 'BackgroundDetailPage'
  },
  {
    name: 'feat',
    sourcePath: 'src/routes/_authed/feats/$featPublicId/$featSlug/index.tsx',
    expectedPage: 'FeatDetailPage'
  },
  {
    name: 'race',
    sourcePath: 'src/routes/_authed/races/$racePublicId/$raceSlug/index.tsx',
    expectedPage: 'RaceDetailPage'
  },
  {
    name: 'creature',
    sourcePath: 'src/routes/_authed/creatures/$creaturePublicId/$creatureSlug/index.tsx',
    expectedPage: 'CreatureDetailPage'
  },
  {
    name: 'equipment',
    sourcePath: 'src/routes/_authed/equipment/$equipmentPublicId/$equipmentSlug/index.tsx',
    expectedPage: 'EquipmentDetailPage'
  },
  {
    name: 'vehicle',
    sourcePath: 'src/routes/_authed/vehicles/$vehiclePublicId/$vehicleSlug/index.tsx',
    expectedPage: 'VehicleDetailPage'
  },
  {
    name: 'class',
    sourcePath: 'src/routes/_authed/classes/$classPublicId/$classSlug/index.tsx',
    expectedPage: 'ClassDetailPage'
  }
] as const

const authoredListRoutes = [
  {
    name: 'spell',
    sourcePath: 'src/routes/_authed/spells/index.tsx',
    expectedViewTarget: "to: '/spells/$spellPublicId/$spellSlug'"
  },
  {
    name: 'background',
    sourcePath: 'src/routes/_authed/backgrounds/index.tsx',
    expectedViewTarget: "to: '/backgrounds/$backgroundPublicId/$backgroundSlug'"
  },
  {
    name: 'feat',
    sourcePath: 'src/routes/_authed/feats/index.tsx',
    expectedViewTarget: "to: '/feats/$featPublicId/$featSlug'"
  },
  {
    name: 'race',
    sourcePath: 'src/routes/_authed/races/index.tsx',
    expectedViewTarget: "to: '/races/$racePublicId/$raceSlug'"
  },
  {
    name: 'creature',
    sourcePath: 'src/routes/_authed/creatures/index.tsx',
    expectedViewTarget: "to: '/creatures/$creaturePublicId/$creatureSlug'"
  },
  {
    name: 'equipment',
    sourcePath: 'src/routes/_authed/equipment/index.tsx',
    expectedViewTarget: "to: '/equipment/$equipmentPublicId/$equipmentSlug'"
  },
  {
    name: 'vehicle',
    sourcePath: 'src/routes/_authed/vehicles/index.tsx',
    expectedViewTarget: "to: '/vehicles/$vehiclePublicId/$vehicleSlug'"
  },
  {
    name: 'class',
    sourcePath: 'src/routes/_authed/classes/index.tsx',
    expectedViewTarget: "to: '/classes/$classPublicId/$classSlug'"
  }
] as const

const authoredEditRoutes = [
  'src/routes/_authed/classes/$classPublicId/$classSlug/edit.tsx',
  'src/routes/_authed/equipment/$equipmentPublicId/$equipmentSlug/edit.tsx',
  'src/routes/_authed/vehicles/$vehiclePublicId/$vehicleSlug/edit.tsx'
] as const

const authoredLegacyEditRoutes = [
  {
    name: 'spell',
    sourcePath: 'src/routes/_authed/spells/$spellPublicId/edit.tsx',
    expectedTarget: "to: '/spells/$spellPublicId/$spellSlug/edit'"
  },
  {
    name: 'background',
    sourcePath: 'src/routes/_authed/backgrounds/$backgroundPublicId/edit.tsx',
    expectedTarget: "to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'"
  },
  {
    name: 'feat',
    sourcePath: 'src/routes/_authed/feats/$featPublicId/edit.tsx',
    expectedTarget: "to: '/feats/$featPublicId/$featSlug/edit'"
  },
  {
    name: 'race',
    sourcePath: 'src/routes/_authed/races/$racePublicId/edit.tsx',
    expectedTarget: "to: '/races/$racePublicId/$raceSlug/edit'"
  },
  {
    name: 'creature',
    sourcePath: 'src/routes/_authed/creatures/$creaturePublicId/edit.tsx',
    expectedTarget: "to: '/creatures/$creaturePublicId/$creatureSlug/edit'"
  },
  {
    name: 'equipment',
    sourcePath: 'src/routes/_authed/equipment/$equipmentPublicId/edit.tsx',
    expectedTarget: "to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'"
  },
  {
    name: 'vehicle',
    sourcePath: 'src/routes/_authed/vehicles/$vehiclePublicId/edit.tsx',
    expectedTarget: "to: '/vehicles/$vehiclePublicId/$vehicleSlug/edit'"
  },
  {
    name: 'class',
    sourcePath: 'src/routes/_authed/classes/$classPublicId/edit.tsx',
    expectedTarget: "to: '/classes/$classPublicId/$classSlug/edit'"
  }
] as const

describe('authored detail routes', () => {
  it.each(authoredDetailRoutes)(
    'renders the $name detail index route instead of redirecting to edit',
    ({ expectedPage, sourcePath }) => {
      const source = readFileSync(join(process.cwd(), sourcePath), 'utf8')

      expect(source).toContain(expectedPage)
      expect(source).toContain('component:')
      expect(source).not.toContain('/edit')
    }
  )

  it.each(authoredListRoutes)(
    'uses the detail route for $name list view actions',
    ({ expectedViewTarget, sourcePath }) => {
      const source = readFileSync(join(process.cwd(), sourcePath), 'utf8')

      expect(source).toMatch(/onView=\{\(item\)\s*=>\s*navigate\(\{/)
      expect(source).toContain(expectedViewTarget)
    }
  )

  it.each(authoredEditRoutes)(
    'resolves public route handles before edit-page draft mutations in %s',
    (sourcePath) => {
      const source = readFileSync(join(process.cwd(), sourcePath), 'utf8')

      expect(source).toContain('resolveAuthoredRouteSubjectId')
      expect(source).not.toContain('parseAuthoredRouteId(params.')
    }
  )

  it.each(authoredLegacyEditRoutes)(
    'redirects legacy $name edit URLs to slugged edit routes',
    ({ expectedTarget, sourcePath }) => {
      const source = readFileSync(join(process.cwd(), sourcePath), 'utf8')

      expect(source).toContain('isLegacyAuthoredEditPath')
      expect(source).toContain('parseAuthoredRouteId(params.')
      expect(source).toContain(expectedTarget)
    }
  )
})
