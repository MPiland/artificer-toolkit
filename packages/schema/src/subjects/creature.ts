import { z } from '../zod.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredPlainTextSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { detailDtoSchema } from '../shared/detail.js'
import { diceExpressionDtoSchema } from '../shared/dice.js'
import { speedDtoSchema } from '../shared/speed.js'
import { featureDtoSchema } from '../features/feature.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
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
  capacity: z.optional(z.number()),
  riderCount: z.optional(z.number()),
  notes: z.optional(authoredPlainTextSchema)
})

export const creatureCompanionProfileDtoSchema = z.object({
  bondType: z.enum(['FAMILIAR', 'ANIMAL_COMPANION', 'SUMMON']),
  initiativeMode: z.enum(['USES_PC_INITIATIVE', 'OWN_INITIATIVE']),
  notes: z.optional(authoredPlainTextSchema)
})

export const creatureNpcProfileDtoSchema = z.object({
  bonds: z.optional(authoredReferenceCollectionSchema(authoredPlainTextSchema)),
  flaws: z.optional(authoredReferenceCollectionSchema(authoredPlainTextSchema)),
  ideals: z.optional(authoredReferenceCollectionSchema(authoredPlainTextSchema)),
  personalityTraits: z.optional(authoredReferenceCollectionSchema(authoredPlainTextSchema))
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
    quantity: z.number().check(z.int()).check(z.positive()),
    useState: z.enum(['CARRIED', 'HELD', 'WORN']),
    attuned: z.boolean(),
    actionFeatureIds: authoredReferenceCollectionSchema(postgresUuidSchema)
  })
  .check(
    z.superRefine((entry, context) => {
      if (entry.useState !== 'CARRIED' && entry.quantity !== 1) {
        context.addIssue({
          code: 'custom',
          path: ['quantity'],
          message: 'Held and worn equipment loadout entries must have quantity 1.'
        })
      }
    })
  )

export type CreatureEquipmentLoadoutEntryDto = z.infer<
  typeof creatureEquipmentLoadoutEntryDtoSchema
>

export const creatureEquipmentLoadoutDtoSchema = authoredNestedCollectionSchema(
  creatureEquipmentLoadoutEntryDtoSchema
).check(
  z.superRefine((loadout, context) => {
    const occurrenceIds = new Set<string>()
    const actionFeatureIds = new Set<string>()

    for (const [entryIndex, entry] of loadout.entries()) {
      if (occurrenceIds.has(entry.id)) {
        context.addIssue({
          code: 'custom',
          path: [entryIndex, 'id'],
          message: 'Creature equipment loadout entry IDs must be unique.'
        })
      }
      occurrenceIds.add(entry.id)

      for (const [featureIndex, featureId] of entry.actionFeatureIds.entries()) {
        if (actionFeatureIds.has(featureId)) {
          context.addIssue({
            code: 'custom',
            path: [entryIndex, 'actionFeatureIds', featureIndex],
            message: 'An action Feature can be bound to only one equipment loadout entry.'
          })
        }
        actionFeatureIds.add(featureId)
      }
    }
  })
)

// Primitive-array group editors stage rows as `{ value }`. Normalize that
// authoring shape at the contract boundary so persisted and response DTOs stay
// the canonical `string[]` used by the compiler and repository.
const creatureLogisticsNoteDtoSchema = z.pipe(
  z.union([authoredPlainTextSchema, z.object({ value: authoredPlainTextSchema })]),
  z.transform((note) => (typeof note === 'string' ? note : note.value))
)

function validateCreatureEquipmentLoadout(
  creature: {
    equipmentLoadout?: CreatureEquipmentLoadoutEntryDto[]
    features?: z.infer<typeof featureDtoSchema>[]
  },
  context: z.core.$RefinementCtx
) {
  if (!creature.equipmentLoadout) return

  const featuresById = new Map((creature.features ?? []).map((feature) => [feature.id, feature]))

  for (const [entryIndex, entry] of creature.equipmentLoadout.entries()) {
    for (const [featureIndex, featureId] of entry.actionFeatureIds.entries()) {
      const feature = featuresById.get(featureId)
      if (!feature) {
        context.addIssue({
          code: 'custom',
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
          code: 'custom',
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
  quote: z.optional(authoredRichTextSchema),
  description: z.optional(authoredRichTextSchema),
  status: z.optional(authoredRecordStatusSchema),
  details: z.optional(authoredNestedCollectionSchema(detailDtoSchema)),
  features: z.optional(authoredNestedCollectionSchema(featureDtoSchema)),
  proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema)),
  userId: authoredIdentifierSchema,
  systemId: authoredIdentifierSchema,
  category: creatureCategoryCodeSchema,
  creatureTypeId: authoredIdentifierSchema,
  size: sizeCodeSchema,
  alignmentId: z.optional(authoredIdentifierSchema),
  tags: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  abilityScores: creatureAbilityScoresDtoSchema,
  armorClass: z.number().check(z.int()).check(z.nonnegative()),
  armorClassNote: z.optional(authoredPlainTextSchema),
  hitPoints: z.number().check(z.int()).check(z.nonnegative()),
  hitDice: z.optional(diceExpressionDtoSchema),
  speeds: authoredNestedCollectionSchema(speedDtoSchema),
  senses: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  passivePerception: z.optional(z.number()),
  damageVulnerabilities: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  damageResistances: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  damageImmunities: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  conditionImmunities: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  challengeRatingId: z.optional(authoredIdentifierSchema),
  xp: z.optional(z.number()),
  npcProfile: z.optional(creatureNpcProfileDtoSchema),
  cost: z.optional(costDtoSchema),
  carryingCapacity: z.optional(
    z.object({
      amount: z.number(),
      unit: measurementUnitCodeSchema
    })
  ),
  equipmentLoadout: z.optional(creatureEquipmentLoadoutDtoSchema),
  logisticsNotes: z.optional(authoredReferenceCollectionSchema(creatureLogisticsNoteDtoSchema)),
  mountProfile: z.optional(creatureMountProfileDtoSchema),
  companionProfile: z.optional(creatureCompanionProfileDtoSchema)
})

const creatureAuthoredDtoSchemaBase = creatureAuthoredDtoObject.check(
  z.superRefine(validateCreatureEquipmentLoadout)
)

export type CreatureAuthoredDto = z.infer<typeof creatureAuthoredDtoSchemaBase>
export const creatureAuthoredDtoSchema = creatureAuthoredDtoSchemaBase

export const creatureAuthoringInputDtoSchema = z
  .extend(creatureAuthoredDtoObject, { userId: z.optional(authoredIdentifierSchema) })
  .check(z.superRefine(validateCreatureEquipmentLoadout))

export type CreatureAuthoringInputDto = z.infer<typeof creatureAuthoringInputDtoSchema>
