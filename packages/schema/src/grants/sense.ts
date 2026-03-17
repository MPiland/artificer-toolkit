import { z } from 'zod'

import { chargeDtoSchema } from '../shared/charge.js'
import { authoringModeKindSchema } from '../shared/enums.js'
import { grantProgressionFieldsDtoSchema, scalingGrantBaseDtoSchema } from './grant.js'

const senseGrantTargetDtoSchema = z.union([
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    senseIds: z.array(z.string())
  })
])

export const senseGrantDtoSchema = scalingGrantBaseDtoSchema.extend({
  grantKind: z.literal('SENSE_GRANT'),
  charges: chargeDtoSchema.optional()
}).and(senseGrantTargetDtoSchema).and(z.union([
  z.object({
    scalingKind: z.literal('NONE')
  }),
  z.object({
    scalingKind: z.literal('PER_LEVEL')
  }).and(grantProgressionFieldsDtoSchema)
]))

export type SenseGrantDto = z.infer<typeof senseGrantDtoSchema>
