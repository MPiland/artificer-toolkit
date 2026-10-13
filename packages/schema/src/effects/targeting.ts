import { z, lazySchema } from '../zod.js'
import { createBreakpointScalingDtoSchema } from '../shared/scaling.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'

export const targetingDtoSchema = lazySchema(() =>
  z.discriminatedUnion('selectionKind', [
    z.object({
      selectionKind: z.literal('SELF')
    }),
    z.object({
      selectionKind: z.literal('SINGLE_TARGET'),
      dispositionKind: z.optional(z.enum(['ANY', 'WILLING', 'HOSTILE'])),
      excludesSelf: z.optional(z.boolean()),
      refusesSelf: z.optional(z.boolean()),
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
      resolutionCount: z.optional(z.number().check(z.int()).check(z.positive())),
      resolutionCountScaling: z.optional(
        createBreakpointScalingDtoSchema(
          z.object({
            amount: z.number().check(z.int()).check(z.positive())
          })
        )
      ),
      allowRepeatedTargets: z.optional(z.boolean()),
      excludedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      )
    }),
    z.object({
      selectionKind: z.literal('AREA_CONTENTS'),
      dispositionKind: z.optional(z.enum(['ANY', 'WILLING', 'HOSTILE'])),
      excludedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      )
    })
  ])
)

export type TargetingDto = z.infer<typeof targetingDtoSchema>
