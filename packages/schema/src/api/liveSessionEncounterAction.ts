import { z } from '../zod.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from '../shared/activeRuleEffects.js'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import {
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'
import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterMaintenanceOwnerRequestSchema
} from './liveSessionEncounterRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { characterResourceUsageOwnerSchema } from '../projections/characterSheetState.js'
import {
  activeRuleEffectRecordSchema,
  encounterMaintainedEffectStateRecordSchema
} from '../projections/activeRuleEffectPersistence.js'
import { characterMechanicsResourceReceiptDtoSchema } from '../shared/ruleExecutionMechanics.js'
import { storedRuleExecutionResultDtoSchema } from '../shared/ruleExecutionResults.js'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '../shared/ruleExecutionReceiptCommandMetadata.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import {
  encounterRuleWarningsDtoSchema,
  type EncounterRuleWarningDto
} from '../shared/encounterRuleWarnings.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'

/** Private DO output; the mutation accepts a sealed action occurrence, never arbitrary writes. */
export const liveSessionEncounterActionPendingInputSchema = z.extend(
  z.omit(liveSessionEncounterRulesInputSchema, {
    request: true,
    concentrationResponse: true,
    turnCommand: true,
    action: true,
    movement: true
  }),
  {
    /** The GM, or a player acting for an actor they control (ADR 0034 decision 1). */
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    command: resolveEncounterActionInputDtoSchema,
    response: z.optional(z.nullable(resolveRuleOccurrenceInputDtoSchema)),
    revisions: liveSessionRulesRevisionsSchema,
    maintenanceOwners: z
      .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
      .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR)),
    snapshot: serverRuleExecutionPendingSnapshotDtoSchema
  }
)

export type LiveSessionEncounterActionPendingInput = z.infer<
  typeof liveSessionEncounterActionPendingInputSchema
>

export const liveSessionCharacterResourceConsumptionSchema = z.extend(
  characterMechanicsResourceReceiptDtoSchema,
  {
    owner: characterResourceUsageOwnerSchema,
    usageId: postgresUuidSchema,
    characterId: postgresUuidSchema,
    expectedStreamVersion: z.number().check(z.int()).check(z.nonnegative())
  }
)

/** Bounded domain outcomes from the private DO; no Character or Run document patches. */
export type LiveSessionEncounterActionCommitInput = Omit<
  LiveSessionEncounterActionPendingInput,
  'snapshot'
> & {
  occurredAt: string
  initialDefinitionId: string
  execution: z.infer<typeof storedRuleExecutionResultDtoSchema>
  rules: z.infer<typeof encounterActorRuleOutputSchema>
  resourceConsumption:
    | (z.infer<typeof characterMechanicsResourceReceiptDtoSchema> & {
        owner: z.infer<typeof characterResourceUsageOwnerSchema>
        usageId: string
        characterId: string
        expectedStreamVersion: number
      })
    | null
  /** Warnings the command acknowledged and the planner found; recorded as overrides. */
  ruleOverrides: EncounterRuleWarningDto[]
  createdEffects: z.infer<typeof activeRuleEffectRecordSchema>[]
  maintainedState: z.infer<typeof encounterMaintainedEffectStateRecordSchema> | null
  concentration: {
    result: z.infer<typeof storedRuleExecutionResultDtoSchema>
    commandId: string
    fingerprint: string
    correlationId: string
    metadata: z.infer<typeof serverRuleExecutionReceiptCommandMetadataDtoSchema>
  }[]
  pendingConcentration: z.infer<typeof serverRuleExecutionPendingSnapshotDtoSchema> | null
  cleaving: z.infer<typeof serverRuleExecutionPendingSnapshotDtoSchema> | null
}
export const liveSessionEncounterConcentrationFields = {
  concentration: z
    .array(
      z.strictObject({
        result: storedRuleExecutionResultDtoSchema,
        commandId: postgresUuidSchema,
        fingerprint: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
        correlationId: postgresUuidSchema,
        metadata: serverRuleExecutionReceiptCommandMetadataDtoSchema
      })
    )
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  pendingConcentration: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema)
}

export const liveSessionEncounterActionCommitInputSchema: z.ZodMiniType<LiveSessionEncounterActionCommitInput> =
  z.extend(z.omit(liveSessionEncounterActionPendingInputSchema, { snapshot: true }), {
    occurredAt: z.iso.datetime(),
    maintenanceOwners: z
      .array(liveSessionEncounterMaintenanceOwnerRequestSchema)
      .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR * 2)),
    initialDefinitionId: postgresUuidSchema,
    execution: storedRuleExecutionResultDtoSchema,
    rules: encounterActorRuleOutputSchema,
    resourceConsumption: z.nullable(liveSessionCharacterResourceConsumptionSchema),
    ruleOverrides: encounterRuleWarningsDtoSchema,
    createdEffects: z.array(activeRuleEffectRecordSchema).check(z.maxLength(2)),
    maintainedState: z.nullable(encounterMaintainedEffectStateRecordSchema),
    ...liveSessionEncounterConcentrationFields,
    cleaving: z.nullable(serverRuleExecutionPendingSnapshotDtoSchema)
  })
