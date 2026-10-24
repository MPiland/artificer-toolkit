import { signedVttMapDeliveryDtoSchema } from '@artificer-toolkit/schema/api/media'
import {
  campaignSceneStateDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { validated } from '../../../test/validatedFixture'

// The VTT_MAP limit is 8192 px a side and 64 MP, so the largest square map is 8000 px.
const mapSize = 8_000
const tileSize = 1_024
const fixtureUserId = fixtureUuid(1)
const revealedFogChunk = `${'////'.repeat(10_922)}//8=`

export const vttLoadFixtureExercise = {
  expectedMapAssetCount: 65,
  remoteUserId: '00000000-0000-4000-8000-000000000999',
  transientIntervalMs: 40,
  // Outlasts both preview expiry (1.2 s) and a ping ring (1.5 s).
  transientExpiryWaitMs: 1_650,
  warmupMs: 1_000
} as const

type VttLoadFixtureExerciseMode = 'FULL' | 'RAF_ONLY' | 'TRANSIENTS'

function fixtureUuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`
}

function svgDataUrl(width: number, height: number, color: string, detail: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${color}"/><path d="M0 ${height / 2}H${width}M${width / 2} 0V${height}" stroke="#ffffff" stroke-opacity=".09" stroke-width="8"/><text x="50%" y="50%" fill="#ffffff" fill-opacity=".35" font-family="system-ui" font-size="96" text-anchor="middle">${detail}</text></svg>`
  )}`
}

function doorInitialState(index: number): 'OPEN' | 'CLOSED' {
  return index % 3 === 0 ? 'OPEN' : 'CLOSED'
}

const loadFixtureMapAssetId = fixtureUuid(2)
const loadFixtureSceneId = fixtureUuid(3)

const doors = Array.from({ length: 10 }, (_, index) => ({
  a: { x: 600 + index * 700, y: 1_800 },
  b: { x: 1_000 + index * 700, y: 1_800 },
  blocksLightWhenClosed: true,
  blocksMovementWhenClosed: true,
  id: fixtureUuid(100 + index),
  initialState: doorInitialState(index),
  kind: 'DOOR' as const,
  openAngleDegrees: 90
}))

const wallColumns = 19
const wallMargin = 120
const wallLength = 300
// Spaces the columns so the last wall ends inside the map.
const wallColumnPitch = Math.floor((mapSize - 2 * wallMargin - wallLength) / (wallColumns - 1))
const walls = Array.from({ length: 190 }, (_, index) => ({
  a: {
    x: (index % wallColumns) * wallColumnPitch + wallMargin,
    y: Math.floor(index / wallColumns) * 600 + 260
  },
  b: {
    x: (index % wallColumns) * wallColumnPitch + wallMargin + wallLength,
    y: Math.floor(index / wallColumns) * 600 + 260
  },
  blocksLight: true,
  blocksMovement: true,
  id: fixtureUuid(200 + index),
  kind: 'WALL' as const
}))

export const vttLoadFixtureScene = validated(campaignSceneStateDtoSchema)({
  annotations: [],
  ambientIllumination: 'BRIGHT' as const,
  daylight: false,
  barriers: [...doors, ...walls],
  campaignId: fixtureUuid(4),
  darknessZones: Array.from({ length: 8 }, (_, index) => {
    const x = (index % 4) * 2_000 + 160
    const y = Math.floor(index / 4) * 3_700 + 280
    return {
      id: fixtureUuid(500 + index),
      mechanicalIllumination: null,
      mechanicalObscurement: null,
      opacity: 0.3 + (index % 3) * 0.15,
      polygon: {
        points: [
          { x, y },
          { x: x + 1_200, y },
          { x: x + 1_200, y: y + 900 },
          { x, y: y + 900 }
        ]
      }
    }
  }),
  definitionId: fixtureUuid(5),
  definitionVersion: 1,
  doorStates: Object.fromEntries(doors.map((door) => [door.id, door.initialState])),
  fogLayers: [
    {
      chunks: [
        {
          data: revealedFogChunk,
          height: 512,
          index: 0,
          width: 512,
          x: 0,
          y: 0
        }
      ],
      height: 512,
      ownerUserId: null,
      width: 512
    }
  ],
  fogMode: 'SHARED_PARTY',
  grid: {
    cellSize: 64,
    diagonalPolicy: 'ALTERNATING',
    distancePerCell: 5,
    kind: 'SQUARE',
    origin: { x: 0, y: 0 },
    unit: 'FEET'
  },
  id: loadFixtureSceneId,
  lights: Array.from({ length: 12 }, (_, index) => ({
    brightRadius: 340,
    color: index % 2 === 0 ? '#f6c56f' : '#6bd8cb',
    dimRadius: 680,
    id: fixtureUuid(600 + index),
    intensity: 0.8,
    ...(index % 2 === 0
      ? { kind: 'POINT' as const }
      : { angleDegrees: 95, directionDegrees: (index * 30) % 360, kind: 'CONE' as const }),
    position: { x: (index % 4) * 2_000 + 900, y: Math.floor(index / 4) * 2_300 + 900 }
  })),
  map: {
    assetId: loadFixtureMapAssetId,
    height: mapSize,
    tileManifestAssetId: null,
    width: mapSize
  },
  measurements: Array.from({ length: 8 }, (_, index) => ({
    createdByUserId: fixtureUserId,
    id: fixtureUuid(700 + index),
    label: `Route ${index + 1}`,
    path: [
      { x: 360 + index * 240, y: 420 + index * 180 },
      { x: 900 + index * 240, y: 760 + index * 180 },
      { x: 1_300 + index * 240, y: 1_260 + index * 180 }
    ]
  })),
  name: 'Eight-K Performance Fixture',
  tokens: Array.from({ length: 100 }, (_, index) => ({
    assetId: null,
    controlledByUserIds: index === 0 ? [fixtureUserId] : [],
    height: 52,
    hidden: false,
    id: fixtureUuid(800 + index),
    label: `Token ${index + 1}`,
    locked: false,
    position: { x: (index % 10) * 720 + 420, y: Math.floor(index / 10) * 720 + 420 },
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 52
  })),
  visionRevealMode: 'ON_DROP',
  version: 1
})

export const vttLoadFixtureMapDelivery = validated(signedVttMapDeliveryDtoSchema)({
  assetId: loadFixtureMapAssetId,
  expiresAt: '2030-01-01T00:00:00.000Z',
  height: mapSize,
  overview: {
    height: 2_048,
    url: svgDataUrl(2_048, 2_048, '#20252a', 'Overview'),
    width: 2_048
  },
  tiles: Array.from({ length: 64 }, (_, index) => {
    const column = index % 8
    const row = Math.floor(index / 8)
    const width = Math.min(tileSize, mapSize - column * tileSize)
    const height = Math.min(tileSize, mapSize - row * tileSize)
    return {
      column,
      height,
      row,
      url: svgDataUrl(width, height, index % 2 === 0 ? '#263038' : '#2d2925', `Tile ${index + 1}`),
      width
    }
  }),
  width: mapSize
})

export const vttLoadFixtureUserId = fixtureUserId

export function vttLoadFixtureSoakMs(search: string): number {
  const requestedSoakMs = Number(new URLSearchParams(search).get('soakMs'))
  return Number.isFinite(requestedSoakMs) && requestedSoakMs > 0 ? requestedSoakMs : 10_000
}

export function vttLoadFixtureCommitIntervalMs(search: string): number {
  const requestedIntervalMs = Number(new URLSearchParams(search).get('commitIntervalMs'))
  return Number.isFinite(requestedIntervalMs) && requestedIntervalMs >= 16
    ? requestedIntervalMs
    : 250
}

export function vttLoadFixtureExerciseMode(search: string): VttLoadFixtureExerciseMode {
  const requestedMode = new URLSearchParams(search).get('mode')
  return requestedMode === 'RAF_ONLY' || requestedMode === 'TRANSIENTS' ? requestedMode : 'FULL'
}

export function moveLoadFixtureScene(
  scene: CampaignSceneStateDto,
  updateNumber: number
): CampaignSceneStateDto {
  const firstToken = scene.tokens[0]!
  const firstDoor = doors[0]!
  return {
    ...scene,
    doorStates: {
      ...scene.doorStates,
      [firstDoor.id]: updateNumber % 2 === 0 ? 'OPEN' : 'CLOSED'
    },
    tokens: [
      {
        ...firstToken,
        position: {
          x: 420 + ((updateNumber * 48) % 600),
          y: 420 + ((updateNumber * 32) % 600)
        }
      },
      ...scene.tokens.slice(1)
    ],
    version: scene.version + 1
  }
}
