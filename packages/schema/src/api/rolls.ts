import { z } from 'zod'
import {
  parseRollExpression,
  parseStandaloneDiceConfiguration,
  validateRollMode
} from '@artificer-toolkit/shared/rolls'

export const rollSourceDtoSchema = z
  .object({
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
    label: z.string().trim().min(1).max(80)
  })
  .strict()

export const executeRollInputDtoSchema = z
  .object({
    characterId: z.string().min(1),
    expression: z.string().trim().min(1).max(200),
    rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']).optional(),
    source: rollSourceDtoSchema
  })
  .strict()
  .superRefine(({ expression, rollMode }, context) => {
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

export const executeDiceConfigurationInputDtoSchema = z
  .object({ configuration: z.string().trim().min(1).max(80) })
  .strict()
  .superRefine(({ configuration }, context) => {
    try {
      parseStandaloneDiceConfiguration(configuration)
    } catch (error) {
      context.addIssue({
        code: 'custom',
        path: ['configuration'],
        message: error instanceof Error ? error.message : 'Invalid dice configuration.'
      })
    }
  })

const rollTermEvidenceDtoSchema = z.object({
  count: z.number().int().positive(),
  die: z.union([
    z.literal(4),
    z.literal(6),
    z.literal(8),
    z.literal(10),
    z.literal(12),
    z.literal(20),
    z.literal(100)
  ]),
  modifier: z.number().int().optional(),
  rolls: z.array(z.number().int().positive()),
  rollSequences: z.array(z.array(z.number().int().positive()).min(1)).optional(),
  subtotal: z.number().int(),
  keptRollIndex: z.number().int().nonnegative().optional(),
  keptRollIndexes: z.array(z.number().int().nonnegative()).optional()
})

const rollTransformDtoSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NONE') }),
  z.object({ kind: z.literal('HALF') }),
  z.object({ kind: z.literal('DOUBLE') }),
  z.object({ kind: z.literal('MULTIPLY'), value: z.number().int().positive() })
])

export const rollEvidenceDtoSchema = z.object({
  terms: z.array(rollTermEvidenceDtoSchema).max(10),
  modifier: z.number().int(),
  mode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
  subtotal: z.number().int(),
  transform: rollTransformDtoSchema,
  total: z.number().int()
})

export const rollResultDtoSchema = z.object({
  id: z.string(),
  normalizedExpression: z.string(),
  evidence: rollEvidenceDtoSchema
})

export const rollRecordDtoSchema = rollResultDtoSchema.extend({
  characterId: z.string().nullable(),
  characterLabel: z.string(),
  source: rollSourceDtoSchema,
  ruleset: z.object({
    systemId: z.string(),
    code: z.string(),
    version: z.string()
  }),
  createdAt: z.string()
})

export const rollHistoryResponseDtoSchema = z.array(rollRecordDtoSchema).max(20)

export type RollSourceDto = z.infer<typeof rollSourceDtoSchema>
export type ExecuteRollInputDto = z.infer<typeof executeRollInputDtoSchema>
export type ExecuteDiceConfigurationInputDto = z.infer<
  typeof executeDiceConfigurationInputDtoSchema
>
export type RollEvidenceDto = z.infer<typeof rollEvidenceDtoSchema>
export type RollResultDto = z.infer<typeof rollResultDtoSchema>
export type RollRecordDto = z.infer<typeof rollRecordDtoSchema>
export type RollHistoryResponseDto = z.infer<typeof rollHistoryResponseDtoSchema>
