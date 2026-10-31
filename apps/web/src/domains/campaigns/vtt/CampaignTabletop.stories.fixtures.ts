import {
  campaignDetailDtoSchema,
  type CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { convexQuery } from '@convex-dev/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { buildVttTokenPresentations } from './vttTokenPresentation.model'
import { SRD_SYSTEM_ID, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { getCampaignCapabilities } from '@artificer-toolkit/shared/campaign/capabilities'
import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { SignedVttMapDeliveryDto } from '@artificer-toolkit/schema/api/media'
import {
  encounterActorMoraleDtoSchema,
  type EncounterActorMoraleDto
} from '@artificer-toolkit/schema/shared/encounterMorale'
import {
  DND5E_MORALE_DEFINITION_ID,
  type MoraleDispositionDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import type {
  CampaignSceneStateDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'

export const tabletopCampaignId = '11111111-1111-4111-8111-111111111111'
export const tabletopCurrentUserId = '22222222-2222-4222-8222-222222222222'
export const tabletopMapAssetId = '66666666-6666-4666-8666-666666666666'
const tabletopEncounterId = '88888888-8888-4888-8888-888888888888'

const tabletopMapDataUrl =
  'data:image/svg+xml,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
    <rect width="1400" height="900" fill="#20252a"/>
    <path d="M80 80h520v310H80zM670 80h650v310H670zM80 470h360v350H80zM510 470h810v350H510z" fill="#2b3238" stroke="#59636c" stroke-width="10"/>
    <path d="M600 230h70M260 390v80M1000 390v80M440 645h70" stroke="#8b775d" stroke-width="24"/>
    <circle cx="1120" cy="650" r="105" fill="#293b40"/>
  </svg>`)

const assignedCharacter = {
  id: '33333333-3333-4333-8333-333333333333',
  publicId: 'embers-wake',
  label: "Ember's Wake",
  systemId: SRD_SYSTEM_ID
} satisfies NonNullable<CampaignDetailDto['assignedCharacter']>

export const tabletopSceneDefinition = {
  annotations: [
    {
      id: '77777777-7777-4777-8777-777777777701',
      position: { x: 1100, y: 690 },
      text: 'Flooded observatory',
      visibility: 'GM_ONLY'
    },
    {
      id: '77777777-7777-4777-8777-777777777713',
      position: { x: 770, y: 230 },
      text: 'Braziers burn here',
      visibility: 'TABLE'
    }
  ],
  barriers: [
    {
      a: { x: 600, y: 80 },
      b: { x: 600, y: 390 },
      blocksLight: true,
      blocksMovement: true,
      id: '77777777-7777-4777-8777-777777777702',
      kind: 'WALL'
    },
    {
      a: { x: 600, y: 230 },
      b: { x: 670, y: 230 },
      blocksLightWhenClosed: true,
      blocksMovementWhenClosed: true,
      id: '77777777-7777-4777-8777-777777777703',
      initialState: 'CLOSED',
      kind: 'DOOR',
      openAngleDegrees: 90
    },
    {
      a: { x: 1000, y: 390 },
      b: { x: 1100, y: 390 },
      blocksLight: false,
      blocksMovement: true,
      id: '77777777-7777-4777-8777-777777777709',
      kind: 'WINDOW'
    },
    {
      a: { x: 440, y: 540 },
      b: { x: 440, y: 700 },
      blockedDirection: 'LEFT_TO_RIGHT',
      blocksLight: true,
      blocksMovement: true,
      id: '77777777-7777-4777-8777-777777777710',
      kind: 'ONE_WAY'
    },
    {
      a: { x: 880, y: 790 },
      b: { x: 1240, y: 790 },
      id: '77777777-7777-4777-8777-777777777711',
      kind: 'TERRAIN',
      movementCostMultiplier: 2
    }
  ],
  ambientIllumination: 'BRIGHT',
  daylight: false,
  campaignId: tabletopCampaignId,
  darknessZones: [
    {
      id: '77777777-7777-4777-8777-777777777704',
      mechanicalIllumination: null,
      mechanicalObscurement: null,
      opacity: 0.62,
      polygon: {
        points: [
          { x: 880, y: 510 },
          { x: 1240, y: 510 },
          { x: 1240, y: 790 },
          { x: 880, y: 790 }
        ]
      }
    }
  ],
  fogMode: 'SHARED_PARTY',
  visionRevealMode: 'ON_DROP',
  grid: {
    cellSize: 70,
    diagonalPolicy: 'ALTERNATING',
    distancePerCell: 5,
    kind: 'SQUARE',
    origin: { x: 0, y: 0 },
    unit: 'FEET'
  },
  id: '77777777-7777-4777-8777-777777777705',
  lights: [
    {
      brightRadius: 140,
      color: '#f6c56f',
      dimRadius: 280,
      id: '77777777-7777-4777-8777-777777777706',
      intensity: 0.9,
      kind: 'POINT',
      position: { x: 770, y: 230 }
    },
    {
      angleDegrees: 90,
      brightRadius: 110,
      color: '#6bd8cb',
      dimRadius: 220,
      directionDegrees: 45,
      id: '77777777-7777-4777-8777-777777777712',
      intensity: 0.7,
      kind: 'CONE',
      position: { x: 1080, y: 600 }
    }
  ],
  map: {
    assetId: tabletopMapAssetId,
    height: 900,
    tileManifestAssetId: null,
    width: 1400
  },
  name: 'The Lantern Vault',
  tokens: [
    {
      assetId: null,
      controlledByUserIds: [tabletopCurrentUserId],
      height: 70,
      hidden: false,
      id: '77777777-7777-4777-8777-777777777707',
      label: 'Ember',
      locked: false,
      position: { x: 260, y: 230 },
      rotationDegrees: 0,
      senses: [],
      vision: {
        angleDegrees: 360,
        brightRange: 60,
        dimRange: 120,
        directionDegrees: 0,
        enabled: true
      },
      width: 70
    },
    {
      assetId: null,
      controlledByUserIds: [],
      height: 70,
      hidden: true,
      id: '77777777-7777-4777-8777-777777777708',
      label: 'Vault Warden',
      locked: false,
      position: { x: 1120, y: 650 },
      rotationDegrees: 0,
      senses: [],
      vision: null,
      width: 70
    }
  ],
  version: 4
} satisfies SceneDefinitionDto

export const tabletopLiveScene = {
  ...tabletopSceneDefinition,
  definitionId: tabletopSceneDefinition.id,
  definitionVersion: tabletopSceneDefinition.version,
  doorStates: { '77777777-7777-4777-8777-777777777703': 'CLOSED' },
  fogLayers: [],
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  measurements: [
    {
      createdByUserId: tabletopCurrentUserId,
      id: '77777777-7777-4777-8777-777777777709',
      label: 'Vault span',
      path: [
        { x: 140, y: 140 },
        { x: 420, y: 140 }
      ]
    }
  ],
  version: 19
} satisfies CampaignSceneStateDto

export const tabletopMapDelivery = {
  assetId: tabletopMapAssetId,
  expiresAt: '2026-08-15T23:59:00.000Z',
  height: 900,
  overview: { height: 900, url: tabletopMapDataUrl, width: 1400 },
  tiles: [{ column: 0, height: 900, row: 0, url: tabletopMapDataUrl, width: 1400 }],
  width: 1400
} satisfies SignedVttMapDeliveryDto

const actorBases = [
  {
    activeGrants: [],
    concentration: null,
    conditions: [],
    consequences: [],
    controllerUserIds: [],
    defeated: false,
    disposition: 'FRIENDLY',
    encounterId: tabletopEncounterId,
    id: '99999999-9999-4999-8999-999999999901',
    initiative: 18,
    kind: 'CHARACTER',
    label: "Ember's Wake",
    manualOrder: null,
    absence: null,
    public: true,
    sourceId: assignedCharacter.id,
    sourceRevision: null
  },
  {
    activeGrants: [],
    concentration: null,
    conditions: [],
    consequences: [],
    controllerUserIds: [],
    defeated: false,
    disposition: 'HOSTILE',
    encounterId: tabletopEncounterId,
    id: '99999999-9999-4999-8999-999999999902',
    initiative: 14,
    kind: 'CREATURE',
    label: 'Vault Warden',
    manualOrder: null,
    absence: null,
    public: true,
    sourceId: null,
    sourceRevision: null
  }
] satisfies Omit<EncounterPlayerProjectionDto['actors'][number], 'health' | 'unseenReason'>[]

// The player controls their own Character (exact health); the enemy's level here is Descriptive.
const playerActors = [
  { ...actorBases[0], health: { level: 'EXACT', current: 36, maximum: 36 }, unseenReason: null },
  { ...actorBases[1], health: { level: 'DESCRIPTIVE', state: 'HURT' }, unseenReason: null }
] satisfies EncounterPlayerProjectionDto['actors']

const encounterBase = {
  automationMode: 'ASSISTED',
  campaignId: tabletopCampaignId,
  createdAt: '2026-08-15T22:05:00.000Z',
  currentActorId: actorBases[0].id,
  id: tabletopEncounterId,
  gameSystemId: assignedCharacter.systemId,
  initiativePolicy: null,
  name: 'Vault confrontation',
  optionalCombatRules: [] as EncounterPlayerProjectionDto['optionalCombatRules'],
  facingStepDegrees: null,
  facingArcs: null,
  round: 3,
  status: 'ACTIVE',
  blueprintId: '99999999-9999-4999-8999-999999999903',
  blueprintVersion: 1,
  blueprintChecksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  updatedAt: '2026-08-15T22:25:00.000Z',
  version: 12
} as const

export const tabletopPlayerEncounter = {
  ...encounterBase,
  actors: playerActors
} satisfies EncounterPlayerProjectionDto

export const tabletopGmEncounter = {
  ...encounterBase,
  trackAmmunition: false,
  zoneNoticing: 'GM_PROMPT',
  automaticCover: true,
  healthDisplayDefault: 'DESCRIPTIVE',
  actors: actorBases.map((actor, index) => ({
    ...actor,
    concealment: null,
    morale: null,
    moraleOffers: [],
    consequenceRollOffers: [],
    currentHitPoints: index === 0 ? 36 : 47,
    features: [],
    gmNotes: null,
    healthBand: index === 0 ? ('HEALTHY' as const) : ('WOUNDED' as const),
    healthDisplay: null,
    reveal: null,
    maxHitPoints: index === 0 ? 36 : 64,
    resources: {},
    stableTieKey: actor.id,
    statBlock: null,
    systemId: index === 0 ? assignedCharacter.systemId : null,
    tempHitPoints: 0
  })),
  reminders: []
} satisfies EncounterGmProjectionDto

export function createTabletopCampaign(role: 'OWNER' | 'PLAYER'): CampaignDetailDto {
  return campaignDetailDtoSchema.parse({
    assignedCharacter: role === 'PLAYER' ? assignedCharacter : null,
    attunementSlotOverride: null,
    rollModes: [
      { code: 'NORMAL', label: 'Normal', keep: 'FIRST' },
      { code: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' },
      { code: 'DISADVANTAGE', label: 'Disadvantage', keep: 'LOWER' }
    ],
    capabilities: getCampaignCapabilities('ACTIVE', role),
    contentMaturity: 'STANDARD',
    createdAt: '2026-08-01T12:00:00.000Z',
    description: '<p>A city of glass, smoke, and buried promises.</p>',
    format: 'ONGOING',
    gameSystemId: assignedCharacter.systemId,
    id: tabletopCampaignId,
    memberCount: 5,
    memberships: [
      {
        acceptedAt: '2026-08-01T12:00:00.000Z',
        accessStartedAt: '2026-08-01T12:00:00.000Z',
        assignedCharacter,
        characterControllerUserIds: [],
        role: 'PLAYER',
        userId: tabletopCurrentUserId,
        username: 'ember'
      }
    ],
    name: 'The Ashen Road',
    primaryRulesCatalogueId: '77777777-7777-4777-8777-777777777701',
    additionalRulesCatalogueIds: [],
    playerCount: 4,
    publicId: 'ashen-road',
    role,
    status: 'ACTIVE',
    toneDetails: null,
    toneTags: ['HEROIC', 'SERIOUS'],
    updatedAt: '2026-08-15T18:00:00.000Z',
    version: 8
  })
}

/** The product's token presentations, with the SRD condition types that name the fixtures' actor conditions. */
export function buildTabletopPresentations(
  input: Omit<Parameters<typeof buildVttTokenPresentations>[0], 'conditionTypes'>
) {
  return buildVttTokenPresentations({ ...input, conditionTypes: srdSystemRecord.conditionTypes })
}

/** Seeds the Campaign's System query, which names its actors' conditions. */
export function seedTabletopSystem(queryClient: QueryClient, campaign: CampaignDetailDto) {
  queryClient.setQueryData(
    convexQuery(convexApi.content.systems.get, { id: campaign.gameSystemId }).queryKey,
    srdSystemRecord
  )
}

/** Actor conditions holding the SRD condition types with these codes, as an Encounter projection carries them. */
/** A creature's morale check after the GM confirmed `disposition` (ENCOUNTER-6.2). */
export function tabletopConfirmedMorale(
  actorId: string,
  disposition: MoraleDispositionDto
): EncounterActorMoraleDto {
  return encounterActorMoraleDtoSchema.parse({
    commandId: '33333333-3333-4333-8333-333333333390',
    definitionId: DND5E_MORALE_DEFINITION_ID,
    triggerKind: 'INDIVIDUAL_REDUCED_TO_HALF',
    scope: 'SUBJECT',
    rollerActorId: actorId,
    groupLeaderActorId: null,
    save: null,
    proposed: disposition,
    disposition,
    firedTriggerKinds: ['INDIVIDUAL_REDUCED_TO_HALF']
  })
}

export function tabletopConditions(...codes: string[]) {
  return codes.map((code) => ({
    conditionTypeId: srdSystemRecord.conditionTypes.find((type) => type.code === code)!.id
  }))
}
