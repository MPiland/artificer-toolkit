import { z } from 'zod'

import { chargeDtoSchema } from '../shared/charge.js'
import { scalingGrantBaseDtoSchema } from './grant.js'

export const senseGrantDtoSchema = scalingGrantBaseDtoSchema.extend({
  grantKind: z.literal('SENSE_GRANT'),
  senseIds: z.array(z.string()).optional(),
  charges: chargeDtoSchema.optional()
})

export type SenseGrantDto = z.infer<typeof senseGrantDtoSchema>
