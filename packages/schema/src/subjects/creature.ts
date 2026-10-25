import { z, lazySchema } from '../zod.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredPlainTextSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { detailDtoSchema } from '../shared/detail.js'
import {
  EQUIPMENT_SLOT_CODES,
  HAND_CONFLICT_MESSAGE,
  resolveHandOccupancy
} from '@artificer-toolkit/shared/core'
import { diceExpressionDtoSchema } from '../shared/dice.js'
import { speedDtoSchema } from '../shared/speed.js'
import { ATTACK_TRIGGER_CODES } from '../effects/effect.js'
import { featureDtoSchema } from '../features/feature.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { senseRangeDtoSchema } from '../grants/sense.js'
import { costDtoSchema } from './shared.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  authoredRecordStatusSchema,
  creatureCategoryCodeSchema,
  damageDefenseBypassCodeSchema,
  measurementUnitCodeSchema,
  sizeCodeSchema
} from '../shared/enums.js'

/**
 * A Sense a Creature has: a System sense definition and how far it reaches. This is the shape a
 * Character sense grant resolves to; `qualifier` is the printed note after the range ("(blind
 * beyond this radius)") and never changes what the Creature perceives.
 */
export const creatureSenseDtoSchema = lazySchema(() =>
  z.strictObject({
    senseDefinitionId: authoredIdentifierSchema,
    range: senseRangeDtoSchema,
    qualifier: z.optional(authoredShortTextSchema)
  })
)

export type CreatureSenseDto = z.infer<typeof creatureSenseDtoSchema>

// The room pins a Creature's senses by definition, so a repeated one cannot be admitted.
const creatureSensesSchema = lazySchema(() =>
  authoredNestedCollectionSchema(creatureSenseDtoSchema).check(
    z.superRefine((senses, context) => {
      const seen = new Set<string>()
      for (const [index, { senseDefinitionId }] of senses.entries()) {
        if (seen.has(senseDefinitionId))
          context.addIssue({
            code: 'custom',
            path: [index, 'senseDefinitionId'],
            message: 'A Creature can have each sense only once.'
          })
        seen.add(senseDefinitionId)
      }
    })
  )
)

export const creatureQualifiedDamageDefenseDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum(['RESISTANCE', 'IMMUNITY']),
    damageTypeIds: authoredReferenceCollectionSchema(postgresUuidSchema).check(z.minLength(1)),
    bypassedBy: authoredReferenceCollectionSchema(damageDefenseBypassCodeSchema).check(
      z.minLength(1)
    )
  })
)

export type CreatureQualifiedDamageDefenseDto = z.infer<
  typeof creatureQualifiedDamageDefenseDtoSchema
>

export const creatureMountProfileDtoSchema = lazySchema(() =>
  z.object({
    mountType: z.enum(['CONTROLLED', 'INDEPENDENT']),
    capacity: z.optional(z.number()),
    riderCount: z.optional(z.number()),
    notes: z.optional(authoredPlainTextSchema)
  })
)

export type CreatureMountProfileDto = z.infer<typeof creatureMountProfileDtoSchema>

export const creatureCompanionProfileDtoSchema = lazySchema(() =>
  z.object({
    bondType: z.enum(['FAMILIAR', 'ANIMAL_COMPANION', 'SUMMON']),
    initiativeMode: z.enum(['USES_PC_INITIATIVE', 'OWN_INITIATIVE']),
    notes: z.optional(authoredPlainTextSchema)
  })
)

export type CreatureCompanionProfileDto = z.infer<typeof creatureCompanionProfileDtoSchema>

export const creatureNpcProfileDtoSchema = lazySchema(() =>
  z.object({
    bonds: z.optional(authoredReferenceCollectionSchema(authoredPlainTextSchema)),
    flaws: z.optional(authoredReferenceCollectionSchema(authoredPlainTextSchema)),
    ideals: z.optional(authoredReferenceCollectionSchema(authoredPlainTextSchema)),
    personalityTraits: z.optional(authoredReferenceCollectionSchema(authoredPlainTextSchema))
  })
)

export type CreatureNpcProfileDto = z.infer<typeof creatureNpcProfileDtoSchema>

export const creatureAbilityScoresDtoSchema = lazySchema(() =>
  z.object({
    STRENGTH: z.number(),
    DEXTERITY: z.number(),
    CONSTITUTION: z.number(),
    INTELLIGENCE: z.number(),
    WISDOM: z.number(),
    CHARISMA: z.number()
  })
)

export const creatureEquipmentLoadoutEntryDtoSchema = lazySchema(() =>
  z
    .strictObject({
      id: postgresUuidSchema,
      equipmentId: postgresUuidSchema,
      quantity: z.number().check(z.int()).check(z.positive()),
      useState: z.enum(EQUIPMENT_SLOT_CODES),
      attuned: z.boolean(),
      actionFeatureIds: authoredReferenceCollectionSchema(postgresUuidSchema)
    })
    .check(
      z.superRefine((entry, context) => {
        if (entry.useState !== 'CARRIED' && entry.quantity !== 1) {
          context.addIssue({
            code: 'custom',
            path: ['quantity'],
            message: 'Hand and worn equipment loadout entries must have quantity 1.'
          })
        }
      })
    )
)

export type CreatureEquipmentLoadoutEntryDto = z.infer<
  typeof creatureEquipmentLoadoutEntryDtoSchema
>

export const creatureEquipmentLoadoutDtoSchema = lazySchema(() =>
  authoredNestedCollectionSchema(creatureEquipmentLoadoutEntryDtoSchema).check(
    z.superRefine((loadout, context) => {
      const occurrenceIds = new Set<string>()
      const actionFeatureIds = new Set<string>()

      // Equipment is not resolved here, so two-handed blocking is enforced where it is.
      for (const conflict of resolveHandOccupancy(
        loadout.map((entry) => ({ id: entry.id, slot: entry.useState, twoHanded: false }))
      ).conflicts) {
        context.addIssue({
          code: 'custom',
          path: [loadout.findIndex((entry) => entry.id === conflict.itemId), 'useState'],
          message: HAND_CONFLICT_MESSAGE[conflict.code]
        })
      }

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
)

// Primitive-array group editors stage rows as `{ value }`. Normalize that
// authoring shape at the contract boundary so persisted and response DTOs stay
// the canonical `string[]` used by the compiler and repository.
const creatureLogisticsNoteDtoSchema = lazySchema(() =>
  z.pipe(
    z.union([authoredPlainTextSchema, z.object({ value: authoredPlainTextSchema })]),
    z.transform((note) => (typeof note === 'string' ? note : note.value))
  )
)

function validateCreatureEquipmentLoadout(
  creature: {
    equipmentLoadout?: CreatureEquipmentLoadoutEntryDto[]
    features: z.infer<typeof featureDtoSchema>[]
  },
  context: z.core.$RefinementCtx
) {
  if (!creature.equipmentLoadout) return

  const featuresById = new Map(creature.features.map((feature) => [feature.id, feature]))

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

/**
 * Publication rule: a Creature Feature or option whose action makes an attack roll defines exactly
 * one ATTACK roll, which carries its attack bonus. Drafts may be saved without it, and reads of
 * already published Creatures do not re-apply it; discovery isolates such an action instead.
 */
function validateCreatureAttackRolls(
  creature: { features: z.infer<typeof featureDtoSchema>[] },
  context: z.core.$RefinementCtx
) {
  for (const [featureIndex, feature] of creature.features.entries()) {
    const sources = [
      { source: feature, path: ['features', featureIndex] },
      ...(feature.options ?? []).map((option, optionIndex) => ({
        source: option,
        path: ['features', featureIndex, 'options', optionIndex]
      }))
    ]
    for (const { source, path } of sources) {
      const attacks = (source.effects ?? []).some(
        (effect) =>
          effect.invocation.kind !== 'PASSIVE' &&
          ATTACK_TRIGGER_CODES.has(effect.invocation.triggerCode)
      )
      if (!attacks) continue
      const attackRolls = (source.rollDefinitions ?? []).filter(
        (definition) => definition.kind === 'ATTACK'
      ).length
      if (attackRolls !== 1) {
        context.addIssue({
          code: 'custom',
          path: [...path, 'rollDefinitions'],
          message: `"${source.label}" makes an attack, so it must define exactly one ATTACK roll with its attack bonus (it defines ${attackRolls}).`
        })
      }
    }
  }
}

/**
 * A versatile weapon attack authors one effect per grip, each its own action (D57 ruling 1): a
 * Feature or option whose effects name a grip for a trigger authors exactly one one-handed and one
 * two-handed effect of that trigger, and no gripless one. A Creature carries no items, so none of
 * its attacks is made with the weapons it wields (D156).
 */
function validateCreatureWeaponAttacks(
  creature: { features: z.infer<typeof featureDtoSchema>[] },
  context: z.core.$RefinementCtx
) {
  for (const [featureIndex, feature] of creature.features.entries()) {
    const sources = [
      { source: feature, path: ['features', featureIndex] },
      ...(feature.options ?? []).map((option, optionIndex) => ({
        source: option,
        path: ['features', featureIndex, 'options', optionIndex]
      }))
    ]
    for (const { source, path } of sources) {
      const effects = source.effects ?? []
      for (const [effectIndex, effect] of effects.entries())
        if (effect.weaponAttack !== undefined)
          context.addIssue({
            code: 'custom',
            path: [...path, 'effects', effectIndex, 'weaponAttack'],
            message: `"${source.label}" belongs to a Creature, which wields no items to attack with.`
          })
      const gripped = new Set(
        effects.flatMap((effect) =>
          effect.grip === undefined ? [] : [effect.invocation.triggerCode]
        )
      )
      for (const triggerCode of gripped) {
        const grips = effects
          .filter((effect) => effect.invocation.triggerCode === triggerCode)
          .map((effect) => effect.grip)
          .sort()
        if (grips.join() !== 'ONE_HANDED,TWO_HANDED')
          context.addIssue({
            code: 'custom',
            path: [...path, 'effects'],
            message: `"${source.label}" names grips, so it must author exactly one one-handed and one two-handed effect of that attack.`
          })
      }
    }
  }
}

/**
 * An option that runs another action (D51 option B) names another action Feature of the same
 * Creature and spends its own Feature's fixed charges.
 */
function validateCreatureActionReferences(
  creature: { features: z.infer<typeof featureDtoSchema>[] },
  context: z.core.$RefinementCtx
) {
  const { features } = creature
  for (const [featureIndex, feature] of features.entries()) {
    for (const [alternativeIndex, alternative] of (
      feature.attackSlots?.alternatives ?? []
    ).entries())
      for (const [slotIndex, slot] of alternative.slots.entries())
        for (const [fillerIndex, filler] of slot.fillers.entries()) {
          if (filler.kind !== 'FEATURE') continue
          const referenced = features.find((candidate) => candidate.id === filler.featureId)
          if (
            !referenced ||
            referenced.id === feature.id ||
            !(referenced.effects ?? []).some((effect) => effect.invocation.kind !== 'PASSIVE')
          )
            context.addIssue({
              code: 'custom',
              path: [
                'features',
                featureIndex,
                'attackSlots',
                'alternatives',
                alternativeIndex,
                'slots',
                slotIndex,
                'fillers',
                fillerIndex,
                'featureId'
              ],
              message: `"${feature.label}" must fill a slot with another action Feature of this Creature.`
            })
        }
    for (const [optionIndex, option] of (feature.options ?? []).entries()) {
      const reference = option.actionReference
      if (!reference) continue
      const path = ['features', featureIndex, 'options', optionIndex, 'actionReference']
      const referenced = features.find((candidate) => candidate.id === reference.featureId)
      if (
        !referenced ||
        referenced.id === feature.id ||
        !(referenced.effects ?? []).some((effect) => effect.invocation.kind !== 'PASSIVE')
      )
        context.addIssue({
          code: 'custom',
          path: [...path, 'featureId'],
          message: `"${option.label}" must name another action Feature of this Creature.`
        })
      const charges = feature.charges
      if (
        charges?.limitKind !== 'FIXED_AMOUNT' ||
        charges.scalingKind !== 'NONE' ||
        reference.chargeCost > charges.amount
      )
        context.addIssue({
          code: 'custom',
          path: [...path, 'chargeCost'],
          message: `"${option.label}" must cost at most the fixed charges of "${feature.label}".`
        })
    }
  }
}

const creatureAuthoredDtoObject = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    quote: z.optional(authoredRichTextSchema),
    description: z.optional(authoredRichTextSchema),
    status: z.optional(authoredRecordStatusSchema),
    details: authoredNestedCollectionSchema(detailDtoSchema),
    features: authoredNestedCollectionSchema(featureDtoSchema),
    proficiencies: authoredNestedCollectionSchema(proficiencyGrantDtoSchema),
    userId: authoredIdentifierSchema,
    systemId: authoredIdentifierSchema,
    category: creatureCategoryCodeSchema,
    creatureTypeId: authoredIdentifierSchema,
    size: sizeCodeSchema,
    alignmentId: z.optional(authoredIdentifierSchema),
    tags: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
    abilityScores: creatureAbilityScoresDtoSchema,
    naturalArmorBonus: z.number().check(z.int()).check(z.nonnegative()),
    hitPoints: z.number().check(z.int()).check(z.nonnegative()),
    hitDice: z.optional(diceExpressionDtoSchema),
    speeds: authoredNestedCollectionSchema(speedDtoSchema),
    senses: creatureSensesSchema,
    passivePerception: z.optional(z.number()),
    damageVulnerabilities: authoredReferenceCollectionSchema(authoredShortTextSchema),
    damageResistances: authoredReferenceCollectionSchema(authoredShortTextSchema),
    damageImmunities: authoredReferenceCollectionSchema(authoredShortTextSchema),
    qualifiedDamageDefenses: authoredNestedCollectionSchema(
      creatureQualifiedDamageDefenseDtoSchema
    ),
    conditionImmunities: authoredReferenceCollectionSchema(authoredShortTextSchema),
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
)

const creatureAuthoredDtoSchemaBase = lazySchema(() =>
  creatureAuthoredDtoObject.check(
    z.superRefine(validateCreatureEquipmentLoadout),
    z.superRefine(validateCreatureWeaponAttacks),
    z.superRefine(validateCreatureActionReferences)
  )
)

export type CreatureAuthoredDto = z.infer<typeof creatureAuthoredDtoSchemaBase>
export const creatureAuthoredDtoSchema = creatureAuthoredDtoSchemaBase

/** The Creature a publication (platform seed or owner publish) may commit. */
export const creaturePublicationDtoSchema = lazySchema(() =>
  creatureAuthoredDtoSchemaBase.check(z.superRefine(validateCreatureAttackRolls))
)

export const creatureAuthoringInputDtoSchema = lazySchema(() =>
  z
    .extend(creatureAuthoredDtoObject, { userId: z.optional(authoredIdentifierSchema) })
    .check(
      z.superRefine(validateCreatureEquipmentLoadout),
      z.superRefine(validateCreatureWeaponAttacks),
      z.superRefine(validateCreatureActionReferences)
    )
)

export type CreatureAuthoringInputDto = z.infer<typeof creatureAuthoringInputDtoSchema>
