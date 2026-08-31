import { z } from 'zod'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredNonnegativeNumberSchema
} from './authoredLimits.js'
import { postgresUuidSchema } from './postgresUuid.js'

const savingThrowDcBonusDtoSchema = z.union([
  z
    .object({
      id: authoredIdentifierSchema,
      bonusKind: z.literal('ABILITY_MODIFIER'),
      abilityDefinitionId: postgresUuidSchema
    })
    .strict(),
  z
    .object({
      id: authoredIdentifierSchema,
      bonusKind: z.literal('PROFICIENCY_BONUS')
    })
    .strict(),
  z
    .object({
      id: authoredIdentifierSchema,
      bonusKind: z.literal('STATIC_BONUS'),
      amount: authoredNonnegativeNumberSchema.int()
    })
    .strict()
])

export const savingThrowDtoSchema = z.union([
  z
    .object({
      id: authoredIdentifierSchema,
      dcMethod: z.literal('SOURCE_SAVE_DC'),
      abilityDefinitionId: postgresUuidSchema
    })
    .strict(),
  z
    .object({
      id: authoredIdentifierSchema,
      dcMethod: z.literal('FIXED_DC'),
      abilityDefinitionId: postgresUuidSchema,
      baseDc: z.number().int(),
      bonuses: authoredNestedCollectionSchema(savingThrowDcBonusDtoSchema).optional()
    })
    .strict(),
  z
    .object({
      id: authoredIdentifierSchema,
      dcMethod: z.literal('DERIVED_DC'),
      abilityDefinitionId: postgresUuidSchema,
      baseDc: z.number().int(),
      bonuses: authoredNestedCollectionSchema(savingThrowDcBonusDtoSchema)
    })
    .strict()
])

export type SavingThrowDto = z.infer<typeof savingThrowDtoSchema>
