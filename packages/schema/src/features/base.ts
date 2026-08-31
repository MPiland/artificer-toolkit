import { z } from 'zod'

import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { chargeUseDtoSchema } from '../shared/charge.js'
import { detailDtoSchema } from '../shared/detail.js'
import { facetDtoSchema } from '../shared/facet.js'
import { serverUuidIdentityDtoSchema } from '../shared/rulesExecution.js'
import { featureAttributeSchema } from '../shared/enums.js'
import { effectDtoSchema } from '../effects/effect.js'
import { diceExpressionDtoSchema } from '../shared/dice.js'
import {
  featGrantDtoSchema,
  modifierGrantDtoSchema,
  proficiencyGrantDtoSchema,
  senseGrantDtoSchema,
  spellGrantDtoSchema
} from '../grants/index.js'

const featureGrantsDtoSchemaBase = z.object({
  feats: authoredNestedCollectionSchema(featGrantDtoSchema).optional(),
  modifiers: authoredNestedCollectionSchema(modifierGrantDtoSchema).optional(),
  proficiencies: authoredNestedCollectionSchema(proficiencyGrantDtoSchema).optional(),
  senses: authoredNestedCollectionSchema(senseGrantDtoSchema).optional(),
  spells: authoredNestedCollectionSchema(spellGrantDtoSchema).optional()
})

const ruleDefinitionIdsDtoSchema = z
  .array(serverUuidIdentityDtoSchema)
  .max(16)
  .superRefine((definitionIds, context) => {
    for (let index = 1; index < definitionIds.length; index += 1) {
      if (definitionIds[index - 1] >= definitionIds[index]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: 'Rule definition IDs must be unique and in canonical ascending UUID order.'
        })
      }
    }
  })

export const featureRollDefinitionDtoSchema = z.strictObject({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  kind: z.enum(['ATTACK', 'DAMAGE', 'HEALING', 'ABILITY_CHECK', 'SAVING_THROW']),
  expression: diceExpressionDtoSchema,
  rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']).default('NORMAL'),
  chargeCost: z.number().int().positive().nullable().default(null),
  order: z.number().int().nonnegative()
})
export type FeatureRollDefinitionDto = z.infer<typeof featureRollDefinitionDtoSchema>

export type FeatureGrantsDto = z.infer<typeof featureGrantsDtoSchemaBase>
export const featureGrantsDtoSchema: z.ZodType<FeatureGrantsDto> = featureGrantsDtoSchemaBase

const featureBaseDtoSchemaBase = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: authoredRichTextSchema,
  attributes: authoredReferenceCollectionSchema(featureAttributeSchema).optional(),
  detail: z.never().optional(),
  details: authoredNestedCollectionSchema(detailDtoSchema).optional(),
  effects: authoredNestedCollectionSchema(effectDtoSchema).optional(),
  rollDefinitions: authoredNestedCollectionSchema(featureRollDefinitionDtoSchema).optional(),
  ruleDefinitionIds: ruleDefinitionIdsDtoSchema.optional(),
  charges: chargeUseDtoSchema.optional(),
  grants: featureGrantsDtoSchema.optional(),
  restrictions: facetDtoSchema.optional(),
  order: z.number().int()
})

export type FeatureBaseDto = z.infer<typeof featureBaseDtoSchemaBase>
export const featureBaseDtoSchema: z.ZodType<FeatureBaseDto> = featureBaseDtoSchemaBase
export const featureBaseDtoObject = featureBaseDtoSchemaBase
