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
  SceneToken,
  SceneTokenSense,
  SceneTokenVision,
  SceneTransientEnvelope
} from '@artificer-toolkit/shared/vtt/scene'
import {
  SCENE_LENGTH_AMOUNT_MAX,
  sceneFogOwnerKey,
  VTT_SCENE_LIMITS
} from '@artificer-toolkit/shared/vtt/scene'
import { z, lazySchema, lazySchemaParts } from '../zod.js'

import { encounterRuleOccurrenceSummaryDtoSchema } from '../shared/encounterRuleOccurrence.js'
import { encounterAcknowledgedRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import { serverRuleExecutionCorrelationIdDtoSchema } from '../shared/ruleExecutionProtocol.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { spatialMovementKindDtoSchema } from '../shared/spatialFacts.js'
import {
  combatPerceptionChannelDtoSchema,
  combatPerceptionIlluminationAccessDtoSchema,
  combatPerceptionIlluminationDtoSchema,
  combatPerceptionObscurementDtoSchema
} from '../shared/combatPerception.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))
// Token and Barrier IDs key live Scene entities by lowercase ID, so their spelling is canonical.
const sceneEntityIdSchema = lazySchema(() => z.string().check(z.uuid()).check(z.lowercase()))
const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
const definitionVersionSchema = lazySchema(() => z.number().check(z.int()).check(z.positive()))
const coordinateSchema = lazySchema(() =>
  z
    .number()
    .check(z.gte(-VTT_SCENE_LIMITS.coordinateMagnitude))
    .check(z.lte(VTT_SCENE_LIMITS.coordinateMagnitude))
)
const positiveDistanceSchema = lazySchema(() =>
  z.number().check(z.positive()).check(z.lte(VTT_SCENE_LIMITS.coordinateMagnitude))
)
const degreesSchema = lazySchema(() => z.number().check(z.gte(0)).check(z.lt(360)))
const sceneFogModeSchema = lazySchema(() => z.enum(['OFF', 'SHARED_PARTY', 'PER_PLAYER']))

function uniqueIds<T extends { id: string }>(
  values: readonly T[],
  context: z.core.$RefinementCtx,
  path: string
): void {
  if (new Set(values.map((value) => value.id)).size !== values.length) {
    context.addIssue({ code: 'custom', path: [path], message: `${path} IDs must be unique.` })
  }
}

export const scenePointDtoSchema: z.ZodMiniType<ScenePoint> = lazySchema(() =>
  z.strictObject({
    x: coordinateSchema,
    y: coordinateSchema
  })
)

export const scenePolygonDtoSchema: z.ZodMiniType<ScenePolygon> = lazySchema(() =>
  z.strictObject({
    points: z
      .array(scenePointDtoSchema)
      .check(z.minLength(3))
      .check(z.maxLength(VTT_SCENE_LIMITS.polygonPoints))
  })
)

export const sceneMapDtoSchema: z.ZodMiniType<SceneMap> = lazySchema(() =>
  z
    .strictObject({
      assetId: uuidSchema,
      height: z
        .number()
        .check(z.int())
        .check(z.positive())
        .check(z.lte(VTT_SCENE_LIMITS.mapDimension)),
      tileManifestAssetId: z.nullable(uuidSchema),
      width: z
        .number()
        .check(z.int())
        .check(z.positive())
        .check(z.lte(VTT_SCENE_LIMITS.mapDimension))
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
)

const sceneDistanceUnitDtoSchema = lazySchema(() => z.enum(['FEET', 'METERS', 'SQUARES']))
export const sceneDiagonalPolicyDtoSchema = lazySchema(() =>
  z.enum(['EQUAL', 'ALTERNATING', 'EUCLIDEAN'])
)
export const sceneGridDtoSchema: z.ZodMiniType<SceneGrid> = lazySchema(() => {
  const squareGridFields = {
    kind: z.literal('SQUARE'),
    cellSize: positiveDistanceSchema.check(z.gte(1)),
    diagonalPolicy: sceneDiagonalPolicyDtoSchema,
    origin: scenePointDtoSchema
  }
  return z.discriminatedUnion('kind', [
    z.discriminatedUnion('unit', [
      z.strictObject({
        ...squareGridFields,
        distancePerCell: positiveDistanceSchema,
        unit: z.enum(['FEET', 'METERS'])
      }),
      z.strictObject({
        ...squareGridFields,
        distancePerCell: z.literal(1),
        unit: z.literal('SQUARES')
      })
    ]),
    z.strictObject({
      kind: z.literal('GRIDLESS'),
      pixelsPerUnit: positiveDistanceSchema,
      unit: sceneDistanceUnitDtoSchema
    })
  ])
})

export const sceneTokenVisionDtoSchema: z.ZodMiniType<SceneTokenVision> = lazySchema(() =>
  z.strictObject({
    angleDegrees: z.number().check(z.positive()).check(z.lte(360)),
    brightRange: z.number().check(z.nonnegative()).check(z.lte(SCENE_LENGTH_AMOUNT_MAX)),
    dimRange: z.number().check(z.nonnegative()).check(z.lte(SCENE_LENGTH_AMOUNT_MAX)),
    directionDegrees: degreesSchema,
    enabled: z.boolean()
  })
)

export const sceneTokenSenseDtoSchema: z.ZodMiniType<SceneTokenSense> = lazySchema(() =>
  z.strictObject({
    channel: combatPerceptionChannelDtoSchema,
    illuminationAccess: combatPerceptionIlluminationAccessDtoSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    range: z.union([
      z.strictObject({ rangeKind: z.literal('UNLIMITED') }),
      z.strictObject({
        rangeKind: z.literal('DISTANCE'),
        amount: z.number().check(z.positive()).check(z.lte(SCENE_LENGTH_AMOUNT_MAX))
      })
    ]),
    senseId: postgresUuidSchema
  })
)

export const sceneTokenDtoSchema: z.ZodMiniType<SceneToken> = lazySchema(() =>
  z
    .strictObject({
      assetId: z.nullable(uuidSchema),
      characterId: z.optional(uuidSchema),
      controlledByUserIds: z.array(uuidSchema).check(z.maxLength(100)),
      height: positiveDistanceSchema,
      hidden: z.boolean(),
      id: sceneEntityIdSchema,
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      light: z.optional(
        z
          .strictObject({
            brightRadius: z.number().check(z.nonnegative()).check(z.lte(SCENE_LENGTH_AMOUNT_MAX)),
            dimRadius: z.number().check(z.positive()).check(z.lte(SCENE_LENGTH_AMOUNT_MAX))
          })
          .check(
            z.refine((light) => light.dimRadius >= light.brightRadius, {
              message: 'Token dim light must reach at least as far as its bright light.'
            })
          )
      ),
      locked: z.boolean(),
      position: scenePointDtoSchema,
      rotationDegrees: degreesSchema,
      senses: z.array(sceneTokenSenseDtoSchema).check(z.maxLength(100)),
      passesBlockingBarriers: z.optional(z.literal(true)),
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
)

// Senses and light are composed at runtime and never stored; every storage write parses through this variant.
export const sceneStoredTokenDtoSchema: z.ZodMiniType<SceneToken> = lazySchema(() =>
  sceneTokenDtoSchema.check(
    z.refine((token) => token.senses.length === 0, {
      message: 'Stored Scene tokens never carry senses.',
      path: ['senses']
    }),
    z.refine((token) => token.light === undefined, {
      message: 'Stored Scene tokens never carry light.',
      path: ['light']
    })
  )
)

const sceneBarrierBase = {
  a: scenePointDtoSchema,
  b: scenePointDtoSchema,
  id: sceneEntityIdSchema
}
export const sceneBarrierDtoSchema: z.ZodMiniType<SceneBarrier> = lazySchema(() =>
  z
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
)

const sceneLightBase = lazySchemaParts(() => ({
  brightRadius: z.number().check(z.nonnegative()).check(z.lte(SCENE_LENGTH_AMOUNT_MAX)),
  color: z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/)),
  dimRadius: z.number().check(z.nonnegative()).check(z.lte(SCENE_LENGTH_AMOUNT_MAX)),
  id: uuidSchema,
  intensity: z.number().check(z.gte(0)).check(z.lte(1)),
  position: scenePointDtoSchema
}))
export const sceneLightDtoSchema: z.ZodMiniType<SceneLight> = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ ...sceneLightBase(), kind: z.literal('POINT') }),
    z.strictObject({
      ...sceneLightBase(),
      kind: z.literal('CONE'),
      angleDegrees: z.number().check(z.positive()).check(z.lte(360)),
      directionDegrees: degreesSchema
    })
  ])
)

export const sceneDarknessZoneDtoSchema: z.ZodMiniType<SceneDarknessZone> = lazySchema(() =>
  z.strictObject({
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
)

export const sceneAnnotationDtoSchema: z.ZodMiniType<SceneAnnotation> = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    position: scenePointDtoSchema,
    text: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(2_000)),
    visibility: z.enum(['GM_ONLY', 'TABLE'])
  })
)

const sceneDefinitionObject = lazySchema(() =>
  z.strictObject({
    annotations: z.array(sceneAnnotationDtoSchema).check(z.maxLength(VTT_SCENE_LIMITS.annotations)),
    ambientIllumination: combatPerceptionIlluminationDtoSchema,
    barriers: z.array(sceneBarrierDtoSchema).check(z.maxLength(VTT_SCENE_LIMITS.barriers)),
    campaignId: uuidSchema,
    /** The Scene is lit by the sun; sunlight at a square is daylight and BRIGHT illumination there. */
    daylight: z._default(z.boolean(), false),
    darknessZones: z
      .array(sceneDarknessZoneDtoSchema)
      .check(z.maxLength(VTT_SCENE_LIMITS.darknessZones)),
    fogMode: sceneFogModeSchema,
    grid: sceneGridDtoSchema,
    id: uuidSchema,
    lights: z.array(sceneLightDtoSchema).check(z.maxLength(VTT_SCENE_LIMITS.lights)),
    map: sceneMapDtoSchema,
    name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    tokens: z.array(sceneTokenDtoSchema).check(z.maxLength(VTT_SCENE_LIMITS.tokens)),
    version: definitionVersionSchema,
    visionRevealMode: z._default(z.enum(['ON_DRAG', 'ON_DROP']), 'ON_DRAG')
  })
)
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

export const sceneDefinitionDtoSchema: z.ZodMiniType<SceneDefinition> = lazySchema(() =>
  sceneDefinitionObject.check(z.superRefine(refineSceneStructure))
)

function decodedBase64Length(value: string): number {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  return (value.length * 3) / 4 - padding
}

export const sceneFogChunkDtoSchema: z.ZodMiniType<SceneFogChunk> = lazySchema(() =>
  z
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
)

export const sceneFogLayerDtoSchema: z.ZodMiniType<SceneFogLayer> = lazySchema(() =>
  z
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
)

export const sceneMeasurementDtoSchema: z.ZodMiniType<SceneMeasurement> = lazySchema(() =>
  z.strictObject({
    createdByUserId: uuidSchema,
    id: uuidSchema,
    label: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))),
    path: z
      .array(scenePointDtoSchema)
      .check(z.minLength(2))
      .check(z.maxLength(VTT_SCENE_LIMITS.transientPathPoints))
  })
)

const campaignSceneStateObject = lazySchema(() =>
  z.extend(
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
)
export const campaignSceneStateDtoSchema: z.ZodMiniType<CampaignSceneState> = lazySchema(() =>
  campaignSceneStateObject.check(
    z.superRefine((scene, context) => {
      uniqueIds(scene.annotations, context, 'annotations')
      uniqueIds(scene.barriers, context, 'barriers')
      uniqueIds(scene.darknessZones, context, 'darknessZones')
      uniqueIds(scene.lights, context, 'lights')
      uniqueIds(scene.measurements, context, 'measurements')
      uniqueIds(scene.tokens, context, 'tokens')
      const fogLayerKeys = scene.fogLayers.map((layer) => sceneFogOwnerKey(layer.ownerUserId))
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
)

export const campaignLiveSceneSummaryDtoSchema = lazySchema(() =>
  z.pick(campaignSceneStateObject, {
    definitionId: true,
    id: true,
    name: true,
    version: true
  })
)

const sceneAtomicDeltaDtoSchema: z.ZodMiniType<SceneAtomicDelta> = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      daylight: z.boolean(),
      illumination: combatPerceptionIlluminationDtoSchema,
      kind: z.literal('AMBIENT_ILLUMINATION_SET')
    }),
    z.strictObject({ kind: z.literal('TOKEN_UPSERTED'), token: sceneTokenDtoSchema }),
    z.strictObject({ kind: z.literal('TOKEN_REMOVED'), tokenId: uuidSchema }),
    z.strictObject({
      kind: z.literal('TOKEN_MOVED'),
      position: scenePointDtoSchema,
      rotationDegrees: z.optional(degreesSchema),
      tokenId: uuidSchema
    }),
    z.strictObject({
      kind: z.literal('TOKEN_MOVE_UNDONE'),
      position: scenePointDtoSchema,
      rotationDegrees: z.optional(degreesSchema),
      tokenId: uuidSchema,
      undoneCommandId: uuidSchema
    }),
    z.strictObject({
      kind: z.literal('TOKEN_FACING_SET'),
      rotationDegrees: degreesSchema,
      tokenId: uuidSchema
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
    z.strictObject({
      kind: z.literal('ANNOTATION_UPSERTED'),
      annotation: sceneAnnotationDtoSchema
    }),
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
    z.strictObject({ kind: z.literal('FOG_MODE_SET'), mode: sceneFogModeSchema }),
    z.strictObject({
      kind: z.literal('MEASUREMENT_UPSERTED'),
      measurement: sceneMeasurementDtoSchema
    }),
    z.strictObject({ kind: z.literal('MEASUREMENT_REMOVED'), measurementId: uuidSchema })
  ])
)

const sceneDeltaDtoSchemaRaw = lazySchema(() =>
  z.union([
    sceneAtomicDeltaDtoSchema,
    z.strictObject({
      deltas: z.array(sceneAtomicDeltaDtoSchema).check(z.minLength(1)).check(z.maxLength(102)),
      kind: z.literal('BATCH')
    })
  ])
)

export const sceneDeltaDtoSchema: z.ZodMiniType<SceneDelta> = lazySchema(() =>
  sceneDeltaDtoSchemaRaw.check(
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
)

export const sceneEventDtoSchema: z.ZodMiniType<SceneEvent> = lazySchema(() =>
  z.strictObject({
    actorUserId: uuidSchema,
    commandId: uuidSchema,
    delta: sceneDeltaDtoSchema,
    sceneId: uuidSchema,
    version: versionSchema
  })
)

const sceneTransientAudienceSchema = lazySchema(() => z.enum(['GM', 'TABLE']))

export const sceneTransientEnvelopeDtoSchema: z.ZodMiniType<SceneTransientEnvelope> = lazySchema(
  () =>
    z.discriminatedUnion('kind', [
      z.strictObject({
        audience: sceneTransientAudienceSchema,
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
        audience: sceneTransientAudienceSchema,
        baselineVersion: versionSchema,
        kind: z.literal('PING'),
        position: scenePointDtoSchema,
        sceneId: uuidSchema,
        sequence: z
          .number()
          .check(z.int())
          .check(z.nonnegative())
          .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      }),
      z.strictObject({
        audience: sceneTransientAudienceSchema,
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
        audience: sceneTransientAudienceSchema,
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
)

const sceneCommandBaseDtoSchema = lazySchema(() =>
  z.strictObject({
    commandId: uuidSchema,
    expectedSceneVersion: versionSchema,
    sceneId: uuidSchema
  })
)

export const sceneAnnotationUpsertInputDtoSchema = lazySchema(() =>
  z.extend(sceneCommandBaseDtoSchema, {
    annotation: sceneAnnotationDtoSchema,
    type: z.literal('UPSERT_SCENE_ANNOTATION')
  })
)
export const sceneAnnotationRemoveInputDtoSchema = lazySchema(() =>
  z.extend(sceneCommandBaseDtoSchema, {
    annotationId: uuidSchema,
    type: z.literal('REMOVE_SCENE_ANNOTATION')
  })
)

export const bindEncounterToPresentedSceneInputDtoSchema = lazySchema(() =>
  z.strictObject({
    commandId: uuidSchema,
    encounterId: uuidSchema,
    type: z.literal('BIND_ENCOUNTER_TO_PRESENTED_SCENE')
  })
)

export const setCampaignLiveScenePresentationInputDtoSchema = lazySchema(() =>
  z.strictObject({
    commandId: uuidSchema,
    expectedPresentationVersion: z.nullable(versionSchema),
    campaignId: uuidSchema,
    sceneId: z.nullable(uuidSchema),
    type: z.literal('SET_CAMPAIGN_LIVE_SCENE_PRESENTATION')
  })
)

export const encounterSceneActorTokenBindingDtoSchema = lazySchema(() =>
  z.strictObject({
    actorId: uuidSchema,
    encounterId: uuidSchema,
    sceneId: uuidSchema,
    tokenId: uuidSchema
  })
)

export const setEncounterSceneActorTokenBindingInputDtoSchema = lazySchema(() =>
  z.strictObject({
    actorId: uuidSchema,
    commandId: uuidSchema,
    encounterId: uuidSchema,
    expectedEncounterVersion: versionSchema,
    sceneId: uuidSchema,
    tokenId: uuidSchema,
    type: z.literal('SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING')
  })
)

export const removeEncounterSceneActorTokenBindingInputDtoSchema = lazySchema(() =>
  z.strictObject({
    actorId: uuidSchema,
    commandId: uuidSchema,
    encounterId: uuidSchema,
    expectedEncounterVersion: versionSchema,
    sceneId: uuidSchema,
    type: z.literal('REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING')
  })
)
export const encounterActorTokenBindingCommandInputDtoSchema = lazySchema(() =>
  z.union([
    setEncounterSceneActorTokenBindingInputDtoSchema,
    removeEncounterSceneActorTokenBindingInputDtoSchema
  ])
)

export const LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND = 'VISUAL_ONLY_DARKNESS_V0' as const

const currentSceneDarknessCommandInputDtoSchema = lazySchema(() =>
  z.extend(sceneCommandBaseDtoSchema, {
    legacyReplayKind: z.optional(z.literal(LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND)),
    type: z.literal('UPSERT_SCENE_DARKNESS'),
    zone: sceneDarknessZoneDtoSchema
  })
)

const legacyVisualOnlyDarknessCommandInputDtoSchema = lazySchema(() =>
  z.pipe(
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
)

const sceneLiveCommandSchemas = lazySchemaParts(
  () =>
    [
      z.extend(sceneCommandBaseDtoSchema, {
        type: z.literal('UPSERT_SCENE_MEASUREMENT'),
        measurement: sceneMeasurementDtoSchema
      }),
      z.extend(sceneCommandBaseDtoSchema, {
        type: z.literal('REMOVE_SCENE_MEASUREMENT'),
        measurementId: uuidSchema
      }),
      z.extend(sceneCommandBaseDtoSchema, {
        daylight: z.boolean(),
        illumination: combatPerceptionIlluminationDtoSchema,
        type: z.literal('SET_SCENE_AMBIENT_ILLUMINATION')
      }),
      z.extend(sceneCommandBaseDtoSchema, {
        type: z.literal('SET_SCENE_VISION_REVEAL_MODE'),
        mode: z.enum(['ON_DRAG', 'ON_DROP'])
      }),
      z.extend(sceneCommandBaseDtoSchema, {
        type: z.literal('SET_SCENE_FOG_MODE'),
        mode: sceneFogModeSchema
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
)
export const sceneLiveCommandInputDtoSchema = lazySchema(() =>
  z.discriminatedUnion('type', sceneLiveCommandSchemas())
)

export const sceneTokenMovementCommandInputDtoSchema = lazySchema(() =>
  z
    .extend(sceneCommandBaseDtoSchema, {
      type: z.literal('MOVE_SCENE_TOKEN'),
      expectedEncounterVersion: z.nullable(versionSchema),
      correlationId: z._default(serverRuleExecutionCorrelationIdDtoSchema, null),
      movementKind: spatialMovementKindDtoSchema,
      /**
       * The speed type a voluntary move uses (SPELLS-5.6), which an Encounter turn records as the
       * actor's latest. Absent or null when the move names none; only a voluntary move can name one.
       */
      speedId: z.optional(z.nullable(authoredIdentifierSchema)),
      /**
       * The mover chose to move carefully (SPELLS-17, decisions Q2): every square of the path inside a
       * field that allows passage at half speed costs double movement, and that field's entry save is
       * skipped. Absent or false is moving normally, with the save. Only voluntary movement can choose.
       */
      carefully: z.optional(z.boolean()),
      /** The rule warnings the mover overrides with "Do it anyway" (ADR 0034); absent is none. */
      acknowledgedWarnings: z.optional(encounterAcknowledgedRuleWarningsDtoSchema),
      /**
       * The facing a voluntary Encounter move ends in, when the Encounter's Facing rule is on
       * (ATTACK-12). The room checks the rule and its facing step; absent keeps the token's facing.
       */
      facingDegrees: z.optional(degreesSchema),
      tokenId: uuidSchema,
      path: z
        .array(scenePointDtoSchema)
        .check(z.minLength(2))
        .check(z.maxLength(VTT_SCENE_LIMITS.transientPathPoints))
    })
    .check(
      z.superRefine((command, context) => {
        if (command.speedId && command.movementKind !== 'VOLUNTARY')
          context.addIssue({
            code: 'custom',
            path: ['speedId'],
            message: 'Only voluntary movement names a speed type.'
          })
        if (command.carefully && command.movementKind !== 'VOLUNTARY')
          context.addIssue({
            code: 'custom',
            path: ['carefully'],
            message: 'Only voluntary movement can move carefully.'
          })
        if (
          command.facingDegrees !== undefined &&
          (command.movementKind !== 'VOLUNTARY' || command.expectedEncounterVersion === null)
        )
          context.addIssue({
            code: 'custom',
            path: ['facingDegrees'],
            message: 'Only a voluntary Encounter move chooses the facing it ends in.'
          })
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
)

export const sceneDoorStateCommandInputDtoSchema = lazySchema(() =>
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('SET_SCENE_DOOR_STATE'),
    barrierId: uuidSchema,
    state: z.enum(['OPEN', 'CLOSED', 'LOCKED'])
  })
)

/** A token's new facing, written only by the room for an Encounter's Change facing reaction (ATTACK-12). */
export const sceneTokenFacingCommandInputDtoSchema = lazySchema(() =>
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('SET_SCENE_TOKEN_FACING'),
    tokenId: uuidSchema,
    rotationDegrees: degreesSchema
  })
)

const sceneGeometryCommandSchemas = lazySchemaParts(
  () =>
    [
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
)
export const sceneGeometryCommandInputDtoSchema = lazySchema(() =>
  z.discriminatedUnion('type', sceneGeometryCommandSchemas())
)

export const sceneUndoLastMoveCommandInputDtoSchema = lazySchema(() =>
  z.extend(sceneCommandBaseDtoSchema, {
    type: z.literal('UNDO_LAST_SCENE_MOVE')
  })
)

const currentSceneCommandInputDtoSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    ...sceneGeometryCommandSchemas(),
    sceneTokenMovementCommandInputDtoSchema,
    ...sceneLiveCommandSchemas(),
    z.extend(sceneCommandBaseDtoSchema, {
      type: z.literal('PATCH_SCENE_FOG'),
      layer: sceneFogLayerDtoSchema
    }),
    sceneUndoLastMoveCommandInputDtoSchema
  ])
)

export const sceneCommandInputDtoSchema = lazySchema(() =>
  z.union([currentSceneCommandInputDtoSchema, legacyVisualOnlyDarknessCommandInputDtoSchema])
)

const sceneDefinitionInputObject = lazySchema(() =>
  z.omit(sceneDefinitionObject, {
    id: true,
    version: true
  })
)
// Native authoring transports independently bounded entity batches. These settings
// retain the exact definition contract while arrays keep their existing limits.
export const sceneDefinitionSettingsDtoSchema = lazySchema(() =>
  z.omit(sceneDefinitionInputObject, {
    annotations: true,
    barriers: true,
    darknessZones: true,
    lights: true,
    tokens: true
  })
)
export const createSceneDefinitionInputDtoSchema = lazySchema(() =>
  sceneDefinitionInputObject.check(z.superRefine(refineSceneStructure))
)
export const updateSceneDefinitionInputDtoSchema = lazySchema(() =>
  z
    .extend(sceneDefinitionInputObject, {
      expectedVersion: definitionVersionSchema,
      sceneId: uuidSchema
    })
    .check(z.superRefine(refineSceneStructure))
)
export const getCampaignSceneDefinitionsInputDtoSchema = lazySchema(() =>
  z.strictObject({ campaignId: uuidSchema })
)
export const listCampaignLiveScenesInputDtoSchema = lazySchema(() =>
  z.strictObject({ campaignId: uuidSchema })
)
export const getSceneDefinitionInputDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sceneId: uuidSchema
  })
)
export const getCampaignLiveSceneInputDtoSchema = lazySchema(() =>
  z.strictObject({ sceneId: uuidSchema })
)
export const deleteSceneDefinitionInputDtoSchema = lazySchema(() =>
  z.extend(getSceneDefinitionInputDtoSchema, {
    expectedVersion: definitionVersionSchema
  })
)

export const sceneCommandResultDtoSchema = lazySchema(() =>
  z
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
)

export const bindEncounterToPresentedSceneResultDtoSchema = lazySchema(() =>
  z.strictObject({
    commandId: uuidSchema,
    encounterId: uuidSchema,
    replayed: z.boolean(),
    sceneId: uuidSchema
  })
)

export const setCampaignLiveScenePresentationResultDtoSchema = lazySchema(() =>
  z.strictObject({
    commandId: uuidSchema,
    replayed: z.boolean(),
    campaignId: uuidSchema,
    sceneId: z.nullable(uuidSchema),
    version: versionSchema
  })
)
export const campaignScenePresentationDtoSchema = lazySchema(() =>
  z.omit(setCampaignLiveScenePresentationResultDtoSchema, { commandId: true, replayed: true })
)
export const getCampaignScenePresentationInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema
  })
)
export const campaignSceneShowingInputSchema = lazySchema(() =>
  z.strictObject({ campaignId: uuidSchema })
)
export const showCampaignSceneInputSchema = lazySchema(() =>
  z.extend(campaignSceneShowingInputSchema, { sceneId: uuidSchema })
)
/** A Scene the GM is showing players as a view-only image (D87); not the presented Scene. */
export const campaignSceneShowingDtoSchema = lazySchema(() =>
  z.strictObject({
    sceneId: uuidSchema,
    sceneName: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    shownAt: z.iso.datetime()
  })
)

/** Server-only durable campaign-event payload for a Campaign presentation command. */
export const campaignLiveScenePresentationReceiptDtoSchema = lazySchema(() =>
  z.strictObject({
    commandFingerprint: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
    result: setCampaignLiveScenePresentationResultDtoSchema
  })
)

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
export type SceneTokenFacingCommandInputDto = z.infer<typeof sceneTokenFacingCommandInputDtoSchema>
export type SceneTokenMovementCommandInputDto = z.infer<
  typeof sceneTokenMovementCommandInputDtoSchema
>
export type BindEncounterToPresentedSceneResultDto = z.infer<
  typeof bindEncounterToPresentedSceneResultDtoSchema
>
export type SetCampaignLiveScenePresentationResultDto = z.infer<
  typeof setCampaignLiveScenePresentationResultDtoSchema
>
export type CampaignScenePresentationDto = z.infer<typeof campaignScenePresentationDtoSchema>
export type CampaignSceneShowingInput = z.infer<typeof campaignSceneShowingInputSchema>
export type ShowCampaignSceneInput = z.infer<typeof showCampaignSceneInputSchema>
export type CampaignSceneShowingDto = z.infer<typeof campaignSceneShowingDtoSchema>
export type CampaignLiveScenePresentationReceiptDto = z.infer<
  typeof campaignLiveScenePresentationReceiptDtoSchema
>
export type SceneTransientEnvelopeDto = z.infer<typeof sceneTransientEnvelopeDtoSchema>
