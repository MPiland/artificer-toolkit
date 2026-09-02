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
import { postgresUuidSchema } from '../shared/postgresUuid.js'
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

export const creatureEquipmentLoadoutEntryDtoSchema = z
  .strictObject({
    id: postgresUuidSchema,
    equipmentId: postgresUuidSchema,
    quantity: z.number().int().positive(),
    useState: z.enum(['CARRIED', 'HELD', 'WORN']),
    attuned: z.boolean(),
    actionFeatureIds: authoredReferenceCollectionSchema(postgresUuidSchema)
  })
  .superRefine((entry, context) => {
    if (entry.useState !== 'CARRIED' && entry.quantity !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: 'Held and worn equipment loadout entries must have quantity 1.'
      })
    }
  })

export type CreatureEquipmentLoadoutEntryDto = z.infer<
  typeof creatureEquipmentLoadoutEntryDtoSchema
>

export const creatureEquipmentLoadoutDtoSchema = authoredNestedCollectionSchema(
  creatureEquipmentLoadoutEntryDtoSchema
).superRefine((loadout, context) => {
  const occurrenceIds = new Set<string>()
  const actionFeatureIds = new Set<string>()

  for (const [entryIndex, entry] of loadout.entries()) {
    if (occurrenceIds.has(entry.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [entryIndex, 'id'],
        message: 'Creature equipment loadout entry IDs must be unique.'
      })
    }
    occurrenceIds.add(entry.id)

    for (const [featureIndex, featureId] of entry.actionFeatureIds.entries()) {
      if (actionFeatureIds.has(featureId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [entryIndex, 'actionFeatureIds', featureIndex],
          message: 'An action Feature can be bound to only one equipment loadout entry.'
        })
      }
      actionFeatureIds.add(featureId)
    }
  }
})

// Primitive-array group editors stage rows as `{ value }`. Normalize that
// authoring shape at the contract boundary so persisted and response DTOs stay
// the canonical `string[]` used by the compiler and repository.
const creatureLogisticsNoteDtoSchema = z
  .union([authoredPlainTextSchema, z.object({ value: authoredPlainTextSchema })])
  .transform((note) => (typeof note === 'string' ? note : note.value))

function validateCreatureEquipmentLoadout(
  creature: {
    equipmentLoadout?: CreatureEquipmentLoadoutEntryDto[]
    features?: z.infer<typeof featureDtoSchema>[]
  },
  context: z.RefinementCtx
) {
  if (!creature.equipmentLoadout) return

  const featuresById = new Map((creature.features ?? []).map((feature) => [feature.id, feature]))

  for (const [entryIndex, entry] of creature.equipmentLoadout.entries()) {
    for (const [featureIndex, featureId] of entry.actionFeatureIds.entries()) {
      const feature = featuresById.get(featureId)
      if (!feature) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['equipmentLoadout', entryIndex, 'actionFeatureIds', featureIndex],
          message:
            'Equipment action Feature bindings must reference a Feature on the same Creature.'
        })
        continue
      }

      const effects = [
        ...(feature.effects ?? []),
        ...(feature.options?.flatMap((option) => option.effects ?? []) ?? [])
      ]
      if (!effects.some((effect) => effect.invocation.kind !== 'PASSIVE')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['equipmentLoadout', entryIndex, 'actionFeatureIds', featureIndex],
          message:
            'Equipment action Feature bindings must reference a Feature with an ACTION invocation.'
        })
      }
    }
  }
}

const creatureAuthoredDtoObject = z.object({
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
  equipmentLoadout: creatureEquipmentLoadoutDtoSchema.optional(),
  logisticsNotes: authoredReferenceCollectionSchema(creatureLogisticsNoteDtoSchema).optional(),
  mountProfile: creatureMountProfileDtoSchema.optional(),
  companionProfile: creatureCompanionProfileDtoSchema.optional()
})

const creatureAuthoredDtoSchemaBase = creatureAuthoredDtoObject.superRefine(
  validateCreatureEquipmentLoadout
)

export type CreatureAuthoredDto = z.infer<typeof creatureAuthoredDtoSchemaBase>
export const creatureAuthoredDtoSchema = creatureAuthoredDtoSchemaBase

export const creatureAuthoringInputDtoSchema = creatureAuthoredDtoObject
  .extend({ userId: authoredIdentifierSchema.optional() })
  .superRefine(validateCreatureEquipmentLoadout)

export type CreatureAuthoringInputDto = z.infer<typeof creatureAuthoringInputDtoSchema>
