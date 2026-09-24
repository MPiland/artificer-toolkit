import { z } from '../zod.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredNonnegativeNumberSchema
} from './authoredLimits.js'
import { postgresUuidSchema } from './postgresUuid.js'

const savingThrowDcBonusDtoSchema = z.union([
  z.strictObject({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('ABILITY_MODIFIER'),
    abilityDefinitionId: postgresUuidSchema
  }),
  z.strictObject({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('PROFICIENCY_BONUS')
  }),
  z.strictObject({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('STATIC_BONUS'),
    amount: authoredNonnegativeNumberSchema.check(z.int())
  })
])

export const savingThrowDtoSchema = z.union([
  z.strictObject({
    id: authoredIdentifierSchema,
    dcMethod: z.literal('SOURCE_SAVE_DC'),
    abilityDefinitionId: postgresUuidSchema
  }),
  z.strictObject({
    id: authoredIdentifierSchema,
    dcMethod: z.literal('FIXED_DC'),
    abilityDefinitionId: postgresUuidSchema,
    baseDc: z.number().check(z.int()),
    bonuses: z.optional(authoredNestedCollectionSchema(savingThrowDcBonusDtoSchema))
  }),
  z.strictObject({
    id: authoredIdentifierSchema,
    dcMethod: z.literal('DERIVED_DC'),
    abilityDefinitionId: postgresUuidSchema,
    baseDc: z.number().check(z.int()),
    bonuses: authoredNestedCollectionSchema(savingThrowDcBonusDtoSchema)
  })
])

export type SavingThrowDto = z.infer<typeof savingThrowDtoSchema>
