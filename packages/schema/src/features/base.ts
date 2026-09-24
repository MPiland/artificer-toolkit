import { z } from '../zod.js'

import {
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import { featureReferenceDtoSchema } from './reference.js'
import { chargeUseDtoSchema } from '../shared/charge.js'
import { detailDtoSchema } from '../shared/detail.js'
import { facetDtoSchema } from '../shared/facet.js'
import { postgresUuidSchema as serverUuidIdentityDtoSchema } from '../shared/postgresUuid.js'
import { featureAttributeSchema } from '../shared/enums.js'
import { effectDtoSchema } from '../effects/effect.js'
import { featGrantDtoSchema } from '../grants/feat.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { senseGrantDtoSchema } from '../grants/sense.js'
import { spellGrantDtoSchema } from '../grants/spell.js'

const featureGrantsDtoSchemaBase = z.object({
  feats: z.optional(authoredNestedCollectionSchema(featGrantDtoSchema)),
  modifiers: z.optional(authoredNestedCollectionSchema(modifierGrantDtoSchema)),
  proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema)),
  senses: z.optional(authoredNestedCollectionSchema(senseGrantDtoSchema)),
  spells: z.optional(authoredNestedCollectionSchema(spellGrantDtoSchema))
})

const ruleDefinitionIdsDtoSchema = z
  .array(serverUuidIdentityDtoSchema)
  .check(z.maxLength(16))
  .check(
    z.superRefine((definitionIds, context) => {
      for (let index = 1; index < definitionIds.length; index += 1) {
        if (definitionIds[index - 1] >= definitionIds[index]) {
          context.addIssue({
            code: 'custom',
            path: [index],
            message: 'Rule definition IDs must be unique and in canonical ascending UUID order.'
          })
        }
      }
    })
  )

export { featureRollDefinitionDtoSchema, type FeatureRollDefinitionDto } from './reference.js'

export type FeatureGrantsDto = z.infer<typeof featureGrantsDtoSchemaBase>
export const featureGrantsDtoSchema: z.ZodMiniType<FeatureGrantsDto> = featureGrantsDtoSchemaBase

const featureBaseDtoSchemaBase = z.object({
  id: featureReferenceDtoSchema.shape.id,
  label: featureReferenceDtoSchema.shape.label,
  description: featureReferenceDtoSchema.shape.description,
  attributes: z.optional(authoredReferenceCollectionSchema(featureAttributeSchema)),
  detail: z.optional(z.never()),
  details: z.optional(authoredNestedCollectionSchema(detailDtoSchema)),
  effects: z.optional(authoredNestedCollectionSchema(effectDtoSchema)),
  rollDefinitions: featureReferenceDtoSchema.shape.rollDefinitions,
  ruleDefinitionIds: z.optional(ruleDefinitionIdsDtoSchema),
  charges: z.optional(chargeUseDtoSchema),
  grants: z.optional(featureGrantsDtoSchema),
  restrictions: z.optional(facetDtoSchema),
  order: z.number().check(z.int())
})

export type FeatureBaseDto = z.infer<typeof featureBaseDtoSchemaBase>
export const featureBaseDtoSchema: z.ZodMiniType<FeatureBaseDto> = featureBaseDtoSchemaBase
export const featureBaseDtoObject = featureBaseDtoSchemaBase
