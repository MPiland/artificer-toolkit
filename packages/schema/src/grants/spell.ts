import { z, lazySchema } from '../zod.js'

import { chargeUseDtoSchema } from '../shared/charge.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import {
  authoringModeKindSchema,
  spellGrantAccessSchema,
  spellGrantAttributeSchema
} from '../shared/enums.js'
import { spellFacetDtoSchema } from '../shared/facet.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'
import { createScalingGrantDtoSchema, staticGrantBaseDtoSchema } from './grant.js'

const spellGrantTargetDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.ALL)
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      spellIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
    })
  ])
)

export const spellGrantDtoSchema = lazySchema(() =>
  z.intersection(
    z.extend(staticGrantBaseDtoSchema, {
      grantKind: z.literal('SPELL_GRANT'),
      castAtLevel: z.optional(z.number().check(z.int()).check(z.positive())),
      castingAbility: z.optional(systemCoreCodeSchema),
      attributes: z.optional(authoredReferenceCollectionSchema(spellGrantAttributeSchema)),
      filters: z.optional(spellFacetDtoSchema),
      charges: z.optional(chargeUseDtoSchema),
      allowedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      ),
      perTargetLockout: z.optional(z.object({ until: z.literal('SOURCE_LONG_REST') })),
      slotCost: z.optional(z.object({ poolCode: systemCoreCodeSchema })),
      access: z.optional(spellGrantAccessSchema),
      classListIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema))
    }),
    createScalingGrantDtoSchema(spellGrantTargetDtoSchema)
  )
)

export type SpellGrantDto = z.infer<typeof spellGrantDtoSchema>
