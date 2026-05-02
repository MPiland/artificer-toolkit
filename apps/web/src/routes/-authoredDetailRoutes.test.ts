import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const authoredDetailRoutes = [
  {
    name: 'spell',
    sourcePath: 'src/routes/_authed/spells/$spellId/index.tsx',
    expectedPage: 'SpellDetailPage'
  },
  {
    name: 'background',
    sourcePath: 'src/routes/_authed/backgrounds/$backgroundId/index.tsx',
    expectedPage: 'BackgroundDetailPage'
  },
  {
    name: 'feat',
    sourcePath: 'src/routes/_authed/feats/$featId/index.tsx',
    expectedPage: 'FeatDetailPage'
  },
  {
    name: 'race',
    sourcePath: 'src/routes/_authed/races/$raceId/index.tsx',
    expectedPage: 'RaceDetailPage'
  },
  {
    name: 'creature',
    sourcePath: 'src/routes/_authed/creatures/$creatureId/index.tsx',
    expectedPage: 'CreatureDetailPage'
  },
  {
    name: 'equipment',
    sourcePath: 'src/routes/_authed/equipment/$equipmentId/index.tsx',
    expectedPage: 'EquipmentDetailPage'
  },
  {
    name: 'vehicle',
    sourcePath: 'src/routes/_authed/vehicles/$vehicleId/index.tsx',
    expectedPage: 'VehicleDetailPage'
  },
  {
    name: 'class',
    sourcePath: 'src/routes/_authed/classes/$classId/index.tsx',
    expectedPage: 'ClassDetailPage'
  }
] as const

const authoredListRoutes = [
  {
    name: 'spell',
    sourcePath: 'src/routes/_authed/spells/index.tsx',
    expectedViewTarget: 'to: \'/spells/$spellId\''
  },
  {
    name: 'background',
    sourcePath: 'src/routes/_authed/backgrounds/index.tsx',
    expectedViewTarget: 'to: \'/backgrounds/$backgroundId\''
  },
  {
    name: 'feat',
    sourcePath: 'src/routes/_authed/feats/index.tsx',
    expectedViewTarget: 'to: \'/feats/$featId\''
  },
  {
    name: 'race',
    sourcePath: 'src/routes/_authed/races/index.tsx',
    expectedViewTarget: 'to: \'/races/$raceId\''
  },
  {
    name: 'creature',
    sourcePath: 'src/routes/_authed/creatures/index.tsx',
    expectedViewTarget: 'to: \'/creatures/$creatureId\''
  },
  {
    name: 'equipment',
    sourcePath: 'src/routes/_authed/equipment/index.tsx',
    expectedViewTarget: 'to: \'/equipment/$equipmentId\''
  },
  {
    name: 'vehicle',
    sourcePath: 'src/routes/_authed/vehicles/index.tsx',
    expectedViewTarget: 'to: \'/vehicles/$vehicleId\''
  },
  {
    name: 'class',
    sourcePath: 'src/routes/_authed/classes/index.tsx',
    expectedViewTarget: 'to: \'/classes/$classId\''
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
    expect(source).not.toContain('redirect')
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
