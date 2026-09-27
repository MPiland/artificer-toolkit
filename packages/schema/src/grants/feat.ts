import { z, lazySchema } from '../zod.js'

import { chargeUseDtoSchema } from '../shared/charge.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import { authoringModeKindSchema } from '../shared/enums.js'
import {
  createGrantProgressionFieldsDtoSchema,
  scalingGrantBaseDtoSchema,
  validateGrantProgressionSelectionFields
} from './grant.js'

const featGrantTargetDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      authoringModeKind: z.optional(z.literal(authoringModeKindSchema._zod.def.entries.ALL))
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      featIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
    })
  ])
)
const featGrantProgressionFieldsDtoSchema = lazySchema(() =>
  createGrantProgressionFieldsDtoSchema(featGrantTargetDtoSchema)
)

export const featGrantDtoSchema = lazySchema(() =>
  z
    .intersection(
      z.intersection(
        z.extend(scalingGrantBaseDtoSchema, {
          grantKind: z.literal('FEAT_GRANT'),
          charges: z.optional(chargeUseDtoSchema)
        }),
        featGrantTargetDtoSchema
      ),
      z.union([
        z.object({
          scalingKind: z.literal('NONE')
        }),
        z.intersection(
          z.object({
            scalingKind: z.literal('PER_LEVEL')
          }),
          featGrantProgressionFieldsDtoSchema
        )
      ])
    )
    .check(z.superRefine(validateGrantProgressionSelectionFields))
)

export type FeatGrantDto = z.infer<typeof featGrantDtoSchema>
