import { z, lazySchema } from '../zod.js'

import { chargeUseDtoSchema } from '../shared/charge.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import {
  abilityCodeSchema,
  authoringModeKindSchema,
  spellGrantAttributeSchema
} from '../shared/enums.js'
import { spellFacetDtoSchema } from '../shared/facet.js'
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
      castingAbility: z.optional(abilityCodeSchema),
      attributes: z.optional(authoredReferenceCollectionSchema(spellGrantAttributeSchema)),
      filters: z.optional(spellFacetDtoSchema),
      charges: z.optional(chargeUseDtoSchema)
    }),
    createScalingGrantDtoSchema(spellGrantTargetDtoSchema)
  )
)

export type SpellGrantDto = z.infer<typeof spellGrantDtoSchema>
