import { z, lazySchema } from '../zod.js'
import { speedDtoSchema } from '../shared/speed.js'
import { numericExprSchema } from '../shared/numericExpr.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredPlainTextSchema,
  authoredReferenceCollectionSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'

const summonAbilityScoresDtoSchema = lazySchema(() =>
  z.object({
    STRENGTH: z.optional(numericExprSchema),
    DEXTERITY: z.optional(numericExprSchema),
    CONSTITUTION: z.optional(numericExprSchema),
    INTELLIGENCE: z.optional(numericExprSchema),
    WISDOM: z.optional(numericExprSchema),
    CHARISMA: z.optional(numericExprSchema)
  })
)

/**
 * The creature a SUMMON manifest conjures. Its own module so play-state contracts that snapshot it
 * (a Sheet spell summon) do not load the authored effect graph.
 */
export const summonStatBlockDtoSchema = lazySchema(() =>
  z.object({
    size: z.optional(authoredIdentifierSchema),
    armorClass: z.optional(numericExprSchema),
    armorClassNote: z.optional(authoredPlainTextSchema),
    hitPoints: z.optional(numericExprSchema),
    speeds: z.optional(authoredNestedCollectionSchema(speedDtoSchema)),
    abilityScores: z.optional(summonAbilityScoresDtoSchema),
    senses: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
    passivePerception: z.optional(numericExprSchema),
    damageVulnerabilities: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
    damageResistances: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
    damageImmunities: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
    conditionImmunities: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
    damageabilityKind: z.optional(z.enum(['NORMAL', 'INVULNERABLE', 'SPECIAL'])),
    visibilityKind: z.optional(z.enum(['VISIBLE', 'INVISIBLE', 'SPECIAL'])),
    occupiesSpace: z.optional(z.boolean())
  })
)

export type SummonStatBlockDto = z.infer<typeof summonStatBlockDtoSchema>
