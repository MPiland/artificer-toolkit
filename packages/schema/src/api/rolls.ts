import { z } from '../zod.js'
import {
  parseRollExpression,
  parseStandaloneDiceConfiguration,
  validateRollMode
} from '@artificer-toolkit/shared/rolls'

export const rollSourceDtoSchema = z.strictObject({
  kind: z.enum([
    'MANUAL',
    'ABILITY_CHECK',
    'SAVING_THROW',
    'SKILL_CHECK',
    'INITIATIVE',
    'ATTACK',
    'DAMAGE',
    'HEALING',
    'HIT_DIE'
  ]),
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80))
})

export const executeRollInputDtoSchema = z
  .strictObject({
    characterId: z.string().check(z.minLength(1)),
    expression: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(200)),
    rollMode: z.optional(z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])),
    source: rollSourceDtoSchema
  })
  .check(
    z.superRefine(({ expression, rollMode }, context) => {
      try {
        validateRollMode(parseRollExpression(expression), rollMode ?? 'NORMAL')
      } catch (error) {
        context.addIssue({
          code: 'custom',
          path: ['expression'],
          message: error instanceof Error ? error.message : 'Invalid roll expression.'
        })
      }
    })
  )

export const standaloneDiceConfigurationDtoSchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(80))
  .check(
    z.superRefine((configuration, context) => {
      try {
        parseStandaloneDiceConfiguration(configuration)
      } catch (error) {
        context.addIssue({
          code: 'custom',
          message: error instanceof Error ? error.message : 'Invalid dice configuration.'
        })
      }
    })
  )

export const executeDiceConfigurationInputDtoSchema = z.strictObject({
  configuration: standaloneDiceConfigurationDtoSchema
})

const rollTermEvidenceDtoSchema = z.object({
  count: z.number().check(z.int()).check(z.positive()),
  die: z.union([
    z.literal(4),
    z.literal(6),
    z.literal(8),
    z.literal(10),
    z.literal(12),
    z.literal(20),
    z.literal(100)
  ]),
  modifier: z.optional(z.number().check(z.int())),
  rolls: z.array(z.number().check(z.int()).check(z.positive())),
  rollSequences: z.optional(
    z.array(z.array(z.number().check(z.int()).check(z.positive())).check(z.minLength(1)))
  ),
  subtotal: z.number().check(z.int()),
  keptRollIndex: z.optional(z.number().check(z.int()).check(z.nonnegative())),
  keptRollIndexes: z.optional(z.array(z.number().check(z.int()).check(z.nonnegative())))
})

const rollTransformDtoSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NONE') }),
  z.object({ kind: z.literal('HALF') }),
  z.object({ kind: z.literal('DOUBLE') }),
  z.object({ kind: z.literal('MULTIPLY'), value: z.number().check(z.int()).check(z.positive()) })
])

export const rollEvidenceDtoSchema = z.object({
  terms: z.array(rollTermEvidenceDtoSchema).check(z.maxLength(10)),
  modifier: z.number().check(z.int()),
  mode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
  subtotal: z.number().check(z.int()),
  transform: rollTransformDtoSchema,
  total: z.number().check(z.int())
})

export const rollResultDtoSchema = z.object({
  id: z.string(),
  normalizedExpression: z.string(),
  evidence: rollEvidenceDtoSchema
})

const ruleCheckLabelSchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(160))

/**
 * What an automatic rule roll checked, beside its dice. One member per rule kind; a log entry names
 * the actor, the trigger, the target number and the outcome.
 */
export const rollRuleCheckDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CONCENTRATION'),
    actorId: z.string().check(z.uuid()),
    actorLabel: ruleCheckLabelSchema,
    damage: z.strictObject({
      amount: z.number().check(z.int()).check(z.positive()),
      typeLabel: z.nullable(ruleCheckLabelSchema)
    }),
    /** The spell, action or turn effect that dealt the damage; null when it has no name. */
    sourceLabel: z.nullable(ruleCheckLabelSchema),
    dc: z.number().check(z.int()).check(z.positive()),
    faces: z
      .array(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)))
      .check(z.minLength(1))
      .check(z.maxLength(2)),
    modifier: z.number().check(z.int()),
    total: z.number().check(z.int()),
    outcome: z.enum(['KEPT', 'LOST'])
  })
])

export const rollRecordDtoSchema = z.extend(rollResultDtoSchema, {
  characterId: z.nullable(z.string()),
  characterLabel: z.string(),
  source: rollSourceDtoSchema,
  ruleset: z.object({
    systemId: z.string(),
    code: z.string(),
    version: z.string()
  }),
  createdAt: z.string(),
  /** Present when a rule rolled automatically or settled a prompted roll. */
  ruleCheck: z.optional(rollRuleCheckDtoSchema)
})

/** Binds a GM-retained roll to its Campaign so it can be revealed to that TABLE once. */
export const gmCampaignRollDtoSchema = z.strictObject({
  campaignId: z.string(),
  blind: z.boolean(),
  revealedAt: z.nullable(z.string())
})

/** An unrevealed blind roll withholds its evidence from every reader, including the GM. */
export const rollHistoryEntryDtoSchema = z.union([
  z.extend(rollRecordDtoSchema, { gmCampaignRoll: z.nullable(gmCampaignRollDtoSchema) }),
  z.extend(rollRecordDtoSchema, {
    evidence: z.null(),
    gmCampaignRoll: z.extend(gmCampaignRollDtoSchema, {
      blind: z.literal(true),
      revealedAt: z.null()
    })
  })
])

export const rollHistoryResponseDtoSchema = z
  .array(rollHistoryEntryDtoSchema)
  .check(z.maxLength(20))

export const rollIdInputDtoSchema = z.strictObject({
  id: z.pipe(
    z.uuid(),
    z.transform((value) => value.toLowerCase())
  )
})

export type RollSourceDto = z.infer<typeof rollSourceDtoSchema>
export type ExecuteRollInputDto = z.infer<typeof executeRollInputDtoSchema>
export type ExecuteDiceConfigurationInputDto = z.infer<
  typeof executeDiceConfigurationInputDtoSchema
>
export type RollEvidenceDto = z.infer<typeof rollEvidenceDtoSchema>
export type RollResultDto = z.infer<typeof rollResultDtoSchema>
export type RollRuleCheckDto = z.infer<typeof rollRuleCheckDtoSchema>
export type RollRecordDto = z.infer<typeof rollRecordDtoSchema>
export type GmCampaignRollDto = z.infer<typeof gmCampaignRollDtoSchema>
export type RollHistoryEntryDto = z.infer<typeof rollHistoryEntryDtoSchema>
export type RollHistoryResponseDto = z.infer<typeof rollHistoryResponseDtoSchema>
export type RollIdInputDto = z.infer<typeof rollIdInputDtoSchema>
