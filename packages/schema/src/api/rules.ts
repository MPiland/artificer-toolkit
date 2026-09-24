import { z } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { rollRecordDtoSchema, standaloneDiceConfigurationDtoSchema } from './rolls.js'

const uuidSchema = z.string().check(z.uuid())
const jsonSchema = z.json()

export const ruleModelKeyDtoSchema = z.string().check(z.regex(/^[a-z][a-z0-9-]{0,79}$/))

export const rulePackDocumentDtoSchema = z.strictObject({
  schemaVersion: z.literal(1),
  models: z.record(ruleModelKeyDtoSchema, jsonSchema).check(
    z.refine((models) => Object.keys(models).length >= 1 && Object.keys(models).length <= 32, {
      message: 'Rule pack documents require between one and 32 models.'
    })
  ),
  fixtures: z
    .array(
      z.strictObject({
        id: uuidSchema,
        label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
        modelKey: ruleModelKeyDtoSchema,
        input: jsonSchema,
        expected: jsonSchema
      })
    )
    .check(z.maxLength(200))
})

export const ruleEligibilityDtoSchema = z.strictObject({
  allowed: z.boolean(),
  reasonCode: z.string().check(z.regex(/^[A-Z][A-Z0-9_]{0,79}$/))
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
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
  targetActorId: z.nullable(uuidSchema)
})

export const proposedRuleOutcomeDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('DAMAGE'),
    targetActorId: uuidSchema,
    amount: z.number().check(z.int()).check(z.positive()),
    damageTypeId: z.nullable(authoredIdentifierSchema.check(z.trim()).check(z.minLength(1)))
  }),
  z.strictObject({
    kind: z.literal('HEAL'),
    targetActorId: uuidSchema,
    amount: z.number().check(z.int()).check(z.positive()),
    temporary: z.boolean()
  }),
  z.strictObject({
    kind: z.literal('CONDITION'),
    targetActorId: uuidSchema,
    conditionId: authoredIdentifierSchema.check(z.trim()).check(z.minLength(1)),
    operation: z.enum(['APPLY', 'REMOVE'])
  }),
  z.strictObject({
    kind: z.literal('RESOURCE'),
    targetActorId: uuidSchema,
    resourceId: authoredIdentifierSchema.check(z.trim()).check(z.minLength(1)),
    remainingDelta: z
      .number()
      .check(z.int())
      .check(z.refine((value) => value !== 0, 'Delta cannot be zero.'))
  }),
  z.strictObject({
    kind: z.literal('MANUAL'),
    code: z.string().check(z.regex(/^[A-Z][A-Z0-9_]{0,79}$/)),
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    instructions: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(4000))
  })
])

export const ruleEvaluationDtoSchema = z.strictObject({
  eligibility: ruleEligibilityDtoSchema,
  rollRequests: z._default(z.array(ruleRollRequestDtoSchema).check(z.maxLength(50)), []),
  outcomes: z._default(z.array(proposedRuleOutcomeDtoSchema).check(z.maxLength(50)), [])
})
export const ruleOutcomeOverrideDtoSchema = z.strictObject({
  reason: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1000)),
  outcomes: z.array(proposedRuleOutcomeDtoSchema).check(z.maxLength(50))
})
export const appliedRuleOutcomeDtoSchema = z.strictObject({
  proposed: proposedRuleOutcomeDtoSchema,
  status: z.enum(['APPLIED', 'MANUAL', 'OVERRIDDEN']),
  before: z.nullable(jsonSchema),
  after: z.nullable(jsonSchema),
  correlatedCommandId: z.nullable(uuidSchema)
})
export const ruleResolutionEvidenceDtoSchema = z.strictObject({
  rulePackRevisionId: uuidSchema,
  checksum: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
  evaluatorKind: z.literal('ZEN'),
  evaluatorVersion: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
  modelContractVersion: z.number().check(z.int()).check(z.gte(1)).check(z.lte(10000)),
  modelKey: ruleModelKeyDtoSchema,
  normalizedFacts: jsonSchema,
  trace: z.nullable(jsonSchema),
  rolls: z.array(rollRecordDtoSchema),
  proposedOutcomes: z.array(proposedRuleOutcomeDtoSchema).check(z.maxLength(50)),
  appliedOutcomes: z.array(appliedRuleOutcomeDtoSchema).check(z.maxLength(50)),
  override: z.nullable(ruleOutcomeOverrideDtoSchema)
})
export const simulateRulePackResultDtoSchema = z.strictObject({
  result: jsonSchema,
  trace: z.nullable(jsonSchema)
})

export type RuleModelKeyDto = z.infer<typeof ruleModelKeyDtoSchema>
export type RulePackDocumentDto = z.infer<typeof rulePackDocumentDtoSchema>
export type RuleEligibilityDto = z.infer<typeof ruleEligibilityDtoSchema>
export type RuleOutcomeKindDto = z.infer<typeof ruleOutcomeKindDtoSchema>
export type RuleRollRequestDto = z.infer<typeof ruleRollRequestDtoSchema>
export type ProposedRuleOutcomeDto = z.infer<typeof proposedRuleOutcomeDtoSchema>
export type RuleEvaluationDto = z.infer<typeof ruleEvaluationDtoSchema>
export type RuleOutcomeOverrideDto = z.infer<typeof ruleOutcomeOverrideDtoSchema>
export type AppliedRuleOutcomeDto = z.infer<typeof appliedRuleOutcomeDtoSchema>
export type RuleResolutionEvidenceDto = z.infer<typeof ruleResolutionEvidenceDtoSchema>
export type SimulateRulePackResultDto = z.infer<typeof simulateRulePackResultDtoSchema>
