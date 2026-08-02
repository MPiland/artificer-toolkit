import { z } from 'zod'
import { manifestNestedBehaviorDtoSchema } from './effect.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { numericExprSchema } from '../shared/numericExpr.js'
import { measurementUnitCodeSchema } from '../shared/enums.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredPlainTextSchema,
  authoredReferenceCollectionSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'

const speedDtoSchema = z.object({
  speedId: authoredIdentifierSchema,
  amount: z.number(),
  unit: measurementUnitCodeSchema
})

const summonAbilityScoresDtoSchema = z.object({
  STRENGTH: numericExprSchema.optional(),
  DEXTERITY: numericExprSchema.optional(),
  CONSTITUTION: numericExprSchema.optional(),
  INTELLIGENCE: numericExprSchema.optional(),
  WISDOM: numericExprSchema.optional(),
  CHARISMA: numericExprSchema.optional()
})

const summonStatBlockDtoSchema = z.object({
  size: authoredIdentifierSchema.optional(),
  armorClass: numericExprSchema.optional(),
  armorClassNote: authoredPlainTextSchema.optional(),
  hitPoints: numericExprSchema.optional(),
  speeds: authoredNestedCollectionSchema(speedDtoSchema).optional(),
  abilityScores: summonAbilityScoresDtoSchema.optional(),
  senses: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  passivePerception: numericExprSchema.optional(),
  damageVulnerabilities: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  damageResistances: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  damageImmunities: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  conditionImmunities: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  damageabilityKind: z.enum(['NORMAL', 'INVULNERABLE', 'SPECIAL']).optional(),
  visibilityKind: z.enum(['VISIBLE', 'INVISIBLE', 'SPECIAL']).optional(),
  occupiesSpace: z.boolean().optional()
})

export const manifestDtoSchema: z.ZodTypeAny = z.lazy(() => {
  const baseSchema = z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('MANIFEST'),
    label: authoredShortTextSchema.optional(),
    shape: shapeDtoSchema.optional()
  })

  return z.discriminatedUnion('manifestKind', [
    baseSchema.extend({
      manifestKind: z.literal('CREATURE'),
      creatureId: authoredIdentifierSchema.optional()
    }),
    baseSchema.extend({
      manifestKind: z.literal('SUMMON'),
      statBlock: summonStatBlockDtoSchema.optional(),
      behaviors: authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema).optional()
    }),
    baseSchema.extend({
      manifestKind: z.enum(['ZONE', 'SENSOR', 'WEAPON', 'OBJECT', 'ILLUSION']),
      behaviors: authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema).optional()
    })
  ])
})

export type ManifestDto = z.infer<typeof manifestDtoSchema>
