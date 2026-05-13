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
    expectedViewTarget: 'to: \'/spells/$spellPublicId/$spellSlug\''
  },
  {
    name: 'background',
    sourcePath: 'src/routes/_authed/backgrounds/index.tsx',
    expectedViewTarget: 'to: \'/backgrounds/$backgroundPublicId/$backgroundSlug\''
  },
  {
    name: 'feat',
    sourcePath: 'src/routes/_authed/feats/index.tsx',
    expectedViewTarget: 'to: \'/feats/$featPublicId/$featSlug\''
  },
  {
    name: 'race',
    sourcePath: 'src/routes/_authed/races/index.tsx',
    expectedViewTarget: 'to: \'/races/$racePublicId/$raceSlug\''
  },
  {
    name: 'creature',
    sourcePath: 'src/routes/_authed/creatures/index.tsx',
    expectedViewTarget: 'to: \'/creatures/$creaturePublicId/$creatureSlug\''
  },
  {
    name: 'equipment',
    sourcePath: 'src/routes/_authed/equipment/index.tsx',
    expectedViewTarget: 'to: \'/equipment/$equipmentPublicId/$equipmentSlug\''
  },
  {
    name: 'vehicle',
    sourcePath: 'src/routes/_authed/vehicles/index.tsx',
    expectedViewTarget: 'to: \'/vehicles/$vehiclePublicId/$vehicleSlug\''
  },
  {
    name: 'class',
    sourcePath: 'src/routes/_authed/classes/index.tsx',
    expectedViewTarget: 'to: \'/classes/$classPublicId/$classSlug\''
  }
] as const

describe('authored detail routes', () => {
  it.each(authoredDetailRoutes)('renders the $name detail index route instead of redirecting to edit', ({
    expectedPage,
    sourcePath
  }) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8')

    expect(source).toContain(expectedPage)
    expect(source).toContain('component:')
    expect(source).not.toContain('/edit')
  })

  it.each(authoredListRoutes)('uses the detail route for $name list view actions', ({
    expectedViewTarget,
    sourcePath
  }) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8')

    expect(source).toContain('onView={(item) => navigate({')
    expect(source).toContain(expectedViewTarget)
  })
})
