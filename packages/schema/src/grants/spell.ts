import { z } from '../zod.js'

import { chargeUseDtoSchema } from '../shared/charge.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import {
  abilityCodeSchema,
  authoringModeKindSchema,
  spellGrantAttributeSchema
} from '../shared/enums.js'
import { facetDtoSchema } from '../shared/facet.js'
import {
  createGrantProgressionFieldsDtoSchema,
  scalingGrantBaseDtoSchema,
  validateGrantProgressionSelectionFields
} from './grant.js'

const spellGrantTargetDtoSchema = z.union([
  z.object({
    authoringModeKind: z.optional(z.literal(authoringModeKindSchema._zod.def.entries.ALL))
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
    spellIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
  })
])
const spellGrantProgressionFieldsDtoSchema =
  createGrantProgressionFieldsDtoSchema(spellGrantTargetDtoSchema)

export const spellGrantDtoSchema = z
  .intersection(
    z.intersection(
      z.extend(scalingGrantBaseDtoSchema, {
        grantKind: z.literal('SPELL_GRANT'),
        castAtLevel: z.optional(z.number().check(z.int()).check(z.positive())),
        castingAbility: z.optional(abilityCodeSchema),
        attributes: z.optional(authoredReferenceCollectionSchema(spellGrantAttributeSchema)),
        filters: z.optional(facetDtoSchema),
        charges: z.optional(chargeUseDtoSchema)
      }),
      spellGrantTargetDtoSchema
    ),
    z.union([
      z.object({
        scalingKind: z.literal('NONE')
      }),
      z.intersection(
        z.object({
          scalingKind: z.literal('PER_LEVEL')
        }),
        spellGrantProgressionFieldsDtoSchema
      )
    ])
  )
  .check(z.superRefine(validateGrantProgressionSelectionFields))

export type SpellGrantDto = z.infer<typeof spellGrantDtoSchema>
