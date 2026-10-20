import { z, lazySchema } from '../zod.js'

import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'
import { chargeResetKindSchema } from '../shared/enums.js'

const spellSlotLevelDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    level: z.number().check(z.int()).check(z.minimum(1)).check(z.maximum(9)),
    amount: z.number().check(z.int()).check(z.positive())
  })
)

/** A feature's table of spell slots by spell level, spent by the feature's slot-mode spell grants. */
export const spellSlotTableDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    resetKind: chargeResetKindSchema,
    levels: authoredNestedCollectionSchema(spellSlotLevelDtoSchema)
  })
)

export type SpellSlotTableDto = z.infer<typeof spellSlotTableDtoSchema>
