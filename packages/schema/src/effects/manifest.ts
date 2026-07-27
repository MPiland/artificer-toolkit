import { z } from 'zod'
import { manifestNestedBehaviorDtoSchema } from './effect.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { numericExprSchema } from '../shared/numericExpr.js'
import { measurementUnitCodeSchema } from '../shared/enums.js'

const speedDtoSchema = z.object({
  speedId: z.string(),
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
  size: z.string().optional(),
  armorClass: numericExprSchema.optional(),
  armorClassNote: z.string().optional(),
  hitPoints: numericExprSchema.optional(),
  speeds: z.array(speedDtoSchema).optional(),
  abilityScores: summonAbilityScoresDtoSchema.optional(),
  senses: z.array(z.string()).optional(),
  passivePerception: numericExprSchema.optional(),
  damageVulnerabilities: z.array(z.string()).optional(),
  damageResistances: z.array(z.string()).optional(),
  damageImmunities: z.array(z.string()).optional(),
  conditionImmunities: z.array(z.string()).optional(),
  damageabilityKind: z.enum(['NORMAL', 'INVULNERABLE', 'SPECIAL']).optional(),
  visibilityKind: z.enum(['VISIBLE', 'INVISIBLE', 'SPECIAL']).optional(),
  occupiesSpace: z.boolean().optional()
})

export const manifestDtoSchema: z.ZodTypeAny = z.lazy(() => {
  const baseSchema = z.object({
    id: z.string(),
    effectKind: z.literal('MANIFEST'),
    label: z.string().optional(),
    shape: shapeDtoSchema.optional()
  })

  return z.discriminatedUnion('manifestKind', [
    baseSchema.extend({
      manifestKind: z.literal('CREATURE'),
      creatureId: z.string().optional()
    }),
    baseSchema.extend({
      manifestKind: z.literal('SUMMON'),
      statBlock: summonStatBlockDtoSchema.optional(),
      behaviors: z.array(manifestNestedBehaviorDtoSchema).optional()
    }),
    baseSchema.extend({
      manifestKind: z.enum(['ZONE', 'SENSOR', 'WEAPON', 'OBJECT', 'ILLUSION']),
      behaviors: z.array(manifestNestedBehaviorDtoSchema).optional()
    })
  ])
})

export type ManifestDto = z.infer<typeof manifestDtoSchema>
