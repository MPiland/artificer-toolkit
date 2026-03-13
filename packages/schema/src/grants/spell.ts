import { z } from 'zod'

import { chargeDtoSchema } from '../shared/charge.js'
import { spellGrantAttributeSchema } from '../shared/enums.js'
import { facetDtoSchema } from '../shared/facet.js'
import { scalingGrantBaseDtoSchema } from './grant.js'

export const spellGrantDtoSchema = scalingGrantBaseDtoSchema.extend({
  grantKind: z.literal('SPELL_GRANT'),
  spellIds: z.array(z.string()).optional(),
  castAtLevel: z.number().int().optional(),
  attributes: z.array(spellGrantAttributeSchema).optional(),
  filters: facetDtoSchema.optional(),
  charges: chargeDtoSchema.optional()
})

export type SpellGrantDto = z.infer<typeof spellGrantDtoSchema>
