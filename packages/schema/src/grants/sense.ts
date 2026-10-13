import type { SenseRangeKind } from '@artificer-toolkit/shared/core'

import { z, lazySchema } from '../zod.js'

import { chargeUseDtoSchema } from '../shared/charge.js'
import {
  authoredIdentifierSchema,
  authoredLengthAmountSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import { authoringModeKindSchema, lengthUnitCodeSchema, rangeKindSchema } from '../shared/enums.js'
import { unlimitedRangeDtoSchema } from '../shared/range.js'
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

/**
 * A sense reaches a set distance or is unlimited; it has no long range and does not scale. Keyed by
 * `SenseRangeKind` so the schema and the authoring map cannot disagree on which kinds exist.
 */
const senseRangeShapes = {
  DISTANCE: lazySchema(() =>
    z.strictObject({
      // A Creature's range pins into the room unchanged, and the pinned contract needs an id.
      id: authoredIdentifierSchema.check(z.trim()).check(z.minLength(1)),
      rangeKind: z.literal(rangeKindSchema._zod.def.entries.DISTANCE),
      amount: authoredLengthAmountSchema,
      unit: lengthUnitCodeSchema
    })
  ),
  UNLIMITED: unlimitedRangeDtoSchema
} satisfies Record<SenseRangeKind, unknown>

export const senseRangeDtoSchema = lazySchema(() =>
  z.union([senseRangeShapes.UNLIMITED, senseRangeShapes.DISTANCE])
)

export const senseGrantDtoSchema = lazySchema(() =>
  z.intersection(
    z.extend(staticGrantBaseDtoSchema, {
      grantKind: z.literal('SENSE_GRANT'),
      charges: z.optional(chargeUseDtoSchema),
      range: senseRangeDtoSchema
    }),
    createScalingGrantDtoSchema(senseGrantTargetDtoSchema)
  )
)

export type SenseRangeDto = z.infer<typeof senseRangeDtoSchema>
export type SenseGrantDto = z.infer<typeof senseGrantDtoSchema>
