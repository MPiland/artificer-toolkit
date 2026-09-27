import { z, lazySchema } from '../zod.js'

import { chargeUseDtoSchema } from '../shared/charge.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import { authoringModeKindSchema } from '../shared/enums.js'
import { rangeDtoSchema } from '../shared/range.js'
import {
  createGrantProgressionFieldsDtoSchema,
  scalingGrantBaseDtoSchema,
  validateGrantProgressionSelectionFields
} from './grant.js'

const senseGrantTargetDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      authoringModeKind: z.optional(z.literal(authoringModeKindSchema._zod.def.entries.ALL))
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      senseIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
    })
  ])
)
const senseGrantProgressionFieldsDtoSchema = lazySchema(() =>
  createGrantProgressionFieldsDtoSchema(senseGrantTargetDtoSchema)
)

export const senseGrantDtoSchema = lazySchema(() =>
  z
    .intersection(
      z.intersection(
        z.extend(scalingGrantBaseDtoSchema, {
          grantKind: z.literal('SENSE_GRANT'),
          charges: z.optional(chargeUseDtoSchema),
          range: z.optional(rangeDtoSchema)
        }),
        senseGrantTargetDtoSchema
      ),
      z.union([
        z.object({
          scalingKind: z.literal('NONE')
        }),
        z.intersection(
          z.object({
            scalingKind: z.literal('PER_LEVEL')
          }),
          senseGrantProgressionFieldsDtoSchema
        )
      ])
    )
    .check(z.superRefine(validateGrantProgressionSelectionFields))
)

export type SenseGrantDto = z.infer<typeof senseGrantDtoSchema>
