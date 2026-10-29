import { z, lazySchema } from '../zod.js'

import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { higherLevelCheckDtoSchema } from '../shared/reaction.js'

/** What an END_EFFECTS outcome matches; see `EndEffectsSelectorAuthored`. */
export const endEffectsSelectorDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('CONDITION'),
      conditionIds: authoredNestedCollectionSchema(postgresUuidSchema).check(z.minLength(1))
    }),
    z
      .object({
        kind: z.literal('SPELL_LEVEL'),
        limit: z.enum(['SLOT_LEVEL', 'FIXED']),
        level: z.optional(z.number().check(z.int()).check(z.gte(0)).check(z.lte(9)))
      })
      .check(
        z.refine(
          (selector) => (selector.limit === 'FIXED') === (selector.level !== undefined),
          'A fixed spell-level limit names its level, and a slot-level limit names none.'
        )
      ),
    z.object({ kind: z.literal('SAME_EFFECT') })
  ])
)

export const endEffectsDtoSchema = lazySchema(() =>
  z
    .object({
      id: authoredIdentifierSchema,
      effectKind: z.literal('END_EFFECTS'),
      scope: z.enum(['ALL', 'ONE_CHOSEN']),
      selectors: authoredNestedCollectionSchema(endEffectsSelectorDtoSchema).check(
        z.minLength(1),
        z.maxLength(4)
      ),
      originCreatureTypeIds: z.optional(authoredNestedCollectionSchema(authoredIdentifierSchema)),
      levelCheck: z.optional(higherLevelCheckDtoSchema)
    })
    .check(
      z.refine(
        (outcome) =>
          outcome.levelCheck === undefined ||
          (outcome.scope === 'ALL' &&
            outcome.selectors.some(
              (selector) => selector.kind === 'SPELL_LEVEL' && selector.limit === 'SLOT_LEVEL'
            )),
        'A level check ends every matching effect and rides a spell-level selector limited by the cast level.'
      )
    )
)
