import { z } from 'zod'

import { chargeDtoSchema } from '../shared/charge.js'
import { scalingGrantBaseDtoSchema } from './grant.js'

export const featGrantDtoSchema = scalingGrantBaseDtoSchema.extend({
  grantKind: z.literal('FEAT_GRANT'),
  featIds: z.array(z.string()).optional(),
  charges: chargeDtoSchema.optional()
})

export type FeatGrantDto = z.infer<typeof featGrantDtoSchema>
