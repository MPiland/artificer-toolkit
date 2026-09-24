import { z } from '../zod.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { liveSessionMovementCaptureScopeSchema } from './liveSessionEncounterMovement.js'
import { sceneGeometryFinishInputSchema } from './sceneGeometry.js'
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
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

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
    .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR * RULE_GRAPH_LIMITS.NODES))
})

export const liveSessionMovementCommitInputSchema = z.extend(
  liveSessionMovementPrepareInputSchema,
  {
    finish: sceneGeometryFinishInputSchema,
    rules: z.nullable(encounterActorRuleOutputSchema),
    settlements: z
      .array(liveSessionMovementSettlementSchema)
      .check(
        z.maxLength(
          MAX_SPATIAL_CANDIDATES + RULE_GRAPH_LIMITS.NODES * (RULE_GRAPH_LIMITS.NODES + 1)
        )
      )
  }
)

export type LiveSessionMovementSettlement = z.infer<typeof liveSessionMovementSettlementSchema>
export type LiveSessionMovementPrepareInput = z.infer<typeof liveSessionMovementPrepareInputSchema>
export type LiveSessionMovementCommitInput = z.infer<typeof liveSessionMovementCommitInputSchema>
