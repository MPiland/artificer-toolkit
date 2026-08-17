import type {
  EncounterSceneState,
  SceneAnnotation,
  SceneAtomicDelta,
  SceneBarrier,
  SceneDarknessZone,
  SceneDefinition,
  SceneDelta,
  SceneEvent,
  SceneFogChunk,
  SceneFogLayer,
  SceneGrid,
  SceneLight,
  SceneMap,
  SceneMeasurement,
  ScenePoint,
  ScenePolygon,
  SceneSnapshot,
  SceneToken,
  SceneTokenVision,
  SceneTransientEnvelope
} from '@artificer-toolkit/shared/vtt'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt'
import { z } from 'zod'

const uuidSchema = z.string().uuid()
const versionSchema = z.number().int().nonnegative()
const definitionVersionSchema = z.number().int().positive()
const coordinateSchema = z.number().finite().min(-1_000_000).max(1_000_000)
const positiveDistanceSchema = z.number().finite().positive().max(1_000_000)
const degreesSchema = z.number().finite().min(0).lt(360)

function uniqueIds<T extends { id: string }>(
  values: readonly T[],
  context: z.RefinementCtx,
  path: string
): void {
  if (new Set(values.map((value) => value.id)).size !== values.length) {
    context.addIssue({ code: 'custom', path: [path], message: `${path} IDs must be unique.` })
  }
}

export const scenePointDtoSchema: z.ZodType<ScenePoint> = z.strictObject({
  x: coordinateSchema,
  y: coordinateSchema
})

export const scenePolygonDtoSchema: z.ZodType<ScenePolygon> = z.strictObject({
  points: z.array(scenePointDtoSchema).min(3).max(VTT_SCENE_LIMITS.polygonPoints)
})

export const sceneMapDtoSchema: z.ZodType<SceneMap> = z
  .strictObject({
    assetId: uuidSchema,
    height: z.number().int().positive().max(VTT_SCENE_LIMITS.mapDimension),
    tileManifestAssetId: uuidSchema.nullable(),
    width: z.number().int().positive().max(VTT_SCENE_LIMITS.mapDimension)
  })
  .superRefine((map, context) => {
    if (map.width * map.height > VTT_SCENE_LIMITS.mapPixels) {
      context.addIssue({
        code: 'custom',
        path: ['width'],
        message: `Map dimensions may not exceed ${VTT_SCENE_LIMITS.mapPixels} pixels.`
      })
    }
  })

const sceneDistanceUnitDtoSchema = z.enum(['FEET', 'METERS', 'SQUARES'])
export const sceneDiagonalPolicyDtoSchema = z.enum(['EQUAL', 'ALTERNATING', 'EUCLIDEAN'])
export const sceneGridDtoSchema: z.ZodType<SceneGrid> = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('SQUARE'),
    cellSize: positiveDistanceSchema.min(1),
    diagonalPolicy: sceneDiagonalPolicyDtoSchema,
    distancePerCell: positiveDistanceSchema,
    origin: scenePointDtoSchema,
    unit: sceneDistanceUnitDtoSchema
  }),
  z.strictObject({
    kind: z.literal('GRIDLESS'),
    pixelsPerUnit: positiveDistanceSchema,
    unit: sceneDistanceUnitDtoSchema
  })
])

export const sceneTokenVisionDtoSchema: z.ZodType<SceneTokenVision> = z.strictObject({
  angleDegrees: z.number().finite().positive().max(360),
  brightRange: z.number().finite().nonnegative().max(1_000_000),
  dimRange: z.number().finite().nonnegative().max(1_000_000),
  directionDegrees: degreesSchema,
  enabled: z.boolean()
})

export const sceneTokenDtoSchema: z.ZodType<SceneToken> = z
  .strictObject({
    actorId: uuidSchema.nullable(),
    assetId: uuidSchema.nullable(),
    controlledByUserIds: z.array(uuidSchema).max(100),
    height: positiveDistanceSchema,
    hidden: z.boolean(),
    id: uuidSchema,
    label: z.string().trim().min(1).max(160),
    locked: z.boolean(),
    position: scenePointDtoSchema,
    rotationDegrees: degreesSchema,
    vision: sceneTokenVisionDtoSchema.nullable(),
    width: positiveDistanceSchema
  })
  .superRefine((token, context) => {
    if (new Set(token.controlledByUserIds).size !== token.controlledByUserIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['controlledByUserIds'],
        message: 'Controlled user IDs must be unique.'
      })
    }
  })

const sceneBarrierBase = {
  a: scenePointDtoSchema,
  b: scenePointDtoSchema,
  id: uuidSchema
}
export const sceneBarrierDtoSchema: z.ZodType<SceneBarrier> = z
  .discriminatedUnion('kind', [
    z.strictObject({
      ...sceneBarrierBase,
      kind: z.literal('WALL'),
      blocksLight: z.boolean(),
      blocksMovement: z.boolean()
    }),
    z.strictObject({
      ...sceneBarrierBase,
      kind: z.literal('DOOR'),
      blocksLightWhenClosed: z.boolean(),
      blocksMovementWhenClosed: z.boolean(),
      initialState: z.enum(['OPEN', 'CLOSED', 'LOCKED']),
      openAngleDegrees: z.number().min(-180).max(180)
    }),
    z.strictObject({
      ...sceneBarrierBase,
      kind: z.literal('WINDOW'),
      blocksLight: z.boolean(),
      blocksMovement: z.boolean()
    }),
    z.strictObject({
      ...sceneBarrierBase,
      kind: z.literal('ONE_WAY'),
      blockedDirection: z.enum(['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT']),
      blocksLight: z.boolean(),
      blocksMovement: z.boolean()
    }),
    z.strictObject({
      ...sceneBarrierBase,
      kind: z.literal('TERRAIN'),
      movementCostMultiplier: z.number().finite().min(1).max(100)
    })
  ])
  .superRefine((barrier, context) => {
    if (barrier.a.x === barrier.b.x && barrier.a.y === barrier.b.y) {
      context.addIssue({
        code: 'custom',
        path: ['b'],
        message: 'Barrier endpoints must be different.'
      })
    }
  })

const sceneLightBase = {
  brightRadius: z.number().finite().nonnegative().max(1_000_000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  dimRadius: z.number().finite().nonnegative().max(1_000_000),
  id: uuidSchema,
  intensity: z.number().finite().min(0).max(1),
  position: scenePointDtoSchema
}
export const sceneLightDtoSchema: z.ZodType<SceneLight> = z.discriminatedUnion('kind', [
  z.strictObject({ ...sceneLightBase, kind: z.literal('POINT') }),
  z.strictObject({
    ...sceneLightBase,
    kind: z.literal('CONE'),
    angleDegrees: z.number().finite().positive().max(360),
    directionDegrees: degreesSchema
  })
])

export const sceneDarknessZoneDtoSchema: z.ZodType<SceneDarknessZone> = z.strictObject({
  id: uuidSchema,
  opacity: z.number().finite().min(0).max(1),
  polygon: scenePolygonDtoSchema
})

export const sceneAnnotationDtoSchema: z.ZodType<SceneAnnotation> = z.strictObject({
  id: uuidSchema,
  position: scenePointDtoSchema,
  text: z.string().trim().min(1).max(2_000),
  visibility: z.enum(['GM_ONLY', 'TABLE'])
})

const sceneDefinitionObject = z.strictObject({
  annotations: z.array(sceneAnnotationDtoSchema).max(VTT_SCENE_LIMITS.annotations),
  barriers: z.array(sceneBarrierDtoSchema).max(VTT_SCENE_LIMITS.barriers),
  campaignId: uuidSchema,
  darknessZones: z.array(sceneDarknessZoneDtoSchema).max(VTT_SCENE_LIMITS.darknessZones),
  fogMode: z.enum(['SHARED_PARTY', 'PER_PLAYER']),
  grid: sceneGridDtoSchema,
  id: uuidSchema,
  lights: z.array(sceneLightDtoSchema).max(VTT_SCENE_LIMITS.lights),
  map: sceneMapDtoSchema,
  name: z.string().trim().min(1).max(160),
  tokens: z.array(sceneTokenDtoSchema).max(VTT_SCENE_LIMITS.tokens),
  version: definitionVersionSchema,
  visionRevealMode: z.enum(['ON_DRAG', 'ON_DROP']).default('ON_DRAG')
})
function refineSceneStructure(
  scene: Pick<SceneDefinition, 'annotations' | 'barriers' | 'darknessZones' | 'lights' | 'tokens'>,
  context: z.RefinementCtx
): void {
  uniqueIds(scene.annotations, context, 'annotations')
  uniqueIds(scene.barriers, context, 'barriers')
  uniqueIds(scene.darknessZones, context, 'darknessZones')
  uniqueIds(scene.lights, context, 'lights')
  uniqueIds(scene.tokens, context, 'tokens')
}

export const sceneDefinitionDtoSchema: z.ZodType<SceneDefinition> =
  sceneDefinitionObject.superRefine(refineSceneStructure)

function decodedBase64Length(value: string): number {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  return (value.length * 3) / 4 - padding
}

export const sceneFogChunkDtoSchema: z.ZodType<SceneFogChunk> = z
  .strictObject({
    data: z
      .string()
      .max(50_000)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
    height: z.number().int().positive().max(VTT_SCENE_LIMITS.fogCellsPerSide),
    index: z.number().int().nonnegative().max(65_535),
    width: z.number().int().positive().max(VTT_SCENE_LIMITS.fogCellsPerSide),
    x: z
      .number()
      .int()
      .nonnegative()
      .max(VTT_SCENE_LIMITS.fogCellsPerSide - 1),
    y: z
      .number()
      .int()
      .nonnegative()
      .max(VTT_SCENE_LIMITS.fogCellsPerSide - 1)
  })
  .superRefine((chunk, context) => {
    if (decodedBase64Length(chunk.data) !== Math.ceil((chunk.width * chunk.height) / 8)) {
      context.addIssue({
        code: 'custom',
        path: ['data'],
        message: 'Fog chunk data must contain exactly one bit per cell.'
      })
    }
  })

export const sceneFogLayerDtoSchema: z.ZodType<SceneFogLayer> = z
  .strictObject({
    chunks: z.array(sceneFogChunkDtoSchema).max(256),
    height: z.number().int().positive().max(VTT_SCENE_LIMITS.fogCellsPerSide),
    ownerUserId: uuidSchema.nullable(),
    width: z.number().int().positive().max(VTT_SCENE_LIMITS.fogCellsPerSide)
  })
  .superRefine((layer, context) => {
    if (new Set(layer.chunks.map((chunk) => chunk.index)).size !== layer.chunks.length) {
      context.addIssue({
        code: 'custom',
        path: ['chunks'],
        message: 'Fog chunk indexes must be unique.'
      })
    }
    for (const [index, chunk] of layer.chunks.entries()) {
      if (chunk.x + chunk.width > layer.width || chunk.y + chunk.height > layer.height) {
        context.addIssue({
          code: 'custom',
          path: ['chunks', index],
          message: 'Fog chunks must stay within their layer.'
        })
      }
    }
  })

export const sceneMeasurementDtoSchema: z.ZodType<SceneMeasurement> = z.strictObject({
  createdByUserId: uuidSchema,
  id: uuidSchema,
  label: z.string().trim().min(1).max(160).nullable(),
  path: z.array(scenePointDtoSchema).min(2).max(VTT_SCENE_LIMITS.transientPathPoints)
})

const encounterSceneStateObject = sceneDefinitionObject
  .omit({
    id: true,
    version: true
  })
  .extend({
    definitionId: uuidSchema,
    definitionVersion: definitionVersionSchema,
    doorStates: z.record(uuidSchema, z.enum(['OPEN', 'CLOSED', 'LOCKED'])),
    encounterId: uuidSchema,
    fogLayers: z.array(sceneFogLayerDtoSchema).max(101),
    id: uuidSchema,
    measurements: z.array(sceneMeasurementDtoSchema).max(VTT_SCENE_LIMITS.measurements),
    version: versionSchema
  })
export const encounterSceneStateDtoSchema: z.ZodType<EncounterSceneState> =
  encounterSceneStateObject.superRefine((scene, context) => {
    uniqueIds(scene.annotations, context, 'annotations')
    uniqueIds(scene.barriers, context, 'barriers')
    uniqueIds(scene.darknessZones, context, 'darknessZones')
    uniqueIds(scene.lights, context, 'lights')
    uniqueIds(scene.measurements, context, 'measurements')
    uniqueIds(scene.tokens, context, 'tokens')
    const fogLayerKeys = scene.fogLayers.map((layer) => layer.ownerUserId ?? 'SHARED_PARTY')
    if (new Set(fogLayerKeys).size !== fogLayerKeys.length) {
      context.addIssue({
        code: 'custom',
        path: ['fogLayers'],
        message: 'Fog layer owners must be unique.'
      })
    }
    const doorIds = new Set(
      scene.barriers.filter((barrier) => barrier.kind === 'DOOR').map((barrier) => barrier.id)
    )
    for (const doorId of doorIds) {
      if (scene.doorStates[doorId] === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['doorStates', doorId],
          message: 'Every door barrier must have a live door state.'
        })
      }
    }
    for (const doorId of Object.keys(scene.doorStates)) {
      if (!doorIds.has(doorId)) {
        context.addIssue({
          code: 'custom',
          path: ['doorStates', doorId],
          message: 'Door state must reference a door barrier.'
        })
      }
    }
  })

const sceneAtomicDeltaDtoSchema: z.ZodType<SceneAtomicDelta> = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('TOKEN_UPSERTED'), token: sceneTokenDtoSchema }),
  z.strictObject({ kind: z.literal('TOKEN_REMOVED'), tokenId: uuidSchema }),
  z.strictObject({
    kind: z.literal('TOKEN_MOVED'),
    position: scenePointDtoSchema,
    tokenId: uuidSchema
  }),
  z.strictObject({
    kind: z.literal('TOKEN_MOVE_UNDONE'),
    position: scenePointDtoSchema,
    tokenId: uuidSchema,
    undoneCommandId: uuidSchema
  }),
  z.strictObject({
    kind: z.literal('DOOR_STATE_SET'),
    barrierId: uuidSchema,
    state: z.enum(['OPEN', 'CLOSED', 'LOCKED'])
  }),
  z.strictObject({ kind: z.literal('BARRIER_UPSERTED'), barrier: sceneBarrierDtoSchema }),
  z.strictObject({ kind: z.literal('BARRIER_REMOVED'), barrierId: uuidSchema }),
  z.strictObject({ kind: z.literal('LIGHT_UPSERTED'), light: sceneLightDtoSchema }),
  z.strictObject({ kind: z.literal('LIGHT_REMOVED'), lightId: uuidSchema }),
  z.strictObject({ kind: z.literal('DARKNESS_UPSERTED'), zone: sceneDarknessZoneDtoSchema }),
  z.strictObject({ kind: z.literal('DARKNESS_REMOVED'), zoneId: uuidSchema }),
  z.strictObject({ kind: z.literal('ANNOTATION_UPSERTED'), annotation: sceneAnnotationDtoSchema }),
  z.strictObject({ kind: z.literal('ANNOTATION_REMOVED'), annotationId: uuidSchema }),
  z.strictObject({ kind: z.literal('FOG_CHUNKS_PATCHED'), layer: sceneFogLayerDtoSchema }),
  z.strictObject({
    kind: z.literal('FOG_LAYER_REPLACED'),
    layer: sceneFogLayerDtoSchema.nullable(),
    ownerUserId: uuidSchema.nullable()
  }),
  z.strictObject({
    kind: z.literal('VISION_REVEAL_MODE_SET'),
    mode: z.enum(['ON_DRAG', 'ON_DROP'])
  }),
  z.strictObject({
    kind: z.literal('MEASUREMENT_UPSERTED'),
    measurement: sceneMeasurementDtoSchema
  }),
  z.strictObject({ kind: z.literal('MEASUREMENT_REMOVED'), measurementId: uuidSchema })
])

const sceneDeltaDtoSchemaRaw = z.union([
  sceneAtomicDeltaDtoSchema,
  z.strictObject({
    deltas: z.array(sceneAtomicDeltaDtoSchema).min(1).max(102),
    kind: z.literal('BATCH')
  })
])

export const sceneDeltaDtoSchema: z.ZodType<SceneDelta> = sceneDeltaDtoSchemaRaw.superRefine(
  (delta, context) => {
    const deltas = delta.kind === 'BATCH' ? delta.deltas : [delta]
    for (const [index, child] of deltas.entries()) {
      if (
        child.kind === 'FOG_LAYER_REPLACED' &&
        child.layer &&
        child.layer.ownerUserId !== child.ownerUserId
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Fog replacement owner must match its layer owner.',
          path:
            delta.kind === 'BATCH'
              ? ['deltas', index, 'layer', 'ownerUserId']
              : ['layer', 'ownerUserId']
        })
      }
    }
  }
)

export const sceneEventDtoSchema: z.ZodType<SceneEvent> = z.strictObject({
  actorUserId: uuidSchema,
  commandId: uuidSchema,
  delta: sceneDeltaDtoSchema,
  sceneId: uuidSchema,
  version: versionSchema
})

export const sceneSnapshotDtoSchema: z.ZodType<SceneSnapshot> = z.strictObject({
  campaignId: uuidSchema,
  scene: encounterSceneStateDtoSchema,
  sessionId: uuidSchema
})

export const sceneTransientEnvelopeDtoSchema: z.ZodType<SceneTransientEnvelope> =
  z.discriminatedUnion('kind', [
    z.strictObject({
      baselineVersion: versionSchema,
      kind: z.literal('TOKEN_DRAG_PREVIEW'),
      position: scenePointDtoSchema,
      previewUserId: uuidSchema.optional(),
      sceneId: uuidSchema,
      sequence: z.number().int().nonnegative().safe(),
      tokenId: uuidSchema
    }),
    z.strictObject({
      baselineVersion: versionSchema,
      kind: z.literal('POINTER_PREVIEW'),
      position: scenePointDtoSchema,
      sceneId: uuidSchema,
      sequence: z.number().int().nonnegative().safe()
    }),
    z.strictObject({
      baselineVersion: versionSchema,
      kind: z.literal('MEASUREMENT_PREVIEW'),
      path: z.array(scenePointDtoSchema).min(2).max(VTT_SCENE_LIMITS.transientPathPoints),
      sceneId: uuidSchema,
      sequence: z.number().int().nonnegative().safe()
    }),
    z.strictObject({
      baselineVersion: versionSchema,
      explored: z.boolean(),
      kind: z.literal('FOG_AREA_PREVIEW'),
      ownerUserId: uuidSchema.nullable(),
      rectangle: z.strictObject({ a: scenePointDtoSchema, b: scenePointDtoSchema }),
      sceneId: uuidSchema,
      sequence: z.number().int().nonnegative().safe()
    })
  ])

const sceneCommandBaseDtoSchema = z.strictObject({
  commandId: uuidSchema,
  encounterId: uuidSchema,
  expectedSceneVersion: versionSchema,
  sceneId: uuidSchema
})

export const attachEncounterSceneInputDtoSchema = z.strictObject({
  commandId: uuidSchema,
  encounterId: uuidSchema,
  sceneDefinitionId: uuidSchema,
  type: z.literal('ATTACH_SCENE')
})

export const sceneCommandInputDtoSchema = z.discriminatedUnion('type', [
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('UPSERT_SCENE_TOKEN'),
    token: sceneTokenDtoSchema
  }),
  sceneCommandBaseDtoSchema.extend({ type: z.literal('REMOVE_SCENE_TOKEN'), tokenId: uuidSchema }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('MOVE_SCENE_TOKEN'),
    tokenId: uuidSchema,
    path: z.array(scenePointDtoSchema).min(2).max(VTT_SCENE_LIMITS.transientPathPoints)
  }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('SET_SCENE_DOOR_STATE'),
    barrierId: uuidSchema,
    state: z.enum(['OPEN', 'CLOSED', 'LOCKED'])
  }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('UPSERT_SCENE_BARRIER'),
    barrier: sceneBarrierDtoSchema
  }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('REMOVE_SCENE_BARRIER'),
    barrierId: uuidSchema
  }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('UPSERT_SCENE_LIGHT'),
    light: sceneLightDtoSchema
  }),
  sceneCommandBaseDtoSchema.extend({ type: z.literal('REMOVE_SCENE_LIGHT'), lightId: uuidSchema }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('UPSERT_SCENE_DARKNESS'),
    zone: sceneDarknessZoneDtoSchema
  }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('REMOVE_SCENE_DARKNESS'),
    zoneId: uuidSchema
  }),
  sceneCommandBaseDtoSchema.extend({
    annotation: sceneAnnotationDtoSchema,
    type: z.literal('UPSERT_SCENE_ANNOTATION')
  }),
  sceneCommandBaseDtoSchema.extend({
    annotationId: uuidSchema,
    type: z.literal('REMOVE_SCENE_ANNOTATION')
  }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('PATCH_SCENE_FOG'),
    layer: sceneFogLayerDtoSchema
  }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('SET_SCENE_VISION_REVEAL_MODE'),
    mode: z.enum(['ON_DRAG', 'ON_DROP'])
  }),
  sceneCommandBaseDtoSchema.extend({ type: z.literal('UNDO_LAST_SCENE_MOVE') }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('UPSERT_SCENE_MEASUREMENT'),
    measurement: sceneMeasurementDtoSchema
  }),
  sceneCommandBaseDtoSchema.extend({
    type: z.literal('REMOVE_SCENE_MEASUREMENT'),
    measurementId: uuidSchema
  })
])

const sceneDefinitionInputObject = sceneDefinitionObject.omit({
  id: true,
  version: true
})
export const createSceneDefinitionInputDtoSchema =
  sceneDefinitionInputObject.superRefine(refineSceneStructure)
export const updateSceneDefinitionInputDtoSchema = sceneDefinitionInputObject
  .extend({
    expectedVersion: definitionVersionSchema,
    sceneId: uuidSchema
  })
  .superRefine(refineSceneStructure)
export const getCampaignSceneDefinitionsInputDtoSchema = z.strictObject({ campaignId: uuidSchema })
export const getSceneDefinitionInputDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sceneId: uuidSchema
})
export const getEncounterSceneInputDtoSchema = z.strictObject({ encounterId: uuidSchema })
export const deleteSceneDefinitionInputDtoSchema = getSceneDefinitionInputDtoSchema.extend({
  expectedVersion: definitionVersionSchema
})

export const sceneCommandResultDtoSchema = z.strictObject({
  commandId: uuidSchema,
  delta: sceneDeltaDtoSchema,
  replayed: z.boolean(),
  sceneId: uuidSchema,
  version: versionSchema
})

export const attachEncounterSceneResultDtoSchema = z.strictObject({
  replayed: z.boolean(),
  scene: encounterSceneStateDtoSchema
})

export type SceneDefinitionDto = z.infer<typeof sceneDefinitionDtoSchema>
export type EncounterSceneStateDto = z.infer<typeof encounterSceneStateDtoSchema>
export type SceneCommandInputDto = z.infer<typeof sceneCommandInputDtoSchema>
export type AttachEncounterSceneInputDto = z.infer<typeof attachEncounterSceneInputDtoSchema>
export type CreateSceneDefinitionInputDto = z.infer<typeof createSceneDefinitionInputDtoSchema>
export type UpdateSceneDefinitionInputDto = z.infer<typeof updateSceneDefinitionInputDtoSchema>
export type GetCampaignSceneDefinitionsInputDto = z.infer<
  typeof getCampaignSceneDefinitionsInputDtoSchema
>
export type GetSceneDefinitionInputDto = z.infer<typeof getSceneDefinitionInputDtoSchema>
export type GetEncounterSceneInputDto = z.infer<typeof getEncounterSceneInputDtoSchema>
export type DeleteSceneDefinitionInputDto = z.infer<typeof deleteSceneDefinitionInputDtoSchema>
export type SceneCommandResultDto = z.infer<typeof sceneCommandResultDtoSchema>
export type AttachEncounterSceneResultDto = z.infer<typeof attachEncounterSceneResultDtoSchema>
export type SceneSnapshotDto = z.infer<typeof sceneSnapshotDtoSchema>
export type SceneTransientEnvelopeDto = z.infer<typeof sceneTransientEnvelopeDtoSchema>
