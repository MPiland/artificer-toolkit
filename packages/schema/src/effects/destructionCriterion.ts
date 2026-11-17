import { z, lazySchema } from '../zod.js'
import {
  authoredIdentifierSchema,
  authoredNonnegativeNumberSchema,
  authoredReferenceCollectionSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'

/**
 * One way an authored manifestation, or one of its components, is destroyed: a damage threshold,
 * wind, a spell able to do something, or a named object. A layered zone's placed layers keep their
 * component's criteria for the GM who destroys them (D223).
 */
export const manifestDestructionCriterionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      kind: z.literal('DAMAGE_THRESHOLD'),
      damageTypeId: authoredIdentifierSchema,
      amount: authoredNonnegativeNumberSchema
    }),
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      kind: z.literal('STRONG_WIND')
    }),
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      kind: z.literal('WIND_SPEED'),
      minimumMilesPerHour: z.number().check(z.positive()),
      afterRounds: z.number().check(z.int()).check(z.positive())
    }),
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      kind: z.literal('SPELL_CAPABILITY'),
      capability: z.enum([
        'OPEN_PORTAL_ON_SOLID_SURFACE',
        'SHED_BRIGHT_LIGHT',
        'END_SPELL_OR_MAGICAL_EFFECT'
      ]),
      minimumSpellLevel: authoredNonnegativeNumberSchema.check(z.int()).check(z.lte(9)),
      exampleSpellIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema))
    }),
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      kind: z.literal('NAMED_OBJECT'),
      objectLabel: authoredShortTextSchema
    })
  ])
)

export type ManifestDestructionCriterionDto = z.infer<typeof manifestDestructionCriterionDtoSchema>
