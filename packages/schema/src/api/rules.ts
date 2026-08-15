import { z } from 'zod'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { rollRecordDtoSchema, standaloneDiceConfigurationDtoSchema } from './rolls.js'

const uuidSchema = z.string().uuid()
const timestampSchema = z.string().datetime()
const jsonSchema = z.json()

export const ruleModelKeyDtoSchema = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/)

export const rulePackDocumentDtoSchema = z.strictObject({
  schemaVersion: z.literal(1),
  models: z
    .record(ruleModelKeyDtoSchema, jsonSchema)
    .refine((models) => Object.keys(models).length >= 1 && Object.keys(models).length <= 32, {
      message: 'Rule pack documents require between one and 32 models.'
    }),
  fixtures: z
    .array(
      z.strictObject({
        id: uuidSchema,
        label: z.string().trim().min(1).max(160),
        modelKey: ruleModelKeyDtoSchema,
        input: jsonSchema,
        expected: jsonSchema
      })
    )
    .max(200)
})

export const rulePackLifecycleDtoSchema = z.enum(['DRAFT', 'ACTIVE', 'RETIRED'])

export const rulePackSummaryDtoSchema = z.strictObject({
  id: uuidSchema,
  rulesetCode: z.string().trim().min(1).max(80),
  rulesetVersion: z.string().trim().min(1).max(80),
  activeRevisionId: uuidSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})

export const rulePackRevisionDtoSchema = z.strictObject({
  id: uuidSchema,
  packId: uuidSchema,
  revision: z.number().int().positive(),
  lifecycle: rulePackLifecycleDtoSchema,
  evaluatorKind: z.literal('ZEN'),
  evaluatorVersion: z.string().trim().min(1).max(80),
  modelContractVersion: z.number().int().min(1).max(10000),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  document: rulePackDocumentDtoSchema,
  createdBy: uuidSchema,
  activatedBy: uuidSchema.nullable(),
  activatedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})

export const listRulePackRevisionsInputDtoSchema = z.strictObject({ packId: uuidSchema })
export const saveRulePackDraftInputDtoSchema = z.strictObject({
  rulesetCode: z.string().trim().min(1).max(80),
  rulesetVersion: z.string().trim().min(1).max(80),
  document: rulePackDocumentDtoSchema,
  expectedUpdatedAt: timestampSchema.optional()
})
export const activateRulePackRevisionInputDtoSchema = z.strictObject({
  revisionId: uuidSchema,
  expectedChecksum: z.string().regex(/^[a-f0-9]{64}$/)
})
export const retireRulePackInputDtoSchema = z.strictObject({
  packId: uuidSchema,
  expectedRevisionId: uuidSchema
})

export const ruleEligibilityDtoSchema = z.strictObject({
  allowed: z.boolean(),
  reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/)
})
export const ruleOutcomeKindDtoSchema = z.enum([
  'DAMAGE',
  'HEAL',
  'CONDITION',
  'RESOURCE',
  'MANUAL'
])
export const ruleRollRequestDtoSchema = z.strictObject({
  id: uuidSchema,
  kind: z.enum(['ATTACK', 'SAVE', 'CHECK', 'DAMAGE', 'HEAL', 'CUSTOM']),
  configuration: standaloneDiceConfigurationDtoSchema,
  label: z.string().trim().min(1).max(80),
  targetActorId: uuidSchema.nullable()
})

export const proposedRuleOutcomeDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('DAMAGE'),
    targetActorId: uuidSchema,
    amount: z.number().int().positive(),
    damageTypeId: authoredIdentifierSchema.trim().min(1).nullable()
  }),
  z.strictObject({
    kind: z.literal('HEAL'),
    targetActorId: uuidSchema,
    amount: z.number().int().positive(),
    temporary: z.boolean()
  }),
  z.strictObject({
    kind: z.literal('CONDITION'),
    targetActorId: uuidSchema,
    conditionId: authoredIdentifierSchema.trim().min(1),
    operation: z.enum(['APPLY', 'REMOVE'])
  }),
  z.strictObject({
    kind: z.literal('RESOURCE'),
    targetActorId: uuidSchema,
    resourceId: authoredIdentifierSchema.trim().min(1),
    remainingDelta: z
      .number()
      .int()
      .refine((value) => value !== 0, 'Delta cannot be zero.')
  }),
  z.strictObject({
    kind: z.literal('MANUAL'),
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
    label: z.string().trim().min(1).max(160),
    instructions: z.string().trim().min(1).max(4000)
  })
])

export const ruleEvaluationDtoSchema = z.strictObject({
  eligibility: ruleEligibilityDtoSchema,
  rollRequests: z.array(ruleRollRequestDtoSchema).max(50).default([]),
  outcomes: z.array(proposedRuleOutcomeDtoSchema).max(50).default([])
})
export const ruleOutcomeOverrideDtoSchema = z.strictObject({
  reason: z.string().trim().min(1).max(1000),
  outcomes: z.array(proposedRuleOutcomeDtoSchema).max(50)
})
export const appliedRuleOutcomeDtoSchema = z.strictObject({
  proposed: proposedRuleOutcomeDtoSchema,
  status: z.enum(['APPLIED', 'MANUAL', 'OVERRIDDEN']),
  before: jsonSchema.nullable(),
  after: jsonSchema.nullable(),
  correlatedCommandId: uuidSchema.nullable()
})
export const ruleResolutionEvidenceDtoSchema = z.strictObject({
  rulePackRevisionId: uuidSchema,
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  evaluatorKind: z.literal('ZEN'),
  evaluatorVersion: z.string().trim().min(1).max(80),
  modelContractVersion: z.number().int().min(1).max(10000),
  modelKey: ruleModelKeyDtoSchema,
  normalizedFacts: jsonSchema,
  trace: jsonSchema.nullable(),
  rolls: z.array(rollRecordDtoSchema),
  proposedOutcomes: z.array(proposedRuleOutcomeDtoSchema).max(50),
  appliedOutcomes: z.array(appliedRuleOutcomeDtoSchema).max(50),
  override: ruleOutcomeOverrideDtoSchema.nullable()
})
export const simulateRulePackInputDtoSchema = z.strictObject({
  rulesetCode: z.string().trim().min(1).max(80),
  rulesetVersion: z.string().trim().min(1).max(80),
  document: rulePackDocumentDtoSchema,
  modelKey: ruleModelKeyDtoSchema,
  input: jsonSchema
})
export const simulateRulePackResultDtoSchema = z.strictObject({
  result: jsonSchema,
  trace: jsonSchema.nullable()
})

export type RuleModelKeyDto = z.infer<typeof ruleModelKeyDtoSchema>
export type RulePackDocumentDto = z.infer<typeof rulePackDocumentDtoSchema>
export type RulePackLifecycleDto = z.infer<typeof rulePackLifecycleDtoSchema>
export type RulePackSummaryDto = z.infer<typeof rulePackSummaryDtoSchema>
export type RulePackRevisionDto = z.infer<typeof rulePackRevisionDtoSchema>
export type ListRulePackRevisionsInputDto = z.infer<typeof listRulePackRevisionsInputDtoSchema>
export type SaveRulePackDraftInputDto = z.infer<typeof saveRulePackDraftInputDtoSchema>
export type ActivateRulePackRevisionInputDto = z.infer<
  typeof activateRulePackRevisionInputDtoSchema
>
export type RetireRulePackInputDto = z.infer<typeof retireRulePackInputDtoSchema>
export type RuleEligibilityDto = z.infer<typeof ruleEligibilityDtoSchema>
export type RuleOutcomeKindDto = z.infer<typeof ruleOutcomeKindDtoSchema>
export type RuleRollRequestDto = z.infer<typeof ruleRollRequestDtoSchema>
export type ProposedRuleOutcomeDto = z.infer<typeof proposedRuleOutcomeDtoSchema>
export type RuleEvaluationDto = z.infer<typeof ruleEvaluationDtoSchema>
export type RuleOutcomeOverrideDto = z.infer<typeof ruleOutcomeOverrideDtoSchema>
export type AppliedRuleOutcomeDto = z.infer<typeof appliedRuleOutcomeDtoSchema>
export type RuleResolutionEvidenceDto = z.infer<typeof ruleResolutionEvidenceDtoSchema>
export type SimulateRulePackInputDto = z.infer<typeof simulateRulePackInputDtoSchema>
export type SimulateRulePackResultDto = z.infer<typeof simulateRulePackResultDtoSchema>
