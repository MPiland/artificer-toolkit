import { z } from 'zod'
import { detailDtoSchema, speedDtoSchema } from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { proficiencyGrantDtoSchema } from '../grants/index.js'
import { costDtoSchema } from './shared.js'

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
  actionsCount: z.number().int().positive(),
  actions: z.array(creatureActionDtoSchema)
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

const creatureBaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  quote: z.string().optional(),
  description: z.string().optional(),
  details: z.array(detailDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional(),
  proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string(),
  category: z.enum(['NPC', 'MONSTER', 'BEAST', 'COMPANION', 'SUMMON']),
  creatureTypeId: z.string().optional(),
  size: z.string().optional(),
  alignmentId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  speeds: z.array(speedDtoSchema),
  mountProfile: creatureMountProfileDtoSchema.optional(),
  companionProfile: creatureCompanionProfileDtoSchema.optional()
})

const statBlockCreatureSchema = creatureBaseSchema.extend({
  recordKind: z.literal('STAT_BLOCK'),
  creatureTypeId: z.string(),
  size: z.string(),
  abilityScores: z.record(z.string(), z.number()),
  armorClass: z.number().int().nonnegative(),
  armorClassNote: z.string().optional(),
  hitPoints: z.number().int().nonnegative(),
  hitDice: z.string().optional(),
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
  npcProfile: creatureNpcProfileDtoSchema.optional()
})

const logisticsCreatureSchema = creatureBaseSchema.extend({
  recordKind: z.literal('LOGISTICS'),
  cost: costDtoSchema.optional(),
  carryingCapacity: z.object({
    amount: z.number(),
    unit: z.string()
  }).optional(),
  logisticsNotes: z.array(z.string()).optional()
})

const creatureAuthoredDtoSchemaRaw: z.ZodTypeAny = z.discriminatedUnion('recordKind', [
  statBlockCreatureSchema,
  logisticsCreatureSchema
])

export type CreatureAuthoredDto = z.infer<typeof statBlockCreatureSchema> | z.infer<typeof logisticsCreatureSchema>
const creatureAuthoredDtoSchemaBase: z.ZodTypeAny = creatureAuthoredDtoSchemaRaw
export const creatureAuthoredDtoSchema = creatureAuthoredDtoSchemaBase
