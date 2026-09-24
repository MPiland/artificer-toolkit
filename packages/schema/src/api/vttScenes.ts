import type {
  CampaignSceneState,
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
} from '@artificer-toolkit/shared/vtt/scene'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import { z } from '../zod.js'

import { encounterRuleOccurrenceSummaryDtoSchema } from '../shared/encounterRuleOccurrence.js'
import { serverRuleExecutionCorrelationIdDtoSchema } from '../shared/ruleExecutionProtocol.js'
import { spatialMovementKindDtoSchema } from '../shared/spatialFacts.js'
import {
  combatPerceptionIlluminationDtoSchema,
  combatPerceptionObscurementDtoSchema
} from '../shared/combatPerception.js'

const uuidSchema = z.string().check(z.uuid())
const versionSchema = z.number().check(z.int()).check(z.nonnegative())
const definitionVersionSchema = z.number().check(z.int()).check(z.positive())
const coordinateSchema = z
  .number()
  .check(z.gte(-VTT_SCENE_LIMITS.coordinateMagnitude))
  .check(z.lte(VTT_SCENE_LIMITS.coordinateMagnitude))
const positiveDistanceSchema = z
  .number()
  .check(z.positive())
  .check(z.lte(VTT_SCENE_LIMITS.coordinateMagnitude))
const degreesSchema = z.number().check(z.gte(0)).check(z.lt(360))

function uniqueIds<T extends { id: string }>(
  values: readonly T[],
  context: z.core.$RefinementCtx,
  path: string
): void {
  if (new Set(values.map((value) => value.id)).size !== values.length) {
    context.addIssue({ code: 'custom', path: [path], message: `${path} IDs must be unique.` })
  }
}

export const scenePointDtoSchema: z.ZodMiniType<ScenePoint> = z.strictObject({
  x: coordinateSchema,
  y: coordinateSchema
})

export const scenePolygonDtoSchema: z.ZodMiniType<ScenePolygon> = z.strictObject({
  points: z
    .array(scenePointDtoSchema)
    .check(z.minLength(3))
    .check(z.maxLength(VTT_SCENE_LIMITS.polygonPoints))
})

export const sceneMapDtoSchema: z.ZodMiniType<SceneMap> = z
  .strictObject({
    assetId: uuidSchema,
    height: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(VTT_SCENE_LIMITS.mapDimension)),
    tileManifestAssetId: z.nullable(uuidSchema),
    width: z.number().check(z.int()).check(z.positive()).check(z.lte(VTT_SCENE_LIMITS.mapDimension))
  })
  .check(
    z.superRefine((map, context) => {
      if (map.width * map.height > VTT_SCENE_LIMITS.mapPixels) {
        context.addIssue({
          code: 'custom',
          path: ['width'],
          message: `Map dimensions may not exceed ${VTT_SCENE_LIMITS.mapPixels} pixels.`
        })
      }
    })
  )

const sceneDistanceUnitDtoSchema = z.enum(['FEET', 'METERS', 'SQUARES'])
export const sceneDiagonalPolicyDtoSchema = z.enum(['EQUAL', 'ALTERNATING', 'EUCLIDEAN'])
export const sceneGridDtoSchema: z.ZodMiniType<SceneGrid> = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('SQUARE'),
    cellSize: positiveDistanceSchema.check(z.gte(1)),
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

export const sceneTokenVisionDtoSchema: z.ZodMiniType<SceneTokenVision> = z.strictObject({
  angleDegrees: z.number().check(z.positive()).check(z.lte(360)),
  brightRange: z.number().check(z.nonnegative()).check(z.lte(1_000_000)),
  dimRange: z.number().check(z.nonnegative()).check(z.lte(1_000_000)),
  directionDegrees: degreesSchema,
  enabled: z.boolean()
})

export const sceneTokenDtoSchema: z.ZodMiniType<SceneToken> = z
  .strictObject({
    assetId: z.nullable(uuidSchema),
    controlledByUserIds: z.array(uuidSchema).check(z.maxLength(100)),
    height: positiveDistanceSchema,
    hidden: z.boolean(),
    id: uuidSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    locked: z.boolean(),
    position: scenePointDtoSchema,
    rotationDegrees: degreesSchema,
    vision: z.nullable(sceneTokenVisionDtoSchema),
    width: positiveDistanceSchema
  })
  .check(
    z.superRefine((token, context) => {
      if (new Set(token.controlledByUserIds).size !== token.controlledByUserIds.length) {
        context.addIssue({
          code: 'custom',
          path: ['controlledByUserIds'],
          message: 'Controlled user IDs must be unique.'
        })
      }
    })
  )

const sceneBarrierBase = {
  a: scenePointDtoSchema,
  b: scenePointDtoSchema,
  id: uuidSchema
}
export const sceneBarrierDtoSchema: z.ZodMiniType<SceneBarrier> = z
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
      openAngleDegrees: z.number().check(z.gte(-180)).check(z.lte(180))
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
      movementCostMultiplier: z.number().check(z.gte(1)).check(z.lte(100))
    })
  ])
  .check(
    z.superRefine((barrier, context) => {
      if (barrier.a.x === barrier.b.x && barrier.a.y === barrier.b.y) {
        context.addIssue({
          code: 'custom',
          path: ['b'],
          message: 'Barrier endpoints must be different.'
        })
      }
    })
  )

const sceneLightBase = {
  brightRadius: z.number().check(z.nonnegative()).check(z.lte(1_000_000)),
  color: z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/)),
  dimRadius: z.number().check(z.nonnegative()).check(z.lte(1_000_000)),
  id: uuidSchema,
  intensity: z.number().check(z.gte(0)).check(z.lte(1)),
  position: scenePointDtoSchema
}
export const sceneLightDtoSchema: z.ZodMiniType<SceneLight> = z.discriminatedUnion('kind', [
  z.strictObject({ ...sceneLightBase, kind: z.literal('POINT') }),
  z.strictObject({
    ...sceneLightBase,
    kind: z.literal('CONE'),
    angleDegrees: z.number().check(z.positive()).check(z.lte(360)),
    directionDegrees: degreesSchema
  })
])

export const sceneDarknessZoneDtoSchema: z.ZodMiniType<SceneDarknessZone> = z.strictObject({
  id: uuidSchema,
  mechanicalIllumination: z.nullable(
    z.enum([
      combatPerceptionIlluminationDtoSchema._zod.def.entries.DIM,
      combatPerceptionIlluminationDtoSchema._zod.def.entries.ORDINARY_DARKNESS,
      combatPerceptionIlluminationDtoSchema._zod.def.entries.MAGICAL_DARKNESS
    ])
  ),
  mechanicalObscurement: z.nullable(
    z.enum([
      combatPerceptionObscurementDtoSchema._zod.def.entries.LIGHT,
      combatPerceptionObscurementDtoSchema._zod.def.entries.HEAVY
    ])
  ),
  opacity: z.number().check(z.gte(0)).check(z.lte(1)),
  polygon: scenePolygonDtoSchema
})

export const sceneAnnotationDtoSchema: z.ZodMiniType<SceneAnnotation> = z.strictObject({
  id: uuidSchema,
  position: scenePointDtoSchema,
  text: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(2_000)),
  visibility: z.enum(['GM_ONLY', 'TABLE'])
})

const sceneDefinitionObject = z.strictObject({
  annotations: z.array(sceneAnnotationDtoSchema).check(z.maxLength(VTT_SCENE_LIMITS.annotations)),
  ambientIllumination: combatPerceptionIlluminationDtoSchema,
  barriers: z.array(sceneBarrierDtoSchema).check(z.maxLength(VTT_SCENE_LIMITS.barriers)),
  campaignId: uuidSchema,
  darknessZones: z
    .array(sceneDarknessZoneDtoSchema)
    .check(z.maxLength(VTT_SCENE_LIMITS.darknessZones)),
  fogMode: z.enum(['SHARED_PARTY', 'PER_PLAYER']),
  grid: sceneGridDtoSchema,
  id: uuidSchema,
  lights: z.array(sceneLightDtoSchema).check(z.maxLength(VTT_SCENE_LIMITS.lights)),
  map: sceneMapDtoSchema,
  name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
  tokens: z.array(sceneTokenDtoSchema).check(z.maxLength(VTT_SCENE_LIMITS.tokens)),
  version: definitionVersionSchema,
  visionRevealMode: z._default(z.enum(['ON_DRAG', 'ON_DROP']), 'ON_DRAG')
})
function refineSceneStructure(
  scene: Pick<SceneDefinition, 'annotations' | 'barriers' | 'darknessZones' | 'lights' | 'tokens'>,
  context: z.core.$RefinementCtx
): void {
  uniqueIds(scene.annotations, context, 'annotations')
  uniqueIds(scene.barriers, context, 'barriers')
  uniqueIds(scene.darknessZones, context, 'darknessZones')
  uniqueIds(scene.lights, context, 'lights')
  uniqueIds(scene.tokens, context, 'tokens')
}

export const sceneDefinitionDtoSchema: z.ZodMiniType<SceneDefinition> = sceneDefinitionObject.check(
  z.superRefine(refineSceneStructure)
)

function decodedBase64Length(value: string): number {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  return (value.length * 3) / 4 - padding
}

export const sceneFogChunkDtoSchema: z.ZodMiniType<SceneFogChunk> = z
  .strictObject({
    data: z
      .string()
      .check(z.maxLength(50_000))
      .check(z.regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)),
    height: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(VTT_SCENE_LIMITS.fogCellsPerSide)),
    index: z.number().check(z.int()).check(z.nonnegative()).check(z.lte(65_535)),
    width: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(VTT_SCENE_LIMITS.fogCellsPerSide)),
    x: z
      .number()
      .check(z.int())
      .check(z.nonnegative())
      .check(z.lte(VTT_SCENE_LIMITS.fogCellsPerSide - 1)),
    y: z
      .number()
      .check(z.int())
      .check(z.nonnegative())
      .check(z.lte(VTT_SCENE_LIMITS.fogCellsPerSide - 1))
  })
  .check(
    z.superRefine((chunk, context) => {
      if (decodedBase64Length(chunk.data) !== Math.ceil((chunk.width * chunk.height) / 8)) {
        context.addIssue({
          code: 'custom',
          path: ['data'],
          message: 'Fog chunk data must contain exactly one bit per cell.'
        })
      }
    })
  )

export const sceneFogLayerDtoSchema: z.ZodMiniType<SceneFogLayer> = z
  .strictObject({
    chunks: z.array(sceneFogChunkDtoSchema).check(z.maxLength(256)),
    height: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(VTT_SCENE_LIMITS.fogCellsPerSide)),
    ownerUserId: z.nullable(uuidSchema),
    width: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(VTT_SCENE_LIMITS.fogCellsPerSide))
  })
  .check(
    z.superRefine((layer, context) => {
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
  )

export const sceneMeasurementDtoSchema: z.ZodMiniType<SceneMeasurement> = z.strictObject({
  createdByUserId: uuidSchema,
  id: uuidSchema,
  label: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))),
  path: z
    .array(scenePointDtoSchema)
    .check(z.minLength(2))
    .check(z.maxLength(VTT_SCENE_LIMITS.transientPathPoints))
})

const campaignSceneStateObject = z.extend(
  z.omit(sceneDefinitionObject, {
    id: true,
    version: true
  }),
  {
    definitionId: uuidSchema,
    definitionVersion: definitionVersionSchema,
    doorStates: z.record(uuidSchema, z.enum(['OPEN', 'CLOSED', 'LOCKED'])),
    fogLayers: z.array(sceneFogLayerDtoSchema).check(z.maxLength(101)),
    id: uuidSchema,
    measurements: z
      .array(sceneMeasurementDtoSchema)
      .check(z.maxLength(VTT_SCENE_LIMITS.measurements)),
    version: versionSchema
  }
)
export const campaignSceneStateDtoSchema: z.ZodMiniType<CampaignSceneState> =
  campaignSceneStateObject.check(
    z.superRefine((scene, context) => {
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
  )

export const campaignLiveSceneSummaryDtoSchema = z.pick(campaignSceneStateObject, {
  definitionId: true,
  id: true,
  name: true,
  version: true
})

const sceneAtomicDeltaDtoSchema: z.ZodMiniType<SceneAtomicDelta> = z.discriminatedUnion('kind', [
  z.strictObject({
    illumination: combatPerceptionIlluminationDtoSchema,
    kind: z.literal('AMBIENT_ILLUMINATION_SET')
  }),
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
    layer: z.nullable(sceneFogLayerDtoSchema),
    ownerUserId: z.nullable(uuidSchema)
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
    deltas: z.array(sceneAtomicDeltaDtoSchema).check(z.minLength(1)).check(z.maxLength(102)),
    kind: z.literal('BATCH')
  })
])

export const sceneDeltaDtoSchema: z.ZodMiniType<SceneDelta> = sceneDeltaDtoSchemaRaw.check(
  z.superRefine((delta, context) => {
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
  })
)

export const sceneEventDtoSchema: z.ZodMiniType<SceneEvent> = z.strictObject({
  actorUserId: uuidSchema,
  commandId: uuidSchema,
  delta: sceneDeltaDtoSchema,
  sceneId: uuidSchema,
  version: versionSchema
})

export const sceneSnapshotDtoSchema: z.ZodMiniType<SceneSnapshot> = z.strictObject({
  campaignId: uuidSchema,
  scene: campaignSceneStateDtoSchema,
  sessionId: uuidSchema
})

export const sceneTransientEnvelopeDtoSchema: z.ZodMiniType<SceneTransientEnvelope> =
  z.discriminatedUnion('kind', [
    z.strictObject({
      baselineVersion: versionSchema,
      kind: z.literal('TOKEN_DRAG_PREVIEW'),
      position: scenePointDtoSchema,
      previewUserId: z.optional(uuidSchema),
      sceneId: uuidSchema,
      sequence: z
        .number()
        .check(z.int())
        .check(z.nonnegative())
        .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER)),
      tokenId: uuidSchema
    }),
    z.strictObject({
      baselineVersion: versionSchema,
      kind: z.literal('POINTER_PREVIEW'),
      position: scenePointDtoSchema,
      sceneId: uuidSchema,
      sequence: z
        .number()
        .check(z.int())
        .check(z.nonnegative())
        .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
    }),
    z.strictObject({
      baselineVersion: versionSchema,
      kind: z.literal('MEASUREMENT_PREVIEW'),
      path: z
        .array(scenePointDtoSchema)
        .check(z.minLength(2))
        .check(z.maxLength(VTT_SCENE_LIMITS.transientPathPoints)),
      sceneId: uuidSchema,
      sequence: z
        .number()
        .check(z.int())
        .check(z.nonnegative())
        .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
    }),
    z.strictObject({
      baselineVersion: versionSchema,
      explored: z.boolean(),
      kind: z.literal('FOG_AREA_PREVIEW'),
      ownerUserId: z.nullable(uuidSchema),
      rectangle: z.strictObject({ a: scenePointDtoSchema, b: scenePointDtoSchema }),
      sceneId: uuidSchema,
      sequence: z
        .number()
        .check(z.int())
        .check(z.nonnegative())
        .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
    })
  ])

const sceneCommandBaseDtoSchema = z.strictObject({
  commandId: uuidSchema,
  expectedSceneVersion: versionSchema,
  sceneId: uuidSchema
})

export const sceneAnnotationUpsertInputDtoSchema = z.extend(sceneCommandBaseDtoSchema, {
  annotation: sceneAnnotationDtoSchema,
  type: z.literal('UPSERT_SCENE_ANNOTATION')
})
export const sceneAnnotationRemoveInputDtoSchema = z.extend(sceneCommandBaseDtoSchema, {
  annotationId: uuidSchema,
  type: z.literal('REMOVE_SCENE_ANNOTATION')
})

export const bindEncounterToPresentedSceneInputDtoSchema = z.strictObject({
  commandId: uuidSchema,
  encounterId: uuidSchema,
  type: z.literal('BIND_ENCOUNTER_TO_PRESENTED_SCENE')
})

export const setCampaignLiveScenePresentationInputDtoSchema = z.strictObject({
  commandId: uuidSchema,
  expectedPresentationVersion: z.nullable(versionSchema),
  sceneId: z.nullable(uuidSchema),
  sessionId: uuidSchema,
  type: z.literal('SET_CAMPAIGN_LIVE_SCENE_PRESENTATION')
})

export const encounterSceneActorTokenBindingDtoSchema = z.strictObject({
  actorId: uuidSchema,
  encounterId: uuidSchema,
  sceneId: uuidSchema,
  tokenId: uuidSchema
})

export const setEncounterSceneActorTokenBindingInputDtoSchema = z.strictObject({
  actorId: uuidSchema,
  commandId: uuidSchema,
  encounterId: uuidSchema,
  expectedEncounterVersion: versionSchema,
  sceneId: uuidSchema,
  tokenId: uuidSchema,
  type: z.literal('SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING')
})

export const removeEncounterSceneActorTokenBindingInputDtoSchema = z.strictObject({
  actorId: uuidSchema,
  commandId: uuidSchema,
  encounterId: uuidSchema,
  expectedEncounterVersion: versionSchema,
  sceneId: uuidSchema,
  type: z.literal('REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING')
})
export const encounterActorTokenBindingCommandInputDtoSchema = z.union([
  setEncounterSceneActorTokenBindingInputDtoSchema,
  removeEncounterSceneActorTokenBindingInputDtoSchema
])

export const LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND = 'VISUAL_ONLY_DARKNESS_V0' as const

const currentSceneDarknessCommandInputDtoSchema = z.extend(sceneCommandBaseDtoSchema, {
  legacyReplayKind: z.optional(z.literal(LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND)),
  type: z.literal('UPSERT_SCENE_DARKNESS'),
  zone: sceneDarknessZoneDtoSchema
})

const legacyVisualOnlyDarknessCommandInputDtoSchema = z.pipe(
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('UPSERT_SCENE_DARKNESS'),
    zone: z.strictObject({
      id: uuidSchema,
      opacity: z.number().check(z.gte(0)).check(z.lte(1)),
      polygon: scenePolygonDtoSchema
    })
  }),
  z.transform((command) => ({
    ...command,
    legacyReplayKind: LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND,
    zone: {
      id: command.zone.id,
      mechanicalIllumination: null,
      mechanicalObscurement: null,
      opacity: command.zone.opacity,
      polygon: command.zone.polygon
    }
  }))
)

const sceneLiveCommandSchemas = [
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('UPSERT_SCENE_MEASUREMENT'),
    measurement: sceneMeasurementDtoSchema
  }),
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('REMOVE_SCENE_MEASUREMENT'),
    measurementId: uuidSchema
  }),
  z.extend(sceneCommandBaseDtoSchema, {
    illumination: combatPerceptionIlluminationDtoSchema,
    type: z.literal('SET_SCENE_AMBIENT_ILLUMINATION')
  }),
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('SET_SCENE_VISION_REVEAL_MODE'),
    mode: z.enum(['ON_DRAG', 'ON_DROP'])
  }),
  sceneAnnotationUpsertInputDtoSchema,
  sceneAnnotationRemoveInputDtoSchema,
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('UPSERT_SCENE_LIGHT'),
    light: sceneLightDtoSchema
  }),
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('REMOVE_SCENE_LIGHT'),
    lightId: uuidSchema
  }),
  currentSceneDarknessCommandInputDtoSchema,
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('REMOVE_SCENE_DARKNESS'),
    zoneId: uuidSchema
  })
] as const
export const sceneLiveCommandInputDtoSchema = z.discriminatedUnion('type', sceneLiveCommandSchemas)

export const sceneTokenMovementCommandInputDtoSchema = z
  .extend(sceneCommandBaseDtoSchema, {
    type: z.literal('MOVE_SCENE_TOKEN'),
    expectedEncounterVersion: z.nullable(versionSchema),
    correlationId: z._default(serverRuleExecutionCorrelationIdDtoSchema, null),
    movementKind: spatialMovementKindDtoSchema,
    tokenId: uuidSchema,
    path: z
      .array(scenePointDtoSchema)
      .check(z.minLength(2))
      .check(z.maxLength(VTT_SCENE_LIMITS.transientPathPoints))
  })
  .check(
    z.superRefine((command, context) => {
      if (command.movementKind === 'TELEPORT' && command.path.length !== 2)
        context.addIssue({
          code: 'custom',
          path: ['path'],
          message: 'Teleport movement requires exactly its origin and destination.'
        })
      let totalDistance = 0
      for (let index = 1; index < command.path.length; index += 1) {
        const start = command.path[index - 1]!
        const end = command.path[index]!
        totalDistance += Math.hypot(end.x - start.x, end.y - start.y)
      }
      if (totalDistance <= 1e-8)
        context.addIssue({
          code: 'custom',
          path: ['path'],
          message: 'Movement requires a non-zero authoritative path length.'
        })
    })
  )

export const sceneDoorStateCommandInputDtoSchema = z.extend(sceneCommandBaseDtoSchema, {
  type: z.literal('SET_SCENE_DOOR_STATE'),
  barrierId: uuidSchema,
  state: z.enum(['OPEN', 'CLOSED', 'LOCKED'])
})

const sceneGeometryCommandSchemas = [
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('UPSERT_SCENE_TOKEN'),
    token: sceneTokenDtoSchema
  }),
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('REMOVE_SCENE_TOKEN'),
    tokenId: uuidSchema
  }),
  sceneDoorStateCommandInputDtoSchema,

  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('UPSERT_SCENE_BARRIER'),
    barrier: sceneBarrierDtoSchema
  }),
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('REMOVE_SCENE_BARRIER'),
    barrierId: uuidSchema
  })
] as const
export const sceneGeometryCommandInputDtoSchema = z.discriminatedUnion(
  'type',
  sceneGeometryCommandSchemas
)

export const sceneUndoLastMoveCommandInputDtoSchema = z.extend(sceneCommandBaseDtoSchema, {
  type: z.literal('UNDO_LAST_SCENE_MOVE')
})

const currentSceneCommandInputDtoSchema = z.discriminatedUnion('type', [
  ...sceneGeometryCommandSchemas,
  sceneTokenMovementCommandInputDtoSchema,
  ...sceneLiveCommandSchemas,
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('PATCH_SCENE_FOG'),
    layer: sceneFogLayerDtoSchema
  }),
  sceneUndoLastMoveCommandInputDtoSchema
])

export const sceneCommandInputDtoSchema = z.union([
  currentSceneCommandInputDtoSchema,
  legacyVisualOnlyDarknessCommandInputDtoSchema
])

const sceneDefinitionInputObject = z.omit(sceneDefinitionObject, {
  id: true,
  version: true
})
// Native authoring transports independently bounded entity batches. These settings
// retain the exact definition contract while arrays keep their existing limits.
export const sceneDefinitionSettingsDtoSchema = z.omit(sceneDefinitionInputObject, {
  annotations: true,
  barriers: true,
  darknessZones: true,
  lights: true,
  tokens: true
})
export const createSceneDefinitionInputDtoSchema = sceneDefinitionInputObject.check(
  z.superRefine(refineSceneStructure)
)
export const updateSceneDefinitionInputDtoSchema = z
  .extend(sceneDefinitionInputObject, {
    expectedVersion: definitionVersionSchema,
    sceneId: uuidSchema
  })
  .check(z.superRefine(refineSceneStructure))
export const getCampaignSceneDefinitionsInputDtoSchema = z.strictObject({ campaignId: uuidSchema })
export const listCampaignLiveScenesInputDtoSchema = z.strictObject({ campaignId: uuidSchema })
export const getSceneDefinitionInputDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sceneId: uuidSchema
})
export const getCampaignLiveSceneInputDtoSchema = z.strictObject({ sceneId: uuidSchema })
export const deleteSceneDefinitionInputDtoSchema = z.extend(getSceneDefinitionInputDtoSchema, {
  expectedVersion: definitionVersionSchema
})

export const sceneCommandResultDtoSchema = z
  .strictObject({
    commandId: uuidSchema,
    delta: z.nullable(sceneDeltaDtoSchema),
    occurrence: z._default(z.nullable(encounterRuleOccurrenceSummaryDtoSchema), null),
    replayed: z.boolean(),
    sceneId: uuidSchema,
    version: versionSchema
  })
  .check(
    z.superRefine((result, context) => {
      if (result.delta === null && result.occurrence === null)
        context.addIssue({
          code: 'custom',
          path: ['delta'],
          message:
            'A Scene command may omit its delta only when an Encounter rule occurrence owns the mechanics result.'
        })
    })
  )

export const bindEncounterToPresentedSceneResultDtoSchema = z.strictObject({
  commandId: uuidSchema,
  encounterId: uuidSchema,
  replayed: z.boolean(),
  sceneId: uuidSchema
})

export const setCampaignLiveScenePresentationResultDtoSchema = z.strictObject({
  commandId: uuidSchema,
  replayed: z.boolean(),
  sceneId: z.nullable(uuidSchema),
  sessionId: uuidSchema,
  version: versionSchema
})
export const campaignSessionScenePresentationDtoSchema = z.omit(
  setCampaignLiveScenePresentationResultDtoSchema,
  { commandId: true, replayed: true }
)
export const getCampaignSessionScenePresentationInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})

/** Server-only durable campaign-event payload for a Session presentation command. */
export const campaignLiveScenePresentationReceiptDtoSchema = z.strictObject({
  commandFingerprint: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
  result: setCampaignLiveScenePresentationResultDtoSchema
})

export type SceneDefinitionDto = z.infer<typeof sceneDefinitionDtoSchema>
export type CampaignSceneStateDto = z.infer<typeof campaignSceneStateDtoSchema>
export type CampaignLiveSceneSummaryDto = z.infer<typeof campaignLiveSceneSummaryDtoSchema>
export type SceneCommandInputDto = z.infer<typeof sceneCommandInputDtoSchema>
export type SceneGeometryCommandInputDto = z.infer<typeof sceneGeometryCommandInputDtoSchema>
export type SceneLiveCommandInputDto = z.infer<typeof sceneLiveCommandInputDtoSchema>
export type BindEncounterToPresentedSceneInputDto = z.infer<
  typeof bindEncounterToPresentedSceneInputDtoSchema
>
export type SetCampaignLiveScenePresentationInputDto = z.infer<
  typeof setCampaignLiveScenePresentationInputDtoSchema
>
export type EncounterSceneActorTokenBindingDto = z.infer<
  typeof encounterSceneActorTokenBindingDtoSchema
>
export type SetEncounterSceneActorTokenBindingInputDto = z.infer<
  typeof setEncounterSceneActorTokenBindingInputDtoSchema
>
export type RemoveEncounterSceneActorTokenBindingInputDto = z.infer<
  typeof removeEncounterSceneActorTokenBindingInputDtoSchema
>
export type EncounterActorTokenBindingCommandInputDto = z.infer<
  typeof encounterActorTokenBindingCommandInputDtoSchema
>
export type CreateSceneDefinitionInputDto = z.infer<typeof createSceneDefinitionInputDtoSchema>
export type UpdateSceneDefinitionInputDto = z.infer<typeof updateSceneDefinitionInputDtoSchema>
export type GetCampaignSceneDefinitionsInputDto = z.infer<
  typeof getCampaignSceneDefinitionsInputDtoSchema
>
export type ListCampaignLiveScenesInputDto = z.infer<typeof listCampaignLiveScenesInputDtoSchema>
export type GetSceneDefinitionInputDto = z.infer<typeof getSceneDefinitionInputDtoSchema>
export type GetCampaignLiveSceneInputDto = z.infer<typeof getCampaignLiveSceneInputDtoSchema>
export type DeleteSceneDefinitionInputDto = z.infer<typeof deleteSceneDefinitionInputDtoSchema>
export type SceneCommandResultDto = z.infer<typeof sceneCommandResultDtoSchema>
export type SceneDoorStateCommandInputDto = z.infer<typeof sceneDoorStateCommandInputDtoSchema>
export type BindEncounterToPresentedSceneResultDto = z.infer<
  typeof bindEncounterToPresentedSceneResultDtoSchema
>
export type SetCampaignLiveScenePresentationResultDto = z.infer<
  typeof setCampaignLiveScenePresentationResultDtoSchema
>
export type CampaignSessionScenePresentationDto = z.infer<
  typeof campaignSessionScenePresentationDtoSchema
>
export type CampaignLiveScenePresentationReceiptDto = z.infer<
  typeof campaignLiveScenePresentationReceiptDtoSchema
>
export type SceneSnapshotDto = z.infer<typeof sceneSnapshotDtoSchema>
export type SceneTransientEnvelopeDto = z.infer<typeof sceneTransientEnvelopeDtoSchema>
