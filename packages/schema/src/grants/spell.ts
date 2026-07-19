import { z } from 'zod'

import { chargeDtoSchema } from '../shared/charge.js'
import { authoringModeKindSchema, spellGrantAttributeSchema } from '../shared/enums.js'
import { facetDtoSchema } from '../shared/facet.js'
import {
  createGrantProgressionFieldsDtoSchema,
  scalingGrantBaseDtoSchema,
  validateGrantProgressionSelectionFields
} from './grant.js'

const spellGrantTargetDtoSchema = z.union([
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    spellIds: z.array(z.string())
  })
])
const spellGrantProgressionFieldsDtoSchema = createGrantProgressionFieldsDtoSchema(
  spellGrantTargetDtoSchema
)

export const spellGrantDtoSchema = scalingGrantBaseDtoSchema.extend({
  grantKind: z.literal('SPELL_GRANT'),
  castAtLevel: z.number().int().optional(),
  attributes: z.array(spellGrantAttributeSchema).optional(),
  filters: facetDtoSchema.optional(),
  charges: chargeDtoSchema.optional()
}).and(spellGrantTargetDtoSchema).and(z.union([
  z.object({
    scalingKind: z.literal('NONE')
  }),
  z.object({
    scalingKind: z.literal('PER_LEVEL')
  }).and(spellGrantProgressionFieldsDtoSchema)
])).superRefine(validateGrantProgressionSelectionFields)

export type SpellGrantDto = z.infer<typeof spellGrantDtoSchema>
