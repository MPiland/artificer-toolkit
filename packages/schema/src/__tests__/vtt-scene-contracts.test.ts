import { describe, expect, it } from 'vitest'

import {
  createSceneDefinitionInputDtoSchema,
  LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND,
  sceneCommandInputDtoSchema,
  sceneCommandResultDtoSchema,
  sceneBarrierDtoSchema,
  sceneDefinitionDtoSchema,
  sceneDeltaDtoSchema,
  sceneFogLayerDtoSchema,
  sceneGeometryCommandInputDtoSchema,
  sceneGridDtoSchema,
  sceneStoredTokenDtoSchema,
  sceneTokenSenseDtoSchema,
  sceneTokenVisionDtoSchema,
  sceneTokenDtoSchema,
  sceneTransientEnvelopeDtoSchema
} from '../api/vttScenes.js'
import {
  lengthMeasurementInSceneUnits,
  SCENE_LENGTH_AMOUNT_MAX
} from '@artificer-toolkit/shared/vtt'
import { sceneActorVisionResultSchema } from '../api/characterMechanicsRead.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  map: '00000000-0000-4000-8000-000000000002',
  scene: '00000000-0000-4000-8000-000000000003',
  token: '00000000-0000-4000-8000-000000000004',
  barrier: '00000000-0000-4000-8000-000000000005'
} as const

function sceneDefinition() {
  return {
    annotations: [],
    ambientIllumination: 'BRIGHT' as const,
    daylight: false,
    barriers: [],
    campaignId: ids.campaign,
    darknessZones: [],
    fogMode: 'SHARED_PARTY' as const,
    grid: {
      cellSize: 50,
      diagonalPolicy: 'EQUAL' as const,
      distancePerCell: 5,
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      unit: 'FEET' as const
    },
    id: ids.scene,
    lights: [],
    map: {
      assetId: ids.map,
      height: 4_000,
      tileManifestAssetId: null,
      width: 4_000
    },
    name: 'Dungeon',
    tokens: [],
    version: 1,
    visionRevealMode: 'ON_DRAG' as const
  }
}

describe('VTT scene contracts', () => {
  it('accepts an exact renderer-neutral definition and rejects unknown fields', () => {
    expect(sceneDefinitionDtoSchema.parse(sceneDefinition())).toEqual(sceneDefinition())
    expect(
      sceneDefinitionDtoSchema.safeParse({
        ...sceneDefinition(),
        renderer: 'PIXI'
      }).success
    ).toBe(false)
  })

  it('measures one cell of a Squares grid as one square', () => {
    const squares = { ...sceneDefinition().grid, unit: 'SQUARES' as const }
    expect(sceneGridDtoSchema.safeParse({ ...squares, distancePerCell: 1 }).success).toBe(true)
    expect(sceneGridDtoSchema.safeParse({ ...squares, distancePerCell: 5 }).success).toBe(false)
    expect(
      sceneGridDtoSchema.safeParse({ ...squares, unit: 'METERS', distancePerCell: 1.5 }).success
    ).toBe(true)
  })

  it('requires an explicit fog mode, including OFF, and accepts fog mode commands', () => {
    expect(sceneDefinitionDtoSchema.parse({ ...sceneDefinition(), fogMode: 'OFF' })).toMatchObject({
      fogMode: 'OFF'
    })
    const { fogMode: _fogMode, ...missingFogMode } = sceneDefinition()
    expect(sceneDefinitionDtoSchema.safeParse(missingFogMode).success).toBe(false)
    expect(
      sceneDefinitionDtoSchema.safeParse({ ...sceneDefinition(), fogMode: 'NONE' }).success
    ).toBe(false)
    expect(
      sceneCommandInputDtoSchema.safeParse({
        commandId: ids.campaign,
        expectedSceneVersion: 3,
        mode: 'OFF',
        sceneId: ids.scene,
        type: 'SET_SCENE_FOG_MODE'
      }).success
    ).toBe(true)
    expect(
      sceneDeltaDtoSchema.safeParse({ kind: 'FOG_MODE_SET', mode: 'PER_PLAYER' }).success
    ).toBe(true)
  })

  it('requires closed ambient and zone mechanics without compatibility defaults', () => {
    const zone = {
      id: ids.token,
      mechanicalIllumination: null,
      mechanicalObscurement: null,
      opacity: 0.5,
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ]
      }
    }
    expect(
      sceneDefinitionDtoSchema.safeParse({
        ...sceneDefinition(),
        darknessZones: [zone]
      }).success
    ).toBe(true)
    expect(
      sceneDefinitionDtoSchema.safeParse({
        ...sceneDefinition(),
        ambientIllumination: 'VOID'
      }).success
    ).toBe(false)
    const { ambientIllumination: _ambientIllumination, ...missingAmbient } = sceneDefinition()
    expect(sceneDefinitionDtoSchema.safeParse(missingAmbient).success).toBe(false)
    const { mechanicalObscurement: _mechanicalObscurement, ...missingMechanics } = zone
    expect(
      sceneDefinitionDtoSchema.safeParse({
        ...sceneDefinition(),
        darknessZones: [missingMechanics]
      }).success
    ).toBe(false)
    expect(
      sceneDeltaDtoSchema.safeParse({
        kind: 'AMBIENT_ILLUMINATION_SET',
        daylight: true,
        illumination: 'DIM'
      }).success
    ).toBe(true)
    expect(
      sceneDeltaDtoSchema.safeParse({
        kind: 'AMBIENT_ILLUMINATION_SET',
        daylight: false,
        illumination: 'VOID'
      }).success
    ).toBe(false)
  })

  it('accepts ambient commands and decodes only exact legacy visual darkness commands', () => {
    const commandBase = {
      commandId: ids.campaign,
      expectedSceneVersion: 3,
      sceneId: ids.scene
    }
    const polygon = {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ]
    }

    expect(
      sceneCommandInputDtoSchema.safeParse({
        ...commandBase,
        daylight: true,
        illumination: 'DIM',
        type: 'SET_SCENE_AMBIENT_ILLUMINATION'
      }).success
    ).toBe(true)
    expect(
      sceneCommandInputDtoSchema.safeParse({
        ...commandBase,
        illumination: 'DIM',
        type: 'SET_SCENE_AMBIENT_ILLUMINATION'
      }).success
    ).toBe(false)
    expect(
      sceneCommandInputDtoSchema.safeParse({
        ...commandBase,
        type: 'UPSERT_SCENE_DARKNESS',
        zone: {
          id: ids.token,
          mechanicalIllumination: 'ORDINARY_DARKNESS',
          mechanicalObscurement: null,
          opacity: 0.5,
          polygon
        }
      }).success
    ).toBe(true)

    expect(
      sceneCommandInputDtoSchema.parse({
        ...commandBase,
        type: 'UPSERT_SCENE_DARKNESS',
        zone: { id: ids.token, opacity: 0.5, polygon }
      })
    ).toMatchObject({
      legacyReplayKind: LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND,
      zone: {
        mechanicalIllumination: null,
        mechanicalObscurement: null
      }
    })

    expect(
      sceneCommandInputDtoSchema.safeParse({
        ...commandBase,
        type: 'UPSERT_SCENE_DARKNESS',
        zone: {
          id: ids.token,
          mechanicalIllumination: null,
          opacity: 0.5,
          polygon
        }
      }).success
    ).toBe(false)
  })

  it('requires lowercase Token and Barrier IDs', () => {
    const token = {
      assetId: null,
      controlledByUserIds: [],
      height: 1,
      hidden: false,
      id: ids.token,
      label: 'Token',
      locked: false,
      position: { x: 1, y: 2 },
      rotationDegrees: 0,
      senses: [],
      vision: null,
      width: 1
    }
    const upper = crypto.randomUUID().toUpperCase()
    expect(sceneTokenDtoSchema.safeParse(token).success).toBe(true)
    expect(sceneTokenDtoSchema.safeParse({ ...token, id: upper }).success).toBe(false)
    expect(
      sceneBarrierDtoSchema.safeParse({
        a: { x: 0, y: 0 },
        b: { x: 10, y: 0 },
        blocksLight: true,
        blocksMovement: true,
        id: upper,
        kind: 'WALL'
      }).success
    ).toBe(false)
  })

  it('keeps Token senses strict and bounded', () => {
    const token = {
      assetId: null,
      controlledByUserIds: [],
      height: 1,
      hidden: false,
      id: ids.token,
      label: 'Token',
      locked: false,
      position: { x: 1, y: 2 },
      rotationDegrees: 0,
      vision: null,
      width: 1
    }
    const sense = {
      channel: 'VISUAL' as const,
      illuminationAccess: 'ORDINARY_DARKNESS' as const,
      label: 'Darkvision',
      range: { rangeKind: 'DISTANCE' as const, amount: 60 },
      senseId: ids.barrier
    }
    const seededSenseId = '5e2d0000-0000-0000-0000-000000000001'
    const parses = (senses: unknown) => sceneTokenDtoSchema.safeParse({ ...token, senses }).success

    expect(parses([sense])).toBe(true)
    // Seeded System Senses keep deterministic IDs without an RFC version nibble.
    expect(parses([{ ...sense, senseId: seededSenseId }])).toBe(true)
    expect(
      sceneActorVisionResultSchema.safeParse({
        actorId: ids.token,
        senses: [
          {
            ...sense,
            range: { rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' },
            senseId: seededSenseId
          }
        ]
      }).success
    ).toBe(true)
    expect(parses([])).toBe(true)
    expect(sceneTokenDtoSchema.safeParse(token).success).toBe(false)
    expect(parses([{ ...sense, extra: true }])).toBe(false)
    expect(parses([{ ...sense, channel: 'SMELL' }])).toBe(false)
    expect(parses([{ ...sense, illuminationAccess: 'BRIGHT' }])).toBe(false)
    expect(parses([{ ...sense, range: { rangeKind: 'UNLIMITED' } }])).toBe(true)
    expect(parses([{ ...sense, range: { rangeKind: 'DISTANCE', amount: 0 } }])).toBe(false)
    expect(parses([{ ...sense, range: { rangeKind: 'DISTANCE', amount: -5 } }])).toBe(false)
    expect(parses([{ ...sense, range: null }])).toBe(false)
    expect(parses([{ ...sense, range: 60 }])).toBe(false)
    expect(parses([{ ...sense, label: ' ' }])).toBe(false)
    expect(parses([{ ...sense, senseId: 'darkvision' }])).toBe(false)
    expect(parses([{ channel: sense.channel }])).toBe(false)
    expect(parses(Array.from({ length: 101 }, () => sense))).toBe(false)
  })

  it('lets the transport Token carry senses but never the stored Token', () => {
    const token = {
      assetId: null,
      controlledByUserIds: [],
      height: 1,
      hidden: false,
      id: ids.token,
      label: 'Token',
      locked: false,
      position: { x: 1, y: 2 },
      rotationDegrees: 0,
      vision: null,
      width: 1
    }
    const sense = {
      channel: 'VISUAL' as const,
      illuminationAccess: 'ORDINARY_DARKNESS' as const,
      label: 'Darkvision',
      range: { rangeKind: 'DISTANCE' as const, amount: 60 },
      senseId: ids.barrier
    }

    expect(sceneTokenDtoSchema.safeParse({ ...token, senses: [sense] }).success).toBe(true)
    expect(sceneStoredTokenDtoSchema.safeParse({ ...token, senses: [sense] }).success).toBe(false)
    expect(
      sceneStoredTokenDtoSchema.safeParse({ ...token, senses: [sense] }).error?.issues
    ).toEqual([
      expect.objectContaining({
        message: 'Stored Scene tokens never carry senses.',
        path: ['senses']
      })
    ])
    expect(sceneStoredTokenDtoSchema.safeParse({ ...token, senses: [] }).success).toBe(true)
  })

  it('lets the transport Token carry the light its actor sheds but never the stored Token', () => {
    const token = {
      assetId: null,
      controlledByUserIds: [],
      height: 1,
      hidden: false,
      id: ids.token,
      label: 'Token',
      locked: false,
      position: { x: 1, y: 2 },
      rotationDegrees: 0,
      senses: [],
      vision: null,
      width: 1
    }
    const light = { brightRadius: 10, dimRadius: 20 }

    expect(sceneTokenDtoSchema.safeParse({ ...token, light }).success).toBe(true)
    expect(sceneStoredTokenDtoSchema.safeParse({ ...token, light }).error?.issues).toEqual([
      expect.objectContaining({
        message: 'Stored Scene tokens never carry light.',
        path: ['light']
      })
    ])
    expect(
      sceneTokenDtoSchema.safeParse({ ...token, light: { brightRadius: 20, dimRadius: 10 } })
        .success
    ).toBe(false)
  })

  it('accepts only the five geometry commands with full-schema parity', () => {
    const commandBase = {
      commandId: ids.campaign,
      expectedSceneVersion: 3,
      sceneId: ids.scene
    }
    const token = {
      assetId: null,
      controlledByUserIds: [],
      height: 1,
      hidden: false,
      id: ids.token,
      label: 'Token',
      locked: false,
      position: { x: 1, y: 2 },
      rotationDegrees: 0,
      senses: [],
      vision: null,
      width: 1
    }
    const barrier = {
      a: { x: 0, y: 0 },
      b: { x: 10, y: 0 },
      blocksLight: true,
      blocksMovement: true,
      id: ids.barrier,
      kind: 'WALL' as const
    }
    const geometryCommands = [
      { ...commandBase, token, type: 'UPSERT_SCENE_TOKEN' as const },
      { ...commandBase, tokenId: ids.token, type: 'REMOVE_SCENE_TOKEN' as const },
      {
        ...commandBase,
        barrierId: ids.barrier,
        state: 'OPEN' as const,
        type: 'SET_SCENE_DOOR_STATE' as const
      },
      { ...commandBase, barrier, type: 'UPSERT_SCENE_BARRIER' as const },
      { ...commandBase, barrierId: ids.barrier, type: 'REMOVE_SCENE_BARRIER' as const }
    ] as const

    for (const command of geometryCommands) {
      expect(sceneGeometryCommandInputDtoSchema.parse(command)).toEqual(
        sceneCommandInputDtoSchema.parse(command)
      )
    }

    const missingTokenId = { ...commandBase, type: 'REMOVE_SCENE_TOKEN' }
    for (const schema of [sceneGeometryCommandInputDtoSchema, sceneCommandInputDtoSchema])
      expect(schema.safeParse(missingTokenId).success).toBe(false)

    const invalidTokenId = { ...geometryCommands[1], tokenId: 'not-a-uuid' }
    for (const schema of [sceneGeometryCommandInputDtoSchema, sceneCommandInputDtoSchema])
      expect(schema.safeParse(invalidTokenId).success).toBe(false)

    const move = {
      ...commandBase,
      correlationId: null,
      expectedEncounterVersion: null,
      movementKind: 'VOLUNTARY' as const,
      path: [
        { x: 1, y: 2 },
        { x: 3, y: 4 }
      ],
      tokenId: ids.token,
      type: 'MOVE_SCENE_TOKEN' as const
    }
    const undo = { ...commandBase, type: 'UNDO_LAST_SCENE_MOVE' as const }
    const nonGeometry = {
      ...commandBase,
      daylight: false,
      illumination: 'DIM' as const,
      type: 'SET_SCENE_AMBIENT_ILLUMINATION' as const
    }
    for (const command of [move, undo, nonGeometry]) {
      expect(sceneGeometryCommandInputDtoSchema.safeParse(command).success).toBe(false)
      expect(sceneCommandInputDtoSchema.safeParse(command).success).toBe(true)
    }
  })

  it('rejects oversized maps and duplicate structural IDs', () => {
    expect(
      sceneDefinitionDtoSchema.safeParse({
        ...sceneDefinition(),
        map: { ...sceneDefinition().map, height: 8_192, width: 8_192 }
      }).success
    ).toBe(false)
    expect(
      sceneDefinitionDtoSchema.safeParse({
        ...sceneDefinition(),
        grid: { ...sceneDefinition().grid, cellSize: 0.5 }
      }).success
    ).toBe(false)
    const token = {
      assetId: null,
      controlledByUserIds: [],
      height: 1,
      hidden: false,
      id: ids.token,
      label: 'Token',
      locked: false,
      position: { x: 0, y: 0 },
      rotationDegrees: 0,
      senses: [],
      vision: null,
      width: 1
    }
    expect(
      sceneDefinitionDtoSchema.safeParse({
        ...sceneDefinition(),
        tokens: [token, token]
      }).success
    ).toBe(false)
    const { id: _id, version: _version, ...createInput } = sceneDefinition()
    expect(
      createSceneDefinitionInputDtoSchema.safeParse({
        ...createInput,
        tokens: [token, token]
      }).success
    ).toBe(false)
  })

  it('validates exact bounded fog bits and transient envelopes', () => {
    expect(
      sceneFogLayerDtoSchema.parse({
        chunks: [{ data: 'Dw==', height: 2, index: 0, width: 2, x: 0, y: 0 }],
        height: 8,
        ownerUserId: null,
        width: 8
      }).chunks[0]?.data
    ).toBe('Dw==')
    expect(
      sceneFogLayerDtoSchema.safeParse({
        chunks: [{ data: 'Dw==', height: 9, index: 0, width: 9, x: 0, y: 0 }],
        height: 8,
        ownerUserId: null,
        width: 8
      }).success
    ).toBe(false)
    expect(
      sceneTransientEnvelopeDtoSchema.safeParse({
        baselineVersion: 3,
        audience: 'TABLE',
        kind: 'TOKEN_DRAG_PREVIEW',
        position: { x: 1, y: 2 },
        sceneId: ids.scene,
        sequence: 1,
        tokenId: ids.token
      }).success
    ).toBe(true)
    expect(
      sceneTransientEnvelopeDtoSchema.safeParse({
        baselineVersion: 3,
        explored: true,
        audience: 'TABLE',
        kind: 'FOG_AREA_PREVIEW',
        ownerUserId: ids.campaign,
        rectangle: { a: { x: 1, y: 2 }, b: { x: 10, y: 20 } },
        sceneId: ids.scene,
        sequence: 2
      }).success
    ).toBe(true)
    expect(
      sceneTransientEnvelopeDtoSchema.safeParse({
        audience: 'TABLE',
        kind: 'TOKEN_DRAG_PREVIEW',
        position: { x: 1, y: 2 },
        sequence: 1,
        tokenId: ids.token
      }).success
    ).toBe(false)
    expect(
      sceneTransientEnvelopeDtoSchema.safeParse({
        baselineVersion: 3,
        kind: 'PING',
        position: { x: 1, y: 2 },
        sceneId: ids.scene,
        sequence: 1
      }).success
    ).toBe(false)
  })

  it('lets only a voluntary move name a speed type, and none is allowed (SPELLS-5.6)', () => {
    const move = (movementKind: string, speedId?: string | null) => ({
      commandId: ids.campaign,
      correlationId: null,
      expectedEncounterVersion: null,
      expectedSceneVersion: 3,
      movementKind,
      path: [
        { x: 1, y: 2 },
        { x: 3, y: 4 }
      ],
      sceneId: ids.scene,
      tokenId: ids.token,
      type: 'MOVE_SCENE_TOKEN',
      ...(speedId !== undefined && { speedId })
    })
    expect(sceneCommandInputDtoSchema.safeParse(move('VOLUNTARY')).success).toBe(true)
    expect(sceneCommandInputDtoSchema.safeParse(move('VOLUNTARY', ids.token)).success).toBe(true)
    expect(sceneCommandInputDtoSchema.safeParse(move('FORCED', ids.token)).success).toBe(false)
    expect(sceneCommandInputDtoSchema.safeParse(move('FORCED', null)).success).toBe(true)
  })

  it('lets only a voluntary move be made carefully (SPELLS-17)', () => {
    const move = (movementKind: string, carefully: boolean) => ({
      commandId: ids.campaign,
      correlationId: null,
      expectedEncounterVersion: null,
      expectedSceneVersion: 3,
      movementKind,
      path: [
        { x: 1, y: 2 },
        { x: 3, y: 4 }
      ],
      sceneId: ids.scene,
      tokenId: ids.token,
      type: 'MOVE_SCENE_TOKEN',
      carefully
    })
    expect(sceneCommandInputDtoSchema.safeParse(move('VOLUNTARY', true)).success).toBe(true)
    expect(sceneCommandInputDtoSchema.safeParse(move('FORCED', true)).success).toBe(false)
    expect(sceneCommandInputDtoSchema.safeParse(move('FORCED', false)).success).toBe(true)
  })

  it('validates movement paths, GM undo commands, and exact fog replacement ownership', () => {
    expect(
      sceneCommandInputDtoSchema.safeParse({
        commandId: ids.campaign,
        correlationId: null,
        expectedEncounterVersion: null,
        expectedSceneVersion: 3,
        movementKind: 'VOLUNTARY',
        path: [
          { x: 1, y: 2 },
          { x: 3, y: 4 }
        ],
        sceneId: ids.scene,
        tokenId: ids.token,
        type: 'MOVE_SCENE_TOKEN'
      }).success
    ).toBe(true)
    expect(
      sceneCommandInputDtoSchema.safeParse({
        commandId: ids.campaign,
        correlationId: null,
        expectedEncounterVersion: null,
        expectedSceneVersion: 3,
        movementKind: 'VOLUNTARY',
        path: [
          { x: 1, y: 2 },
          { x: 1, y: 2 }
        ],
        sceneId: ids.scene,
        tokenId: ids.token,
        type: 'MOVE_SCENE_TOKEN'
      }).success
    ).toBe(false)
    expect(
      sceneCommandInputDtoSchema.safeParse({
        commandId: ids.campaign,
        correlationId: null,
        expectedEncounterVersion: null,
        expectedSceneVersion: 3,
        movementKind: 'VOLUNTARY',
        path: [
          { x: 1, y: 2 },
          { x: 3, y: 2 },
          { x: 1, y: 2 }
        ],
        sceneId: ids.scene,
        tokenId: ids.token,
        type: 'MOVE_SCENE_TOKEN'
      }).success
    ).toBe(true)
    expect(
      sceneCommandInputDtoSchema.safeParse({
        commandId: ids.campaign,
        correlationId: null,
        expectedEncounterVersion: null,
        expectedSceneVersion: 3,
        movementKind: 'TELEPORT',
        path: [{ x: 1, y: 2 }],
        sceneId: ids.scene,
        tokenId: ids.token,
        type: 'MOVE_SCENE_TOKEN'
      }).success
    ).toBe(false)
    expect(
      sceneCommandInputDtoSchema.safeParse({
        commandId: ids.campaign,
        correlationId: null,
        expectedEncounterVersion: null,
        expectedSceneVersion: 3,
        movementKind: 'TELEPORT',
        path: [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
          { x: 3, y: 4 }
        ],
        sceneId: ids.scene,
        tokenId: ids.token,
        type: 'MOVE_SCENE_TOKEN'
      }).success
    ).toBe(false)
    expect(
      sceneCommandInputDtoSchema.safeParse({
        commandId: ids.campaign,
        expectedSceneVersion: 3,
        sceneId: ids.scene,
        type: 'UNDO_LAST_SCENE_MOVE'
      }).success
    ).toBe(true)
    expect(
      sceneDeltaDtoSchema.safeParse({
        kind: 'FOG_LAYER_REPLACED',
        layer: { chunks: [], height: 8, ownerUserId: ids.token, width: 8 },
        ownerUserId: ids.campaign
      }).success
    ).toBe(false)
  })

  it('permits a null Scene delta only when an Encounter occurrence owns mechanics', () => {
    const occurrence = {
      occurrenceId: ids.map,
      occurrenceVersion: 2,
      status: 'PENDING' as const,
      pending: {
        kind: 'D20_EVIDENCE' as const,
        occurrenceId: ids.map,
        occurrenceVersion: 2,
        encounterVersion: 5,
        rollerActorId: null,
        request: {
          requestId: 'd20',
          min: 1 as const,
          max: 20 as const,
          rollMode: 'NORMAL' as const,
          keep: 'FIRST' as const,
          rollModes: [
            { code: 'NORMAL', label: 'Normal', keep: 'FIRST' },
            { code: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' }
          ],
          derivedRollModeReasons: []
        },
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL'] as const
      }
    }
    expect(
      sceneCommandResultDtoSchema.safeParse({
        commandId: ids.campaign,
        delta: null,
        occurrence,
        replayed: false,
        sceneId: ids.scene,
        version: 3
      }).success
    ).toBe(true)
    expect(
      sceneCommandResultDtoSchema.safeParse({
        commandId: ids.campaign,
        delta: null,
        occurrence: null,
        replayed: false,
        sceneId: ids.scene,
        version: 3
      }).success
    ).toBe(false)
  })
})

describe('Scene length bound', () => {
  const sense = (amount: number) => ({
    channel: 'VISUAL',
    illuminationAccess: 'ORDINARY_DARKNESS',
    label: 'Telescopic sight',
    range: { rangeKind: 'DISTANCE', amount },
    senseId: ids.token
  })
  const vision = (brightRange: number) => ({
    angleDegrees: 360,
    brightRange,
    dimRange: 0,
    directionDegrees: 0,
    enabled: true
  })

  it('accepts a 200-mile sense measured in feet', () => {
    const feet = lengthMeasurementInSceneUnits(
      { amount: 200, unit: 'MILES' },
      { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }
    )
    expect(sceneTokenSenseDtoSchema.safeParse(sense(feet)).success).toBe(true)
  })

  it.each([
    ['sense range', (amount: number) => sceneTokenSenseDtoSchema.safeParse(sense(amount))],
    ['vision range', (amount: number) => sceneTokenVisionDtoSchema.safeParse(vision(amount))]
  ])('bounds a %s at exactly the largest authored length', (_name, parse) => {
    expect(parse(SCENE_LENGTH_AMOUNT_MAX).success).toBe(true)
    expect(parse(SCENE_LENGTH_AMOUNT_MAX + 1).success).toBe(false)
  })
})
