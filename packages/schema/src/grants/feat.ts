import { z, lazySchema } from '../zod.js'

import { chargeUseDtoSchema } from '../shared/charge.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import { authoringModeKindSchema } from '../shared/enums.js'
import { createScalingGrantDtoSchema, staticGrantBaseDtoSchema } from './grant.js'

const featGrantTargetDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.ALL)
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      featIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
    })
  ])
)

export const featGrantDtoSchema = lazySchema(() =>
  z.intersection(
    z.extend(staticGrantBaseDtoSchema, {
      grantKind: z.literal('FEAT_GRANT'),
      charges: z.optional(chargeUseDtoSchema)
    }),
    createScalingGrantDtoSchema(featGrantTargetDtoSchema)
  )
)

export type FeatGrantDto = z.infer<typeof featGrantDtoSchema>
