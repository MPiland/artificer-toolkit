import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { liveSessionMovementCaptureScopeSchema } from './liveSessionEncounterMovement.js'
import {
  liveSessionEncounterCaptureBundleInputSchema,
  liveSessionEncounterCaptureBundleSchema
} from './liveSessionEncounterCaptureBundle.js'
import {
  liveSessionEncounterBindingCommitInputSchema,
  liveSessionMovementCommitInputSchema
} from './liveSessionMovementCommit.js'
import {
  sceneGeometryFinishInputSchema,
  sceneGeometryObserveInputSchema,
  sceneTokenOrdinalsSchema
} from './sceneGeometry.js'
import { resolveRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'

const bundleInput = liveSessionEncounterCaptureBundleInputSchema

/**
 * Reads a held movement decision's capture bundle when it is issued (D64), for one member who may
 * answer it: Convex refuses anyone the decision's own answer would refuse. `tokenOrdinals` are the
 * room's definition ordinals, from which Convex takes the moving token's.
 */
export const liveSessionMovementPrefetchInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    encounterId: postgresUuidSchema,
    occurrenceId: postgresUuidSchema,
    tokenOrdinals: sceneTokenOrdinalsSchema,
    maintenanceDefinitionIds: bundleInput.shape.maintenanceDefinitionIds,
    cachedSystem: bundleInput.shape.cachedSystem
  })
)

/**
 * The bundle read under the decision's capture scope at its current versions, and the checksum of
 * every part's read checksum, which the answer's commit recomputes and compares.
 */
export const liveSessionMovementPrefetchSchema = lazySchema(() =>
  z.strictObject({
    expectedVersion: z.number().check(z.int()).check(z.nonnegative()),
    movement: liveSessionMovementCaptureScopeSchema,
    bundle: liveSessionEncounterCaptureBundleSchema,
    checksum: projectionChecksumSchema
  })
)

/**
 * Answers a held movement decision in one transaction from the room's plan on its prefetched
 * bundle (D64): Convex routes and admits the answer, rereads the prefetched bundle and compares its
 * checksum, begins and observes the save as a stage does, then commits the plan exactly as the
 * movement commit does and advances the room's authority. Any mismatch refuses the whole answer,
 * and Convex refuses it after `expiresAt`, so a resolve can abandon it safely.
 */
export const liveSessionMovementAnswerInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    command: resolveRuleOccurrenceInputDtoSchema,
    characterRevisions: sceneGeometryObserveInputSchema.shape.characterRevisions,
    prefetch: z.strictObject({
      movement: liveSessionMovementCaptureScopeSchema,
      maintenanceDefinitionIds: bundleInput.shape.maintenanceDefinitionIds,
      checksum: projectionChecksumSchema
    }),
    plan: z.extend(
      z.pick(liveSessionMovementCommitInputSchema, {
        preparation: true,
        revisions: true,
        maintenanceOwners: true,
        rules: true,
        settlements: true,
        fogLayers: true,
        authority: true,
        expectedScene: true
      }),
      { finish: z.omit(sceneGeometryFinishInputSchema, { saveId: true }) }
    ),
    expiresAt: liveSessionEncounterBindingCommitInputSchema.shape.expiresAt
  })
)

export type LiveSessionMovementPrefetchInput = z.infer<
  typeof liveSessionMovementPrefetchInputSchema
>
export type LiveSessionMovementPrefetch = z.infer<typeof liveSessionMovementPrefetchSchema>
export type LiveSessionMovementAnswerInput = z.infer<typeof liveSessionMovementAnswerInputSchema>
