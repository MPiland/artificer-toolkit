import { z } from 'zod'
import { detailDtoSchema, speedDtoSchema } from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { proficiencyGrantDtoSchema } from '../grants/index.js'
import { costDtoSchema } from './shared.js'
import { authoredRecordStatusSchema, measurementUnitCodeSchema } from '../shared/enums.js'

const creatureActionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  attackBonus: z.number().optional(),
  damage: z.string().optional(),
  recharge: z.string().optional()
})

const creatureLegendaryProfileDtoSchema = z.object({
  legendaryResistanceCount: z.number().int().nonnegative().optional(),
  actionsCount: z.number().int().positive()
})

const creatureLairProfileDtoSchema = z.object({
  lairActions: z.array(creatureActionDtoSchema).optional(),
  regionalEffects: z.array(z.string()).optional()
})

const creatureMountProfileDtoSchema = z.object({
  mountType: z.enum(['CONTROLLED', 'INDEPENDENT']),
  capacity: z.number().optional(),
  riderCount: z.number().optional(),
  notes: z.string().optional()
})

const creatureCompanionProfileDtoSchema = z.object({
  bondType: z.enum(['FAMILIAR', 'ANIMAL_COMPANION', 'SUMMON']),
  initiativeMode: z.enum(['USES_PC_INITIATIVE', 'OWN_INITIATIVE']),
  notes: z.string().optional()
})

const creatureNpcProfileDtoSchema = z.object({
  bonds: z.array(z.string()).optional(),
  flaws: z.array(z.string()).optional(),
  ideals: z.array(z.string()).optional(),
  personalityTraits: z.array(z.string()).optional()
})

const creatureAbilityScoresDtoSchema = z.object({
  STRENGTH: z.number(),
  DEXTERITY: z.number(),
  CONSTITUTION: z.number(),
  INTELLIGENCE: z.number(),
  WISDOM: z.number(),
  CHARISMA: z.number(),
  SPELLCASTING: z.number()
})

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
  recordKind: z.enum(['STAT_BLOCK', 'LOGISTICS']).optional().default('STAT_BLOCK'),
  category: z.enum(['NPC', 'MONSTER', 'BEAST', 'COMPANION', 'SUMMON']),
  creatureTypeId: z.string(),
  size: z.string(),
  alignmentId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  abilityScores: creatureAbilityScoresDtoSchema,
  armorClass: z.number().int().nonnegative(),
  armorClassNote: z.string().optional(),
  hitPoints: z.number().int().nonnegative(),
  hitDice: z.string().optional(),
  speeds: z.array(speedDtoSchema),
  senses: z.array(z.string()).optional(),
  passivePerception: z.number().optional(),
  damageVulnerabilities: z.array(z.string()).optional(),
  damageResistances: z.array(z.string()).optional(),
  damageImmunities: z.array(z.string()).optional(),
  conditionImmunities: z.array(z.string()).optional(),
  challengeRatingId: z.string().optional(),
  xp: z.number().optional(),
  actions: z.array(creatureActionDtoSchema).optional(),
  bonusActions: z.array(creatureActionDtoSchema).optional(),
  reactions: z.array(creatureActionDtoSchema).optional(),
  legendaryProfile: creatureLegendaryProfileDtoSchema.optional(),
  lairProfile: creatureLairProfileDtoSchema.optional(),
  npcProfile: creatureNpcProfileDtoSchema.optional(),
  cost: costDtoSchema.optional(),
  carryingCapacity: z.object({
    amount: z.number(),
    unit: measurementUnitCodeSchema
  }).optional(),
  logisticsNotes: z.array(z.string()).optional(),
  mountProfile: creatureMountProfileDtoSchema.optional(),
  companionProfile: creatureCompanionProfileDtoSchema.optional()
})

export type CreatureAuthoredDto = z.infer<typeof creatureAuthoredDtoSchemaBase>
export const creatureAuthoredDtoSchema = creatureAuthoredDtoSchemaBase

export const creatureAuthoringInputDtoSchema = creatureAuthoredDtoSchemaBase.extend({
  userId: z.string().optional()
})

export type CreatureAuthoringInputDto = z.infer<typeof creatureAuthoringInputDtoSchema>
