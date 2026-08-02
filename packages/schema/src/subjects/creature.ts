import { z } from 'zod'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredPlainTextSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema,
  detailDtoSchema,
  diceExpressionDtoSchema,
  speedDtoSchema
} from '../shared/index.js'
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
  notes: authoredPlainTextSchema.optional()
})

export const creatureCompanionProfileDtoSchema = z.object({
  bondType: z.enum(['FAMILIAR', 'ANIMAL_COMPANION', 'SUMMON']),
  initiativeMode: z.enum(['USES_PC_INITIATIVE', 'OWN_INITIATIVE']),
  notes: authoredPlainTextSchema.optional()
})

export const creatureNpcProfileDtoSchema = z.object({
  bonds: authoredReferenceCollectionSchema(authoredPlainTextSchema).optional(),
  flaws: authoredReferenceCollectionSchema(authoredPlainTextSchema).optional(),
  ideals: authoredReferenceCollectionSchema(authoredPlainTextSchema).optional(),
  personalityTraits: authoredReferenceCollectionSchema(authoredPlainTextSchema).optional()
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
  .union([authoredPlainTextSchema, z.object({ value: authoredPlainTextSchema })])
  .transform((note) => (typeof note === 'string' ? note : note.value))

const creatureAuthoredDtoSchemaBase = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  quote: authoredRichTextSchema.optional(),
  description: authoredRichTextSchema.optional(),
  status: authoredRecordStatusSchema.optional(),
  details: authoredNestedCollectionSchema(detailDtoSchema).optional(),
  features: authoredNestedCollectionSchema(featureDtoSchema).optional(),
  proficiencies: authoredNestedCollectionSchema(proficiencyGrantDtoSchema).optional(),
  userId: authoredIdentifierSchema,
  systemId: authoredIdentifierSchema,
  category: creatureCategoryCodeSchema,
  creatureTypeId: authoredIdentifierSchema,
  size: sizeCodeSchema,
  alignmentId: authoredIdentifierSchema.optional(),
  tags: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  abilityScores: creatureAbilityScoresDtoSchema,
  armorClass: z.number().int().nonnegative(),
  armorClassNote: authoredPlainTextSchema.optional(),
  hitPoints: z.number().int().nonnegative(),
  hitDice: diceExpressionDtoSchema.optional(),
  speeds: authoredNestedCollectionSchema(speedDtoSchema),
  senses: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  passivePerception: z.number().optional(),
  damageVulnerabilities: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  damageResistances: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  damageImmunities: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  conditionImmunities: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  challengeRatingId: authoredIdentifierSchema.optional(),
  xp: z.number().optional(),
  npcProfile: creatureNpcProfileDtoSchema.optional(),
  cost: costDtoSchema.optional(),
  carryingCapacity: z
    .object({
      amount: z.number(),
      unit: measurementUnitCodeSchema
    })
    .optional(),
  logisticsNotes: authoredReferenceCollectionSchema(creatureLogisticsNoteDtoSchema).optional(),
  mountProfile: creatureMountProfileDtoSchema.optional(),
  companionProfile: creatureCompanionProfileDtoSchema.optional()
})

export type CreatureAuthoredDto = z.infer<typeof creatureAuthoredDtoSchemaBase>
export const creatureAuthoredDtoSchema = creatureAuthoredDtoSchemaBase

export const creatureAuthoringInputDtoSchema = creatureAuthoredDtoSchemaBase.extend({
  userId: authoredIdentifierSchema.optional()
})

export type CreatureAuthoringInputDto = z.infer<typeof creatureAuthoringInputDtoSchema>
