import { z } from '../zod.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { liveSessionSequenceDtoSchema } from './liveSessionCommands.js'
import { liveSessionMovementCaptureScopeSchema } from './liveSessionEncounterMovement.js'
import {
  sceneGeometryCommandResultSchema,
  sceneGeometryFinishInputSchema,
  sceneGeometryObserveInputSchema,
  sceneGeometrySaveLookupSchema,
  sceneGeometryStageFogInputSchema
} from './sceneGeometry.js'
import { sceneDeltaDtoSchema } from './vttScenes.js'
import { encounterCommandResultDtoSchema } from './encounterData.js'
import { voidRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { sceneSpatialPreparationSchema } from '../projections/sceneSpatialPreparation.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import { liveSessionCharacterResourceConsumptionSchema } from './liveSessionEncounterAction.js'
import { liveSessionEncounterMaintenanceOwnerRequestSchema } from './liveSessionEncounterRules.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from '../shared/activeRuleEffects.js'
import {
  spatialMovementExecutionDtoSchema,
  spatialEffectTransitionEntryDtoSchema
} from '../shared/ruleExecutionEffectEvidence.js'
import { movementReactionActionExecutionDtoSchema } from '../shared/ruleExecutionMovementReactionReceipts.js'
import { movementConcentrationExecutionDtoSchema } from '../shared/ruleExecutionMovementConcentration.js'
import { movementPassageContestReceiptDtoSchema } from '../shared/ruleExecutionSpatial.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  activeRuleEffectRecordSchema,
  encounterMaintainedEffectStateRecordSchema
} from '../projections/activeRuleEffectPersistence.js'
import { MAX_SPATIAL_CANDIDATES } from '../shared/spatialFacts.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'

/** Ordered domain outcomes only; Character documents and arbitrary patches never cross this seam. */
export const liveSessionMovementSettlementSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('SPATIAL'),
    executions: z
      .array(spatialMovementExecutionDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
    transitions: z
      .array(spatialEffectTransitionEntryDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(MAX_SPATIAL_CANDIDATES))
  }),
  z.strictObject({
    kind: z.literal('REACTION'),
    execution: movementReactionActionExecutionDtoSchema,
    resourceConsumption: z.nullable(liveSessionCharacterResourceConsumptionSchema),
    createdEffects: z.array(activeRuleEffectRecordSchema).check(z.maxLength(2)),
    maintainedState: z.nullable(encounterMaintainedEffectStateRecordSchema)
  }),
  z.strictObject({
    kind: z.literal('CONCENTRATION'),
    execution: movementConcentrationExecutionDtoSchema
  }),
  z.strictObject({
    kind: z.literal('PASSAGE'),
    actorId: postgresUuidSchema,
    consumption: movementPassageContestReceiptDtoSchema.shape.actionEconomy
  })
])

export const liveSessionMovementPrepareInputSchema = z.extend(liveSessionBootstrapInputSchema, {
  expectedRole: z.enum(['OWNER', 'PLAYER']),
  movement: liveSessionMovementCaptureScopeSchema,
  preparation: sceneSpatialPreparationSchema,
  revisions: liveSessionRulesRevisionsSchema,
  maintenanceOwners: z
    .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
    .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR * MAX_ENCOUNTER_ACTORS))
})

/**
 * The room's next authority sequence, which a Convex-first commit advances in its own transaction
 * (D27): Convex requires its persisted sequence to be `sequence - 1` with `expectedStateChecksum`.
 */
export const liveSessionExternalAuthoritySchema = z.strictObject({
  sequence: liveSessionSequenceDtoSchema.check(z.positive()),
  expectedStateChecksum: projectionChecksumSchema,
  stateChecksum: projectionChecksumSchema
})

/** The Scene result the room predicted; any other publication rolls the whole commit back. */
export const liveSessionExpectedSceneSchema = z.strictObject({
  sceneId: postgresUuidSchema,
  version: z.number().check(z.int()).check(z.nonnegative()),
  delta: z.nullable(sceneDeltaDtoSchema)
})

const externalCommit = {
  authority: liveSessionExternalAuthoritySchema,
  expectedScene: liveSessionExpectedSceneSchema
}

/** A room Scene commit that carries no Encounter rules: a token move or a door change. */
export const liveSessionSceneGeometryCommitInputSchema = z.extend(liveSessionBootstrapInputSchema, {
  finish: sceneGeometryFinishInputSchema,
  ...externalCommit
})

export const liveSessionSceneGeometryObserveInputSchema = z.extend(
  liveSessionBootstrapInputSchema,
  sceneGeometryObserveInputSchema.shape
)

/** Stages one complete fog layer; returns the geometry save, which is unchanged. */
export const liveSessionSceneGeometryStageFogInputSchema = z.extend(
  liveSessionBootstrapInputSchema,
  sceneGeometryStageFogInputSchema.shape
)
export const liveSessionSceneGeometrySaveResponseSchema = sceneGeometrySaveLookupSchema

/**
 * Settles a room commit whose outcome the room did not observe (a timeout or a restart). Worker
 * secret only: the room's write-ahead record supplies every field.
 */
export const liveSessionExternalCommitResolveInputSchema = z.strictObject({
  campaignId: postgresUuidSchema,
  epoch: postgresUuidSchema,
  saveId: postgresUuidSchema,
  expectedSequence: liveSessionSequenceDtoSchema,
  expectedStateChecksum: projectionChecksumSchema,
  nextStateChecksum: projectionChecksumSchema
})
export const liveSessionExternalCommitResolveResponseSchema = z.strictObject({
  outcome: z.enum(['COMMITTED', 'ABANDONED'])
})

export const liveSessionMovementCommitInputSchema = z.extend(
  liveSessionMovementPrepareInputSchema,
  {
    finish: sceneGeometryFinishInputSchema,
    ...externalCommit,
    /** A GM void this commit declines (D26); it is recorded in the same transaction. */
    voidCommand: z.optional(voidRuleOccurrenceInputDtoSchema),
    rules: z.nullable(encounterActorRuleOutputSchema),
    settlements: z
      .array(liveSessionMovementSettlementSchema)
      .check(
        z.maxLength(MAX_SPATIAL_CANDIDATES + MAX_ENCOUNTER_ACTORS * (MAX_ENCOUNTER_ACTORS + 1))
      )
  }
)

/** A decision answer or void also returns its Encounter result, presented for the member. */
export const liveSessionMovementCommitResponseSchema = z.strictObject({
  scene: sceneGeometryCommandResultSchema,
  encounter: z.nullable(encounterCommandResultDtoSchema)
})

export type LiveSessionMovementSettlement = z.infer<typeof liveSessionMovementSettlementSchema>
export type LiveSessionExternalAuthority = z.infer<typeof liveSessionExternalAuthoritySchema>
export type LiveSessionExpectedScene = z.infer<typeof liveSessionExpectedSceneSchema>
export type LiveSessionSceneGeometryCommitInput = z.infer<
  typeof liveSessionSceneGeometryCommitInputSchema
>
export type LiveSessionExternalCommitResolveInput = z.infer<
  typeof liveSessionExternalCommitResolveInputSchema
>
export type LiveSessionMovementCommitResponse = z.infer<
  typeof liveSessionMovementCommitResponseSchema
>
export type LiveSessionMovementPrepareInput = z.infer<typeof liveSessionMovementPrepareInputSchema>
export type LiveSessionMovementCommitInput = z.infer<typeof liveSessionMovementCommitInputSchema>
