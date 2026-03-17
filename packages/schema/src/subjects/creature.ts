import { z } from 'zod'
import { detailDtoSchema, speedDtoSchema } from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'

const creatureActionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  attackBonus: z.number().optional(),
  damage: z.string().optional(),
  recharge: z.string().optional()
})

const creatureLegendaryProfileDtoSchema = z.object({
  legendaryResistanceCount: z.number().int()
    .nonnegative()
    .optional(),
  actionsCount: z.number().int()
    .positive(),
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

export const creatureAuthoredDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  quote: z.string().optional(),
  description: z.string().optional(),
  details: z.array(detailDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string(),

  // Identity
  category: z.enum([
    'NPC', 'MONSTER', 'BEAST', 'COMPANION', 'SUMMON'
  ]),
  creatureTypeId: z.string(),
  size: z.string(),
  alignmentId: z.string().optional(),
  tags: z.array(z.string()).optional(),

  // Core stats
  abilityScores: z.record(z.string(), z.number()),
  armorClass: z.number().int()
    .nonnegative(),
  armorClassNote: z.string().optional(),
  hitPoints: z.number().int()
    .nonnegative(),
  hitDice: z.string().optional(),

  // Movement
  speeds: z.array(speedDtoSchema),
  senses: z.array(z.string()).optional(),
  passivePerception: z.number().optional(),

  // Defenses
  savingThrowProficiencies: z.array(z.string()).optional(),
  skillProficiencies: z.array(z.string()).optional(),
  damageVulnerabilities: z.array(z.string()).optional(),
  damageResistances: z.array(z.string()).optional(),
  damageImmunities: z.array(z.string()).optional(),
  conditionImmunities: z.array(z.string()).optional(),

  // Social/rules
  languages: z.array(z.string()).optional(),
  challengeRatingId: z.string().optional(),
  xp: z.number().optional(),

  // Standard actions
  actions: z.array(creatureActionDtoSchema).optional(),
  bonusActions: z.array(creatureActionDtoSchema).optional(),
  reactions: z.array(creatureActionDtoSchema).optional(),

  // Optional profiles
  legendaryProfile: creatureLegendaryProfileDtoSchema.optional(),
  lairProfile: creatureLairProfileDtoSchema.optional(),
  mountProfile: creatureMountProfileDtoSchema.optional(),
  companionProfile: creatureCompanionProfileDtoSchema.optional(),
  npcProfile: creatureNpcProfileDtoSchema.optional()
})

export type CreatureAuthoredDto = z.infer<typeof creatureAuthoredDtoSchema>
