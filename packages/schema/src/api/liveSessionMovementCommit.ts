import { z, lazySchema } from '../zod.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { liveSessionMovementCaptureScopeSchema } from './liveSessionEncounterMovement.js'
import { sceneGeometryFinishInputSchema } from './sceneGeometry.js'
import { sceneDeltaDtoSchema, sceneFogLayerDtoSchema } from './vttScenes.js'
import { voidRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'
import { sceneSpatialPreparationSchema } from '../projections/sceneSpatialPreparation.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import { liveSessionCharacterResourceConsumptionSchema } from './liveSessionEncounterAction.js'
import { liveSessionEncounterMaintenanceOwnerRequestSchema } from './liveSessionEncounterRules.js'
import {
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR
} from '../shared/activeRuleEffects.js'
import {
  spatialMovementExecutionDtoSchema,
  spatialEffectTransitionEntryDtoSchema
} from '../shared/ruleExecutionEffectEvidence.js'
import { movementReactionActionExecutionDtoSchema } from '../shared/ruleExecutionMovementReactionReceipts.js'
import {
  movementConcentrationEndDtoSchema,
  movementConcentrationExecutionDtoSchema
} from '../shared/ruleExecutionMovementConcentration.js'
import { movementPassageContestReceiptDtoSchema } from '../shared/ruleExecutionSpatial.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  activeRuleEffectRecordSchema,
  encounterMaintainedEffectStateRecordSchema
} from '../projections/activeRuleEffectPersistence.js'
import { MAX_SPATIAL_CANDIDATES } from '../shared/spatialFacts.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { encounterTurnUseKeysSchema } from '../projections/encounterRunPersistence.js'

/** Ordered domain outcomes only; Character documents and arbitrary patches never cross this seam. */
export const liveSessionMovementSettlementSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
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
      maintainedState: z.nullable(encounterMaintainedEffectStateRecordSchema),
      /**
       * The reactor's one-roll grants the attack roll used up and the mover's effects the damage
       * ended; the commit deletes them.
       */
      consumedGrants: z
        .array(activeRuleEffectRecordSchema)
        .check(z.maxLength(2 * MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
      /** A decoy of the mover the attack struck without it being the last: the commit spends one use of its effect. */
      spentUseGrants: z.array(activeRuleEffectRecordSchema).check(z.maxLength(1)),
      /** The once-per-turn uses the reaction attack spent from the reactor's turn record (D119). */
      turnUses: encounterTurnUseKeysSchema
    }),
    z.strictObject({
      kind: z.literal('CONCENTRATION'),
      execution: movementConcentrationExecutionDtoSchema
    }),
    /** The Concentration a contact ended with no check (D95); it settles before that contact's checks. */
    z.strictObject({
      kind: z.literal('CONCENTRATION_END'),
      execution: movementConcentrationEndDtoSchema
    }),
    /**
     * The mover left a zone holding a condition on it until it did (D146): the commit ends the
     * zone's holder effect, which it re-derives from current rows, and the conditions only it held.
     */
    z.strictObject({
      kind: z.literal('AREA_DEPARTURE'),
      departure: z.strictObject({
        zoneEffectId: postgresUuidSchema,
        holderActorId: postgresUuidSchema,
        pathDistance: z.number().check(z.nonnegative())
      }),
      endedEffect: activeRuleEffectRecordSchema,
      removedConditionIds: z
        .array(postgresUuidSchema)
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
    }),
    /**
     * The mover moved voluntarily while holding an effect that lasts until it moves (`ON_MOVE`): the
     * commit ends that effect, which it re-derives from current rows, and the conditions only it held.
     */
    z.strictObject({
      kind: z.literal('MOVE_END'),
      moveEnd: z.strictObject({ effectId: postgresUuidSchema, holderActorId: postgresUuidSchema }),
      endedEffect: activeRuleEffectRecordSchema,
      removedConditionIds: z
        .array(postgresUuidSchema)
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
    }),
    z.strictObject({
      kind: z.literal('PASSAGE'),
      actorId: postgresUuidSchema,
      consumption: movementPassageContestReceiptDtoSchema.shape.actionEconomy,
      /** The one-check grants (Help) both rollers' contest checks used up; the commit deletes them. */
      consumedGrants: z
        .array(activeRuleEffectRecordSchema)
        .check(z.maxLength(2 * MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
      /** What the rule behind a won contest gives the contested creature (the cling a climb leaves). */
      createdEffects: z
        .array(activeRuleEffectRecordSchema)
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
    })
  ])
)

/**
 * The room's frozen movement plan and the captured reads it rests on. The movement commit checks
 * every captured owner and persists the plan on its save before it publishes, in one transaction.
 */
export const liveSessionMovementPrepareInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    movement: liveSessionMovementCaptureScopeSchema,
    preparation: sceneSpatialPreparationSchema,
    revisions: liveSessionRulesRevisionsSchema,
    maintenanceOwners: z
      .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
      .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR * MAX_ENCOUNTER_ACTORS))
  })
)

/** The Scene result the room predicted; any other publication rolls the whole commit back. */
export const liveSessionExpectedSceneSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    version: z.number().check(z.int()).check(z.nonnegative()),
    delta: z.nullable(sceneDeltaDtoSchema)
  })
)

export const liveSessionMovementCommitInputSchema = lazySchema(() =>
  z.extend(liveSessionMovementPrepareInputSchema, {
    finish: sceneGeometryFinishInputSchema,
    expectedScene: liveSessionExpectedSceneSchema,
    /** Each fog owner's complete layer, staged with the commit (D52). */
    fogLayers: z.array(sceneFogLayerDtoSchema).check(z.maxLength(101)),
    /** A GM void this commit declines (D26); it is recorded in the same transaction. */
    voidCommand: z.optional(voidRuleOccurrenceInputDtoSchema),
    rules: z.nullable(encounterActorRuleOutputSchema),
    settlements: z
      .array(liveSessionMovementSettlementSchema)
      .check(
        z.maxLength(3 * MAX_SPATIAL_CANDIDATES + MAX_ENCOUNTER_ACTORS * (MAX_ENCOUNTER_ACTORS + 2))
      )
  })
)

export type LiveSessionMovementSettlement = z.infer<typeof liveSessionMovementSettlementSchema>
export type LiveSessionExpectedScene = z.infer<typeof liveSessionExpectedSceneSchema>
export type LiveSessionMovementPrepareInput = z.infer<typeof liveSessionMovementPrepareInputSchema>
export type LiveSessionMovementCommitInput = z.infer<typeof liveSessionMovementCommitInputSchema>
