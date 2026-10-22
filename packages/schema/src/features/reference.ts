import { z, lazySchema } from '../zod.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { diceExpressionDtoSchema } from '../shared/dice.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

export const featureRollDefinitionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    kind: z.enum(['ATTACK', 'DAMAGE', 'HEALING', 'ABILITY_CHECK', 'SAVING_THROW']),
    expression: diceExpressionDtoSchema,
    rollMode: z._default(systemCoreCodeSchema, 'NORMAL'),
    chargeCost: z._default(z.nullable(z.number().check(z.int()).check(z.positive())), null),
    order: z.number().check(z.int()).check(z.nonnegative())
  })
)
export type FeatureRollDefinitionDto = z.infer<typeof featureRollDefinitionDtoSchema>

/** Exact authored fields used by Encounter Feature references. */
export const featureReferenceDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    description: authoredRichTextSchema,
    section: z.optional(
      z.enum([
        'TRAIT',
        'ACTION',
        'BONUS_ACTION',
        'REACTION',
        'LEGENDARY_ACTION',
        'LAIR_ACTION',
        'REGIONAL_EFFECT',
        'OTHER'
      ])
    ),
    rollDefinitions: z.optional(authoredNestedCollectionSchema(featureRollDefinitionDtoSchema))
  })
)
