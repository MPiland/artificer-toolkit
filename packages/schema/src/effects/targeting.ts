import { z, lazySchema } from '../zod.js'
import { createBreakpointScalingDtoSchema } from '../shared/scaling.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'

/** Whether a single-target action may aim at its own user: freely, with a warning, or never. */
export const targetingSelfDtoSchema = lazySchema(() => z.enum(['ALLOWED', 'WARN', 'REFUSED']))

export const targetingDtoSchema = lazySchema(() =>
  z.discriminatedUnion('selectionKind', [
    z.object({
      selectionKind: z.literal('SELF')
    }),
    z.object({
      selectionKind: z.literal('SINGLE_TARGET'),
      dispositionKind: z.optional(z.enum(['ANY', 'WILLING', 'HOSTILE'])),
      self: z.optional(targetingSelfDtoSchema),
      allowedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      ),
      excludedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      )
    }),
    z.object({
      selectionKind: z.literal('CHOSEN_CREATURES'),
      dispositionKind: z.optional(z.enum(['ANY', 'WILLING', 'HOSTILE'])),
      maxTargets: z.optional(z.number().check(z.int()).check(z.positive())),
      maxTargetsScaling: z.optional(
        createBreakpointScalingDtoSchema(
          z.object({
            amount: z.number().check(z.int()).check(z.positive())
          })
        )
      ),
      allowRepeatedTargets: z.optional(z.boolean()),
      allowedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      ),
      excludedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      )
    }),
    z.object({
      selectionKind: z.literal('AREA_CONTENTS'),
      dispositionKind: z.optional(z.enum(['ANY', 'WILLING', 'HOSTILE'])),
      allowedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      ),
      excludedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      )
    })
  ])
)

export type TargetingDto = z.infer<typeof targetingDtoSchema>
