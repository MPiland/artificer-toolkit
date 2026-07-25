import { z } from 'zod'
import { detailDtoSchema, diceExpressionDtoSchema, speedDtoSchema } from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { proficiencyGrantDtoSchema } from '../grants/index.js'
import { costDtoSchema } from './shared.js'
import {
  authoredRecordStatusSchema,
  creatureCategoryCodeSchema,
  measurementUnitCodeSchema,
  sizeCodeSchema
} from '../shared/enums.js'

export const creatureMountProfileDtoSchema = z.object({
  mountType: z.enum(['CONTROLLED', 'INDEPENDENT']),
  capacity: z.number().optional(),
  riderCount: z.number().optional(),
  notes: z.string().optional()
})

export const creatureCompanionProfileDtoSchema = z.object({
  bondType: z.enum(['FAMILIAR', 'ANIMAL_COMPANION', 'SUMMON']),
  initiativeMode: z.enum(['USES_PC_INITIATIVE', 'OWN_INITIATIVE']),
  notes: z.string().optional()
})

export const creatureNpcProfileDtoSchema = z.object({
  bonds: z.array(z.string()).optional(),
  flaws: z.array(z.string()).optional(),
  ideals: z.array(z.string()).optional(),
  personalityTraits: z.array(z.string()).optional()
})

export const creatureAbilityScoresDtoSchema = z.object({
  STRENGTH: z.number(),
  DEXTERITY: z.number(),
  CONSTITUTION: z.number(),
  INTELLIGENCE: z.number(),
  WISDOM: z.number(),
  CHARISMA: z.number()
})

// Primitive-array group editors stage rows as `{ value }`. Normalize that
// authoring shape at the contract boundary so persisted and response DTOs stay
// the canonical `string[]` used by the compiler and repository.
const creatureLogisticsNoteDtoSchema = z
  .union([z.string(), z.object({ value: z.string() })])
  .transform((note) => (typeof note === 'string' ? note : note.value))

const creatureAuthoredDtoSchemaBase = z.object({
  id: z.string(),
  label: z.string(),
  quote: z.string().optional(),
  description: z.string().optional(),
  status: authoredRecordStatusSchema.optional(),
  details: z.array(detailDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional(),
  proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string(),
  category: creatureCategoryCodeSchema,
  creatureTypeId: z.string(),
  size: sizeCodeSchema,
  alignmentId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  abilityScores: creatureAbilityScoresDtoSchema,
  armorClass: z.number().int().nonnegative(),
  armorClassNote: z.string().optional(),
  hitPoints: z.number().int().nonnegative(),
  hitDice: diceExpressionDtoSchema.optional(),
  speeds: z.array(speedDtoSchema),
  senses: z.array(z.string()).optional(),
  passivePerception: z.number().optional(),
  damageVulnerabilities: z.array(z.string()).optional(),
  damageResistances: z.array(z.string()).optional(),
  damageImmunities: z.array(z.string()).optional(),
  conditionImmunities: z.array(z.string()).optional(),
  challengeRatingId: z.string().optional(),
  xp: z.number().optional(),
  npcProfile: creatureNpcProfileDtoSchema.optional(),
  cost: costDtoSchema.optional(),
  carryingCapacity: z
    .object({
      amount: z.number(),
      unit: measurementUnitCodeSchema
    })
    .optional(),
  logisticsNotes: z.array(creatureLogisticsNoteDtoSchema).optional(),
  mountProfile: creatureMountProfileDtoSchema.optional(),
  companionProfile: creatureCompanionProfileDtoSchema.optional()
})

export type CreatureAuthoredDto = z.infer<typeof creatureAuthoredDtoSchemaBase>
export const creatureAuthoredDtoSchema = creatureAuthoredDtoSchemaBase

export const creatureAuthoringInputDtoSchema = creatureAuthoredDtoSchemaBase.extend({
  userId: z.string().optional()
})

export type CreatureAuthoringInputDto = z.infer<typeof creatureAuthoringInputDtoSchema>
