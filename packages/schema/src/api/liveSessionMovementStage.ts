import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import {
  liveSessionMovementCaptureScopeSchema,
  type LiveSessionMovementCaptureScope
} from './liveSessionEncounterMovement.js'
import {
  liveSessionEncounterCaptureBundleInputSchema,
  liveSessionEncounterCaptureBundleSchema,
  type LiveSessionEncounterCaptureBundle
} from './liveSessionEncounterCaptureBundle.js'
import {
  liveSessionEncounterRouteResponseSchema,
  type LiveSessionEncounterRouteResponse
} from './liveSessionEncounterCommand.js'
import {
  sceneGeometryBeginReadySchema,
  sceneGeometryObserveInputSchema,
  scenePresentationFenceSchema,
  sceneTokenOrdinalsSchema,
  type SceneGeometryBeginResult
} from './sceneGeometry.js'
import {
  sceneDoorStateCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema
} from './vttScenes.js'
import {
  resolveRuleOccurrenceInputDtoSchema,
  voidRuleOccurrenceInputDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from './encounterRuleCommands.js'

/**
 * Stages a room Scene commit in one private call (D52): a token move or door change fenced to the
 * presentation that selected its Scene, or a movement decision's answer or GM void (which declines
 * it), which carries no fence. Convex routes a decision, begins the save, observes the room's Scene
 * vision `characterRevisions` and, for an Encounter-bound move, reads the planner's capture bundle.
 * `tokenOrdinals` are the room's definition ordinals, from which Convex takes the moving token's.
 * `cachedSystem` is the stamp of the Run System the room holds, for the bundle.
 */
export const liveSessionMovementStageInputSchema = lazySchema(() =>
  z
    .extend(liveSessionBootstrapInputSchema, {
      expectedRole: z.enum(['OWNER', 'PLAYER']),
      command: z.union([
        sceneTokenMovementCommandInputDtoSchema,
        sceneDoorStateCommandInputDtoSchema,
        resolveRuleOccurrenceInputDtoSchema,
        voidRuleOccurrenceInputDtoSchema
      ]),
      presentation: z.optional(scenePresentationFenceSchema),
      characterRevisions: sceneGeometryObserveInputSchema.shape.characterRevisions,
      tokenOrdinals: sceneTokenOrdinalsSchema,
      maintenanceDefinitionIds:
        liveSessionEncounterCaptureBundleInputSchema.shape.maintenanceDefinitionIds,
      cachedSystem: liveSessionEncounterCaptureBundleInputSchema.shape.cachedSystem
    })
    .check(
      z.refine(
        (input) =>
          (input.command.type === 'MOVE_SCENE_TOKEN' ||
            input.command.type === 'SET_SCENE_DOOR_STATE') ===
          (input.presentation !== undefined),
        'A Scene change requires its presentation fence and a decision answer must not carry one.'
      )
    )
)

/**
 * ROUTED: the decision's pending occurrence belongs to another room planner, and nothing was
 * staged. REPLAY: the command ID already published, which the room has no receipt for. STAGED: the
 * observed save (a rebase may have replaced the begun one), the decision answer it staged (a GM
 * void's decline, D26), and, for an Encounter-bound move or answer, the capture scope with the
 * bundle read under it: a move's save, or an answer's issued decision (D64).
 */
export const liveSessionMovementStageSchema: z.ZodMiniType<LiveSessionMovementStage> = lazySchema(
  () =>
    z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('ROUTED'), route: liveSessionEncounterRouteResponseSchema }),
      z.strictObject({ kind: z.literal('REPLAY') }),
      z.strictObject({
        kind: z.literal('STAGED'),
        begun: sceneGeometryBeginReadySchema,
        saveId: postgresUuidSchema,
        answer: z.nullable(resolveRuleOccurrenceInputDtoSchema),
        capture: z.nullable(
          z.strictObject({
            movement: liveSessionMovementCaptureScopeSchema,
            bundle: liveSessionEncounterCaptureBundleSchema
          })
        )
      })
    ])
)

export type LiveSessionMovementStageInput = z.infer<typeof liveSessionMovementStageInputSchema>
/** Declared, so a bound move's bundle keeps the capture bundle's own type through the union. */
export type LiveSessionMovementStage =
  | { kind: 'ROUTED'; route: LiveSessionEncounterRouteResponse }
  | { kind: 'REPLAY' }
  | {
      kind: 'STAGED'
      begun: Extract<SceneGeometryBeginResult, { kind: 'READY' }>
      saveId: string
      answer: ResolveRuleOccurrenceInputDto | null
      capture: {
        movement: LiveSessionMovementCaptureScope
        bundle: LiveSessionEncounterCaptureBundle
      } | null
    }
