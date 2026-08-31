import { describe, expect, it } from 'vitest'

import {
  createSceneDefinitionInputDtoSchema,
  LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND,
  sceneCommandInputDtoSchema,
  sceneCommandResultDtoSchema,
  sceneDefinitionDtoSchema,
  sceneDeltaDtoSchema,
  sceneFogLayerDtoSchema,
  sceneTransientEnvelopeDtoSchema
} from '../api/vttScenes.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  map: '00000000-0000-4000-8000-000000000002',
  scene: '00000000-0000-4000-8000-000000000003',
  token: '00000000-0000-4000-8000-000000000004'
} as const

function sceneDefinition() {
  return {
    annotations: [],
    ambientIllumination: 'BRIGHT' as const,
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
        illumination: 'DIM'
      }).success
    ).toBe(true)
    expect(
      sceneDeltaDtoSchema.safeParse({
        kind: 'AMBIENT_ILLUMINATION_SET',
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
        illumination: 'DIM',
        type: 'SET_SCENE_AMBIENT_ILLUMINATION'
      }).success
    ).toBe(true)
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
        kind: 'FOG_AREA_PREVIEW',
        ownerUserId: ids.campaign,
        rectangle: { a: { x: 1, y: 2 }, b: { x: 10, y: 20 } },
        sceneId: ids.scene,
        sequence: 2
      }).success
    ).toBe(true)
    expect(
      sceneTransientEnvelopeDtoSchema.safeParse({
        kind: 'TOKEN_DRAG_PREVIEW',
        position: { x: 1, y: 2 },
        sequence: 1,
        tokenId: ids.token
      }).success
    ).toBe(false)
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
      outcome: null,
      pending: {
        kind: 'D20_EVIDENCE' as const,
        occurrenceId: ids.map,
        occurrenceVersion: 2,
        encounterVersion: 5,
        request: {
          requestId: 'd20',
          min: 1 as const,
          max: 20 as const,
          rollMode: 'NORMAL' as const
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
