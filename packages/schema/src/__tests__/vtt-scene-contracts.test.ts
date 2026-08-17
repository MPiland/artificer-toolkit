import { describe, expect, it } from 'vitest'

import {
  createSceneDefinitionInputDtoSchema,
  sceneCommandInputDtoSchema,
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
    map: { assetId: ids.map, height: 4_000, tileManifestAssetId: null, width: 4_000 },
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
      sceneDefinitionDtoSchema.safeParse({ ...sceneDefinition(), renderer: 'PIXI' }).success
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
      actorId: null,
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
      sceneDefinitionDtoSchema.safeParse({ ...sceneDefinition(), tokens: [token, token] }).success
    ).toBe(false)
    const { id: _id, version: _version, ...createInput } = sceneDefinition()
    expect(
      createSceneDefinitionInputDtoSchema.safeParse({ ...createInput, tokens: [token, token] })
        .success
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
        encounterId: ids.map,
        expectedSceneVersion: 3,
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
        encounterId: ids.map,
        expectedSceneVersion: 3,
        path: [{ x: 1, y: 2 }],
        sceneId: ids.scene,
        tokenId: ids.token,
        type: 'MOVE_SCENE_TOKEN'
      }).success
    ).toBe(false)
    expect(
      sceneCommandInputDtoSchema.safeParse({
        commandId: ids.campaign,
        encounterId: ids.map,
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
})
