import { z, lazySchema } from '../zod.js'

import { chargeUseDtoSchema } from '../shared/charge.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import { authoringModeKindSchema } from '../shared/enums.js'
import { rangeDtoSchema } from '../shared/range.js'
import { createScalingGrantDtoSchema, staticGrantBaseDtoSchema } from './grant.js'

const senseGrantTargetDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.ALL)
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      senseIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
    })
  ])
)

export const senseGrantDtoSchema = lazySchema(() =>
  z.intersection(
    z.extend(staticGrantBaseDtoSchema, {
      grantKind: z.literal('SENSE_GRANT'),
      charges: z.optional(chargeUseDtoSchema),
      range: z.optional(rangeDtoSchema)
    }),
    createScalingGrantDtoSchema(senseGrantTargetDtoSchema)
  )
)

export type SenseGrantDto = z.infer<typeof senseGrantDtoSchema>
