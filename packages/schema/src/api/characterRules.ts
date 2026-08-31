import { z } from 'zod'

import {
  characterGrantFoldInputSchema,
  characterGrantFoldOutputSchema,
  characterMechanicSourceSchema
} from './characterGrantFoldRules.js'
import {
  characterChargeSourceLevelSchema,
  characterResourcePoolCandidatesSchema,
  characterResourceUsageFactsSchema,
  characterResourcesSchema
} from './characterResourceRules.js'
import {
  characterActionCandidatesSchema,
  characterActionDecisionsSchema,
  characterActionSpellSourceSchema,
  characterSpellActionFactsSchema,
  characterSpellCastCandidatesSchema,
  characterSpellCastDecisionsSchema,
  characterSpellCastMechanicsSchema,
  characterSpellCastSlotsSchema,
  characterSpellReferenceMechanicsSchema
} from './characterActionRules.js'
import {
  abilityCodeSchema,
  equipmentCategoryCodeSchema,
  measurementUnitCodeSchema,
  sizeCodeSchema
} from '../shared/enums.js'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'
import { serverUuidIdentityDtoSchema } from '../shared/rulesExecution.js'

const boundedIdentitySchema = z.string().trim().min(1).max(240)

const characterAbilityDefinitionFactSchema = z.strictObject({
  id: serverUuidIdentityDtoSchema,
  code: boundedIdentitySchema
})

const characterAbilityDefinitionsSchema = z
  .array(characterAbilityDefinitionFactSchema)
  .max(32)
  .superRefine((definitions, context) => {
    const ids = new Set<string>()
    const codes = new Set<string>()
    for (const [index, definition] of definitions.entries()) {
      if (ids.has(definition.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: 'Character ability definition IDs must be unique.'
        })
      }
      if (codes.has(definition.code)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'code'],
          message: 'Character ability definition codes must be unique.'
        })
      }
      ids.add(definition.id)
      codes.add(definition.code)
    }
  })
  .transform((definitions) =>
    [...definitions].sort((left, right) => left.id.localeCompare(right.id))
  )

const characterTargetDefenseSchema = z.strictObject({
  kind: z.enum(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY']),
  damageTypeId: serverUuidIdentityDtoSchema,
  source: characterMechanicSourceSchema
})

const canonicalCharacterTargetDefensesSchema = z
  .array(characterTargetDefenseSchema)
  .max(100)
  .superRefine((defenses, ctx) => {
    const keys = new Set<string>()
    defenses.forEach((defense, index) => {
      const key = `${defense.kind}:${defense.damageTypeId}`
      if (keys.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Character target defenses must be unique.',
          path: [index]
        })
      }
      keys.add(key)
    })
  })
  .transform((defenses) =>
    [...defenses].sort((left, right) =>
      left.damageTypeId === right.damageTypeId
        ? left.kind.localeCompare(right.kind)
        : left.damageTypeId.localeCompare(right.damageTypeId)
    )
  )

const canonicalConditionImmunityIdsSchema = z
  .array(serverUuidIdentityDtoSchema)
  .max(100)
  .superRefine((conditionIds, ctx) => {
    const seen = new Set<string>()
    conditionIds.forEach((conditionId, index) => {
      if (seen.has(conditionId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Character condition immunities must be unique.',
          path: [index]
        })
      }
      seen.add(conditionId)
    })
  })
  .transform((conditionIds) => [...conditionIds].sort())

const characterRuleContributionInputSchema = z.strictObject({
  sourceId: boundedIdentitySchema,
  value: z.number().finite()
})

const characterMovementFactsSchema = z.strictObject({
  speeds: z
    .array(
      z.strictObject({
        speedId: boundedIdentitySchema,
        code: boundedIdentitySchema.nullable(),
        baseAmount: z.number().finite(),
        unit: measurementUnitCodeSchema,
        override: z
          .strictObject({ sourceId: boundedIdentitySchema, value: z.number().finite() })
          .nullable()
      })
    )
    .max(100),
  preference: z.strictObject({
    mode: z.enum(['AUTO', 'EXPLICIT']),
    speedId: boundedIdentitySchema.nullable()
  })
})

const characterSenseFactsSchema = z.strictObject({
  overrides: z
    .array(
      z.strictObject({
        senseDefinitionId: serverUuidIdentityDtoSchema,
        sourceId: boundedIdentitySchema,
        value: z.number().finite()
      })
    )
    .max(100)
})

const characterArmorClassFactsSchema = z.strictObject({
  dexterityAbilityId: boundedIdentitySchema,
  dexterityAbilityIndex: z.number().int().min(0).max(31).nullable(),
  equipment: z
    .array(
      z.strictObject({
        itemInstanceId: boundedIdentitySchema,
        source: characterMechanicSourceSchema,
        category: z.enum(['ARMOR', 'SHIELD']),
        equippedSlot: boundedIdentitySchema,
        armorClass: z.number().finite().nullable()
      })
    )
    .max(500)
})

const characterHitPointFactsSchema = z.strictObject({
  rows: z
    .array(
      z.strictObject({
        classId: boundedIdentitySchema,
        classLevel: z.number().int().min(0).max(20),
        value: z.number().finite()
      })
    )
    .max(400),
  constitutionAbilityId: boundedIdentitySchema,
  constitutionAbilityIndex: z.number().int().min(0).max(31).nullable(),
  progression: z
    .strictObject({
      method: z.enum(['FIXED', 'MANUAL']),
      rows: z
        .array(
          z.strictObject({
            sequence: z.number().int().min(0).max(399),
            level: z.number().int().min(1).max(400),
            classId: boundedIdentitySchema,
            classLevel: z.number().int().min(1).max(20),
            die: z.number().int().positive().nullable(),
            abilityIndex: z.number().int().min(0).max(31).nullable(),
            fallbackValue: z.number().int(),
            rollValue: z.number().int().nullable(),
            legacyOverrideValue: z.number().int().nullable()
          })
        )
        .max(400)
        .superRefine((rows, context) => {
          for (const [index, row] of rows.entries()) {
            if (row.sequence !== index) {
              context.addIssue({
                code: 'custom',
                message: 'Hit point progression rows must use contiguous sequence values',
                path: [index, 'sequence']
              })
            }
          }
        })
    })
    .nullable()
    .default(null),
  manualMaximumModifier: z
    .strictObject({
      sourceId: boundedIdentitySchema,
      source: characterMechanicSourceSchema,
      value: z.number().finite()
    })
    .nullable(),
  manualMaximumOverride: z
    .strictObject({
      sourceId: boundedIdentitySchema,
      source: characterMechanicSourceSchema,
      value: z.number().finite()
    })
    .nullable()
})

const characterDerivedNumericBonusSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('FIXED'),
    sourceId: boundedIdentitySchema,
    source: characterMechanicSourceSchema,
    value: z.number().finite(),
    operation: z.enum(['ADD', 'SET'])
  }),
  z.strictObject({
    kind: z.literal('MODIFIER_GROUP'),
    sourceId: boundedIdentitySchema,
    domainKey: boundedIdentitySchema,
    operation: z.enum(['ADD', 'SET'])
  }),
  z.strictObject({
    kind: z.literal('PROFICIENCY'),
    sourceId: boundedIdentitySchema,
    operation: z.literal('ADD')
  })
])

const characterDerivedNumericOverrideSchema = z
  .strictObject({
    sourceId: boundedIdentitySchema,
    source: characterMechanicSourceSchema,
    value: z.number().finite()
  })
  .nullable()

const characterDerivedProficiencyOverrideSchema = z
  .strictObject({
    sourceId: boundedIdentitySchema,
    source: characterMechanicSourceSchema,
    value: z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE'])
  })
  .nullable()

export const characterDerivedBaseFactsSchema = z.strictObject({
  abilities: z
    .array(
      z.strictObject({
        abilityId: boundedIdentitySchema,
        baseScore: z.number().int().min(0).max(30),
        bonuses: z.array(characterDerivedNumericBonusSchema).max(200),
        scoreOverride: characterDerivedNumericOverrideSchema
      })
    )
    .max(32),
  savingThrows: z
    .array(
      z.strictObject({
        abilityId: boundedIdentitySchema,
        abilityIndex: z.number().int().min(0).max(31).nullable(),
        proficiencySubjectId: boundedIdentitySchema,
        proficiencyOverride: characterDerivedProficiencyOverrideSchema,
        bonuses: z.array(characterDerivedNumericBonusSchema).max(200),
        totalOverride: characterDerivedNumericOverrideSchema
      })
    )
    .max(32),
  skills: z
    .array(
      z.strictObject({
        skillId: boundedIdentitySchema,
        governingAbilityId: boundedIdentitySchema,
        governingAbilityIndex: z.number().int().min(0).max(31).nullable(),
        governingAbilityOverride: z
          .strictObject({
            sourceId: boundedIdentitySchema,
            value: boundedIdentitySchema,
            abilityIndex: z.number().int().min(0).max(31).nullable()
          })
          .nullable(),
        proficiencySubjectIds: z.array(boundedIdentitySchema).min(1).max(100),
        proficiencyOverride: characterDerivedProficiencyOverrideSchema,
        bonuses: z.array(characterDerivedNumericBonusSchema).max(200),
        totalOverride: characterDerivedNumericOverrideSchema,
        passiveOverride: characterDerivedNumericOverrideSchema
      })
    )
    .max(100),
  initiative: z.strictObject({
    abilityId: boundedIdentitySchema,
    abilityIndex: z.number().int().min(0).max(31).nullable(),
    bonuses: z.array(characterDerivedNumericBonusSchema).max(200)
  }),
  spellcasting: z
    .strictObject({
      abilityId: boundedIdentitySchema,
      abilityIndex: z.number().int().min(0).max(31).nullable(),
      saveDcBonuses: z.array(characterDerivedNumericBonusSchema).max(200),
      attackBonuses: z.array(characterDerivedNumericBonusSchema).max(200)
    })
    .nullable()
})

const spellSlotEntrySchema = z.strictObject({
  spellLevel: z.number().int().min(1).max(9),
  slotCount: z.number().int().min(0).max(99)
})

const characterSpellcastingClassSchema = z.strictObject({
  classId: boundedIdentitySchema,
  classLevel: z.number().int().min(1).max(20),
  resetKind: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
  spellLimits: z
    .array(
      z.strictObject({
        classLevel: z.number().int().min(1).max(20),
        slots: z.array(spellSlotEntrySchema).max(9)
      })
    )
    .min(1)
    .max(20)
})

const characterSpellSlotUsageFactsSchema = z
  .array(
    z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('STANDARD'),
        spellLevel: z.number().int().min(1).max(9),
        rawUsed: z.number().int().min(0).max(2_147_483_647)
      }),
      z.strictObject({
        kind: z.literal('PACT'),
        rawUsed: z.number().int().min(0).max(2_147_483_647)
      })
    ])
  )
  .max(10)
  .superRefine((usage, context) => {
    const keys = new Set<string>()
    for (const [index, entry] of usage.entries()) {
      const key = entry.kind === 'STANDARD' ? `STANDARD:${entry.spellLevel}` : entry.kind
      if (keys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'Spell slot usage facts must be unique by slot kind',
          path: [index]
        })
      }
      keys.add(key)
    }
  })

const characterChargeLevelsSchema = z
  .array(
    z.strictObject({
      sourceId: boundedIdentitySchema,
      level: z.number().int().min(1).max(20),
      amount: z.number().finite()
    })
  )
  .max(20)

const characterChargeScaledBaseSchema = z.strictObject({
  multiplier: z.number().finite().nullable(),
  minimum: z.number().finite().nullable(),
  maximum: z.number().finite().nullable()
})

const characterChargeBaseSchema = z.discriminatedUnion('kind', [
  characterChargeScaledBaseSchema.extend({
    kind: z.literal('ABILITY_MODIFIER'),
    abilityId: boundedIdentitySchema
  }),
  characterChargeScaledBaseSchema.extend({ kind: z.literal('CHARACTER_LEVEL') }),
  characterChargeScaledBaseSchema.extend({
    kind: z.literal('CLASS_LEVEL'),
    classId: boundedIdentitySchema
  }),
  characterChargeScaledBaseSchema.extend({
    kind: z.literal('PARENT_CLASS_LEVEL'),
    sourceLevel: characterChargeSourceLevelSchema
  }),
  characterChargeScaledBaseSchema.extend({
    kind: z.literal('SPELL_CAST_LEVEL'),
    spellCastLevel: z.number().int().min(1).max(9).nullable()
  }),
  z.strictObject({ kind: z.literal('FIXED_AMOUNT'), amount: z.number().finite() }),
  z.strictObject({
    kind: z.literal('PER_LEVEL'),
    sourceLevel: characterChargeSourceLevelSchema,
    levels: characterChargeLevelsSchema
  })
])

const characterChargeBonusSchema = z.discriminatedUnion('kind', [
  characterChargeScaledBaseSchema.extend({
    kind: z.literal('ABILITY_MODIFIER'),
    sourceId: boundedIdentitySchema,
    abilityId: boundedIdentitySchema
  }),
  characterChargeScaledBaseSchema.extend({
    kind: z.literal('SKILL_BONUS'),
    sourceId: boundedIdentitySchema,
    skillId: boundedIdentitySchema
  }),
  characterChargeScaledBaseSchema.extend({
    kind: z.literal('PROFICIENCY_BONUS'),
    sourceId: boundedIdentitySchema
  })
])

const characterChargeCalculationSchema = z.strictObject({
  calculationId: boundedIdentitySchema,
  sourceId: boundedIdentitySchema,
  base: characterChargeBaseSchema,
  bonuses: z.array(characterChargeBonusSchema).max(100)
})

const eligibilityConstraintSchema = z.enum(['INCLUDE', 'EXCLUDE'])
const eligibilityModeSchema = z.enum(['ALL', 'SELECTED'])
const eligibilityRankSchema = z.enum(['HALF', 'FULL', 'DOUBLE'])

const eligibilityConditionBaseSchema = z.strictObject({
  conditionId: boundedIdentitySchema,
  constraint: eligibilityConstraintSchema
})

const eligibilityConditionSchema = z.discriminatedUnion('kind', [
  eligibilityConditionBaseSchema.extend({
    kind: z.literal('PREDICATE'),
    predicateCode: z.enum([
      'ABILITY_SCORE',
      'HERITAGE',
      'CHARACTER_LEVEL',
      'CLASS_LEVEL',
      'FEAT_OBTAINED',
      'FEATURE_OBTAINED',
      'OPTION_OBTAINED',
      'SPELL_OBTAINED',
      'CAN_CAST_SPELL',
      'EQUIPMENT_PROFICIENCY',
      'EQUIPMENT_PROPERTY_PROFICIENCY',
      'SAVE_ABILITY_PROFICIENCY',
      'LANGUAGE_PROFICIENCY',
      'SKILL_PROFICIENCY',
      'EQUIPMENT_EQUIPPED',
      'SKILL_SCORE',
      'SAVING_THROW_ABILITY_BONUS',
      'WHILE_SOURCE_CARRIED',
      'WHILE_SOURCE_EQUIPPED',
      'WHILE_SOURCE_ATTUNED'
    ]),
    authoringMode: eligibilityModeSchema,
    abilityId: boundedIdentitySchema.nullable(),
    min: z.number().finite().nullable(),
    max: z.number().finite().nullable(),
    requiredIds: z.array(boundedIdentitySchema).max(500),
    secondaryRequiredIds: z.array(boundedIdentitySchema).max(500).default([]),
    category: boundedIdentitySchema.nullable(),
    requiredProperties: z.array(boundedIdentitySchema).max(100),
    minimumRank: eligibilityRankSchema.nullable()
  }),
  eligibilityConditionBaseSchema.extend({ kind: z.literal('UNSUPPORTED') })
])

const eligibilityEvaluationSchema = z.strictObject({
  evaluationId: boundedIdentitySchema,
  sourceState: z.strictObject({
    carried: z.boolean(),
    equipped: z.boolean(),
    attuned: z.boolean()
  }),
  groups: z
    .array(
      z.strictObject({
        groupId: boundedIdentitySchema,
        conditions: z.array(eligibilityConditionSchema).max(200)
      })
    )
    .max(100)
})

const characterSpellGrantAttributeSchema = z.enum([
  'CONCENTRATION',
  'RITUAL',
  'LIMITED_USE',
  'PREPARED',
  'KNOWN',
  'CAST_AT_WILL',
  'CAST_AT_LEVEL',
  'SELF_ONLY'
])

const characterSpellChargeDescriptorSchema = z
  .strictObject({
    id: boundedIdentitySchema,
    limitKind: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
    resetKind: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{0,79}$/)
      .nullable()
  })
  .nullable()

const characterSpellAccessCandidateSchema = z.strictObject({
  sequence: z.number().int().min(0).max(999),
  accessId: boundedIdentitySchema,
  sourceInstanceId: boundedIdentitySchema,
  spellId: boundedIdentitySchema,
  sourceFeatureId: boundedIdentitySchema,
  grantId: boundedIdentitySchema,
  sourceKind: z.enum(['CLASS', 'SUBCLASS', 'RACE', 'SUBRACE']),
  sourceId: boundedIdentitySchema,
  owningClassId: boundedIdentitySchema.nullable(),
  activeSourceLevel: z.number().int().min(1).max(20),
  featureAvailableAtLevel: z.number().int().min(1).max(20),
  inheritedFeatureDuplicate: z.boolean(),
  specializationId: boundedIdentitySchema.nullable(),
  specializationRestrictionIds: z.array(boundedIdentitySchema).max(100).nullable(),
  selectionKind: z.enum(['GRANTED', 'CHOSEN']),
  authoringMode: z.enum(['ALL', 'SELECTED']),
  selectedByCharacter: z.boolean(),
  scalingKind: z.enum(['NONE', 'PER_LEVEL']),
  scalingSource: z
    .enum(['CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'])
    .nullable(),
  progressionLevel: z.number().int().min(1).max(20).nullable(),
  totalLevel: z.number().int().min(0).max(20),
  classLevel: z.number().int().min(1).max(20).nullable(),
  attributes: z.array(characterSpellGrantAttributeSchema).max(16),
  castAtLevel: z.number().int().min(1).max(9).nullable(),
  castingAbility: abilityCodeSchema.nullable(),
  charge: characterSpellChargeDescriptorSchema
})

const characterSpellAccessCandidatesSchema = z
  .array(characterSpellAccessCandidateSchema)
  .max(1000)
  .superRefine((candidates, context) => {
    for (const [index, candidate] of candidates.entries()) {
      if (candidate.sequence !== index) {
        context.addIssue({
          code: 'custom',
          message: 'Spell access candidates must use contiguous source order',
          path: [index, 'sequence']
        })
      }
    }
  })

const characterSpellMechanicSourceSchema = characterActionSpellSourceSchema

const characterSpellMechanicSourceFactSchema = characterSpellMechanicSourceSchema.extend({
  sequence: z.number().int().min(0).max(9_999)
})

const characterSpellMechanicAdjustmentSchema = z.strictObject({
  sequence: z.number().int().min(0).max(9_999),
  id: boundedIdentitySchema,
  source: characterSpellMechanicSourceSchema,
  field: z.enum(['ATTACK_BONUS', 'ATTACK_OVERRIDE', 'DC_BONUS', 'DC_OVERRIDE', 'DAMAGE_BONUS']),
  value: z.number().finite()
})

const characterSpellMechanicsFactsSchema = z.strictObject({
  snapshotSources: z.array(characterSpellMechanicSourceFactSchema).max(1_000),
  adjustments: z.array(characterSpellMechanicAdjustmentSchema).max(1_000)
})

const characterItemMechanicsItemSchema = z.strictObject({
  itemInstanceId: boundedIdentitySchema,
  costAmount: z.number().finite().nullable(),
  weight: z
    .strictObject({
      amount: z.number().finite(),
      unit: measurementUnitCodeSchema
    })
    .nullable()
})

const characterItemMechanicsAdjustmentSchema = z.union([
  z.strictObject({
    id: boundedIdentitySchema,
    itemInstanceId: boundedIdentitySchema,
    field: z.enum([
      'ATTACK_BONUS',
      'ATTACK_OVERRIDE',
      'COST_OVERRIDE',
      'DAMAGE_BONUS',
      'WEIGHT_OVERRIDE'
    ]),
    value: z.number().finite()
  }),
  z.strictObject({
    id: boundedIdentitySchema,
    itemInstanceId: boundedIdentitySchema,
    field: z.enum(['ADAMANTINE', 'DISPLAY_AS_ATTACK', 'DUAL_WIELD', 'SILVERED']),
    value: z.literal(true)
  })
])

const characterItemMechanicsFactsSchema = z.strictObject({
  items: z.array(characterItemMechanicsItemSchema).max(500),
  adjustments: z.array(characterItemMechanicsAdjustmentSchema).max(1_000)
})

const characterCompanionMechanicsCompanionSchema = z.strictObject({
  companionInstanceId: boundedIdentitySchema,
  creatureId: boundedIdentitySchema,
  abilityScores: z.record(boundedIdentitySchema, z.number().finite()),
  armorClass: z.number().finite(),
  maxHitPoints: z.number().finite(),
  size: sizeCodeSchema.nullable(),
  alignmentId: boundedIdentitySchema.nullable(),
  creatureTypeId: boundedIdentitySchema.nullable()
})

const characterCompanionMechanicsAdjustmentSchema = z.union([
  z.strictObject({
    id: boundedIdentitySchema,
    companionInstanceId: boundedIdentitySchema,
    field: z.enum(['ARMOR_CLASS_OVERRIDE', 'MAXIMUM_HIT_POINTS_OVERRIDE']),
    value: z.number().finite()
  }),
  z.strictObject({
    id: boundedIdentitySchema,
    companionInstanceId: boundedIdentitySchema,
    field: z.enum(['ALIGNMENT_OVERRIDE', 'CREATURE_TYPE_OVERRIDE']),
    value: boundedIdentitySchema
  }),
  z.strictObject({
    id: boundedIdentitySchema,
    companionInstanceId: boundedIdentitySchema,
    field: z.literal('SIZE_OVERRIDE'),
    value: sizeCodeSchema
  })
])

const characterCompanionMechanicsFactsSchema = z.strictObject({
  companions: z.array(characterCompanionMechanicsCompanionSchema).max(500),
  adjustments: z.array(characterCompanionMechanicsAdjustmentSchema).max(1_000)
})

const characterDefenseFactsSchema = z.strictObject({
  manualAdditions: z
    .array(
      z.strictObject({
        sourceId: boundedIdentitySchema,
        source: z.strictObject({
          kind: z.literal('MANUAL_ADJUSTMENT'),
          adjustmentId: boundedIdentitySchema
        }),
        kind: z.enum(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY']),
        damageTypeId: serverUuidIdentityDtoSchema
      })
    )
    .max(100)
})

const characterProficiencyFactsSchema = z.strictObject({
  manualAdditions: z
    .array(
      z.strictObject({
        sourceId: boundedIdentitySchema,
        source: z.strictObject({
          kind: z.literal('MANUAL_ADJUSTMENT'),
          adjustmentId: boundedIdentitySchema
        }),
        proficiencyKind: z.enum(['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON']),
        targetId: boundedIdentitySchema
      })
    )
    .max(1_000)
})

const characterSpellAccessReasonSchema = z.enum([
  'ACCESS_GRANTED',
  'SOURCE_LEVEL_LOCKED',
  'PROGRESSION_LEVEL_LOCKED',
  'SPECIALIZATION_MISMATCH',
  'TARGET_NOT_SELECTED',
  'INHERITED_FEATURE_DUPLICATE',
  'DUPLICATE_ACCESS_ID',
  'UNSUPPORTED_SCALING_SOURCE'
])

const characterSpellPreparationSourceSchema = z.strictObject({
  sourceKind: z.enum(['CLASS', 'SUBCLASS']),
  sourceId: boundedIdentitySchema,
  attributes: z.array(boundedIdentitySchema).max(20),
  abilityIndex: z.number().int().min(0).max(31).nullable(),
  spellLimits: z
    .array(
      z.strictObject({
        classLevel: z.number().int().min(1).max(20),
        preparedSpellsLimit: z.number().int().min(-999).max(999).nullable(),
        spellLevels: z.array(z.number().int().min(1).max(9)).max(9)
      })
    )
    .max(20),
  prepareLimit: z
    .strictObject({
      methodKinds: z.array(z.enum(['SPELLCASTING_ABILITY', 'CLASS_LEVEL', 'PER_LEVEL'])).max(3),
      scaling: z.enum(['FULL', 'HALF', 'DOUBLE']).nullable(),
      rounding: z.enum(['UP', 'DOWN', 'NEAREST']).nullable(),
      perLevel: z
        .array(
          z.strictObject({
            classLevel: z.number().int().min(1).max(20),
            amount: z.number().int().min(-999).max(999)
          })
        )
        .max(20)
    })
    .nullable()
})

const characterSpellPreparationClassSchema = z.strictObject({
  classId: boundedIdentitySchema,
  classLevel: z.number().int().min(1).max(20),
  sources: z.array(characterSpellPreparationSourceSchema).max(20),
  learnedStatePresent: z.boolean(),
  learnedStateSpellIds: z.array(boundedIdentitySchema).max(500),
  intentSpellIds: z.array(boundedIdentitySchema).max(500),
  preparedStateSpellIds: z.array(boundedIdentitySchema).max(500)
})

const characterSpellPreparationRequestReasonSchema = z.enum([
  'REQUEST_ALLOWED',
  'CLASS_NOT_ACTIVE',
  'CLASS_DOES_NOT_PREPARE_SPELLS',
  'PREPARATION_LIMIT_EXCEEDED',
  'SPELL_NOT_AVAILABLE'
])

export const characterRulePolicyInputSchema = z.strictObject({
  contractVersion: z.literal(4),
  /** Exact System vocabulary frozen with the Character source snapshot. */
  abilityDefinitions: characterAbilityDefinitionsSchema.default([]),
  grantFoldFacts: characterGrantFoldInputSchema,
  totalLevel: z.number().int().min(0).max(20),
  derivedBaseFacts: characterDerivedBaseFactsSchema,
  spellMechanicsFacts: characterSpellMechanicsFactsSchema.default({
    snapshotSources: [],
    adjustments: []
  }),
  itemMechanicsFacts: characterItemMechanicsFactsSchema.default({ items: [], adjustments: [] }),
  companionMechanicsFacts: characterCompanionMechanicsFactsSchema.default({
    companions: [],
    adjustments: []
  }),
  defenseFacts: characterDefenseFactsSchema.default({ manualAdditions: [] }),
  proficiencyFacts: characterProficiencyFactsSchema.default({ manualAdditions: [] }),
  movementFacts: characterMovementFactsSchema.optional(),
  senseFacts: characterSenseFactsSchema.optional(),
  armorClassFacts: characterArmorClassFactsSchema.optional(),
  hitPointFacts: characterHitPointFactsSchema.optional(),
  spellAccessCandidates: characterSpellAccessCandidatesSchema,
  spellClasses: z.array(z.strictObject({ classId: boundedIdentitySchema })).max(20),
  spellPreparationClasses: z.array(characterSpellPreparationClassSchema).max(20),
  spellPreparationCatalog: z
    .array(
      z.strictObject({
        spellId: boundedIdentitySchema,
        spellLevel: z.number().int().min(0).max(9),
        classIds: z.array(boundedIdentitySchema).max(50)
      })
    )
    .max(5000),
  spellPreparationRequest: z
    .strictObject({
      classId: boundedIdentitySchema,
      spellIds: z.array(boundedIdentitySchema).max(500)
    })
    .nullable(),
  spellCastCandidates: characterSpellCastCandidatesSchema,
  spellActionFacts: characterSpellActionFactsSchema.default([]),
  spellCastSlots: characterSpellCastSlotsSchema,
  spellCastResources: z
    .array(
      z.strictObject({
        ownerKey: boundedIdentitySchema,
        remaining: z.number().int().min(0).max(999)
      })
    )
    .max(500),
  spellcastingClasses: z.array(characterSpellcastingClassSchema).max(20),
  chargeCalculations: z
    .array(characterChargeCalculationSchema)
    .max(500)
    .superRefine((calculations, context) => {
      const seen = new Set<string>()
      for (const [index, calculation] of calculations.entries()) {
        if (seen.has(calculation.calculationId)) {
          context.addIssue({
            code: 'custom',
            message: 'Charge calculation IDs must be unique',
            path: [index, 'calculationId']
          })
        }
        seen.add(calculation.calculationId)
      }
    }),
  resourcePoolCandidates: characterResourcePoolCandidatesSchema.default([]),
  actionCandidates: characterActionCandidatesSchema.default([]),
  resourceUsageFacts: characterResourceUsageFactsSchema.optional(),
  spellSlotUsageFacts: characterSpellSlotUsageFactsSchema.optional(),
  eligibilityFacets: z.array(eligibilityEvaluationSchema).max(200),
  rest: z.strictObject({
    totalHitDice: z.number().int().min(0).max(100),
    currentExhaustion: z.number().int().min(0).max(6),
    attunementSlotOverride: z.number().int().min(0).max(100).nullable(),
    companions: z
      .array(
        z.strictObject({
          companionInstanceId: boundedIdentitySchema,
          totalHitDice: z.number().int().min(0).max(100)
        })
      )
      .max(500)
      .optional()
  })
})

const characterRuleContributionResultSchema = characterRuleContributionInputSchema.extend({
  acceptedModifierIndex: z.number().int().min(0).max(9_999).optional(),
  grantId: boundedIdentitySchema.optional(),
  domainKey: boundedIdentitySchema.optional(),
  source: characterMechanicSourceSchema.optional(),
  state: z.enum(['APPLIED', 'SUPPRESSED']),
  reasonCode: z.enum(['STACKED', 'SUPPRESSED_BY_STACKING'])
})

const characterDerivedNumericCalculationSchema = z.strictObject({
  base: z.number().finite(),
  effective: z.number().finite(),
  contributions: z.array(
    z.strictObject({
      sourceId: boundedIdentitySchema,
      source: characterMechanicSourceSchema,
      acceptedModifierIndex: z.number().int().min(0).max(9_999).optional(),
      grantId: boundedIdentitySchema.optional(),
      domainKey: boundedIdentitySchema.optional(),
      value: z.number().finite(),
      state: z.enum(['APPLIED', 'SUPPRESSED']),
      reasonCode: z.enum(['APPLIED', 'STACKED', 'SUPPRESSED_BY_STACKING', 'SUPPRESSED_BY_OVERRIDE'])
    })
  ),
  override: characterDerivedNumericOverrideSchema
})

const characterDerivedSelectionCalculationSchema = z.strictObject({
  base: boundedIdentitySchema,
  effective: boundedIdentitySchema,
  contributions: z.array(z.never()),
  override: z
    .strictObject({
      sourceId: boundedIdentitySchema,
      source: characterMechanicSourceSchema,
      value: boundedIdentitySchema
    })
    .nullable()
})

const characterDerivedProficiencyCalculationSchema = z.strictObject({
  base: z.literal('NONE'),
  effective: z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE']),
  contributions: z.array(
    z.strictObject({
      acceptedProficiencyIndex: z.number().int().min(0).max(9_999),
      sourceId: boundedIdentitySchema,
      source: characterMechanicSourceSchema,
      grantId: boundedIdentitySchema,
      value: z.enum(['HALF', 'FULL', 'DOUBLE']),
      state: z.enum(['APPLIED', 'SUPPRESSED']),
      reasonCode: z.enum([
        'SELECTED_HIGHEST_RANK',
        'SUPPRESSED_BY_HIGHER_RANK',
        'SUPPRESSED_BY_OVERRIDE'
      ])
    })
  ),
  override: characterDerivedProficiencyOverrideSchema
})

const characterRollModeSchema = z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])
export const characterRuleSenseRangeSchema = z
  .strictObject({
    id: boundedIdentitySchema,
    amount: z.number().finite(),
    unit: measurementUnitCodeSchema,
    calculation: characterDerivedNumericCalculationSchema
  })
  .nullable()
export const characterRuleSenseSchema = z.strictObject({
  senseDefinitionId: serverUuidIdentityDtoSchema,
  range: characterRuleSenseRangeSchema
})
const characterAbilityRollModesSchema = z.strictObject({
  STRENGTH: characterRollModeSchema,
  DEXTERITY: characterRollModeSchema,
  CONSTITUTION: characterRollModeSchema,
  INTELLIGENCE: characterRollModeSchema,
  WISDOM: characterRollModeSchema,
  CHARISMA: characterRollModeSchema
})

const characterRollContributorSchema = z.strictObject({
  sourceId: boundedIdentitySchema,
  source: characterMechanicSourceSchema,
  grantId: boundedIdentitySchema,
  domainKey: boundedIdentitySchema,
  influence: z.enum(['ADVANTAGE', 'DISADVANTAGE'])
})

const characterRollContributorsSchema = z.array(characterRollContributorSchema).max(500)
const canonicalCharacterRollContributorsSchema = characterRollContributorsSchema.superRefine(
  (contributors, context) => {
    let priorKey: string | null = null
    for (const [index, contributor] of contributors.entries()) {
      const prior = contributors[index - 1]
      if (priorKey !== null && prior && compareCanonicalD20Contributors(prior, contributor) >= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: 'Roll contributors must be strictly sorted and unique.'
        })
      }
      priorKey = 'set'
    }
  }
)
const characterRollContributorRecordSchema = z
  .record(boundedIdentitySchema, characterRollContributorsSchema)
  .refine((record) => Object.keys(record).length <= 100, {
    message: 'Roll contributor records support at most 100 test keys.'
  })

const characterRollContributorEvidenceSchema = z.strictObject({
  initiative: characterRollContributorsSchema,
  abilityChecks: z.strictObject({
    STRENGTH: characterRollContributorsSchema,
    DEXTERITY: characterRollContributorsSchema,
    CONSTITUTION: characterRollContributorsSchema,
    INTELLIGENCE: characterRollContributorsSchema,
    WISDOM: characterRollContributorsSchema,
    CHARISMA: characterRollContributorsSchema
  }),
  savingThrows: z.strictObject({
    STRENGTH: characterRollContributorsSchema,
    DEXTERITY: characterRollContributorsSchema,
    CONSTITUTION: characterRollContributorsSchema,
    INTELLIGENCE: characterRollContributorsSchema,
    WISDOM: characterRollContributorsSchema,
    CHARISMA: characterRollContributorsSchema
  }),
  skillChecks: characterRollContributorRecordSchema,
  attacks: z.strictObject({
    MELEE: characterRollContributorsSchema,
    RANGED: characterRollContributorsSchema,
    SPELL: characterRollContributorsSchema,
    UNARMED: characterRollContributorsSchema
  })
})

const emptyCharacterRollContributors = () => ({
  initiative: [],
  abilityChecks: {
    STRENGTH: [],
    DEXTERITY: [],
    CONSTITUTION: [],
    INTELLIGENCE: [],
    WISDOM: [],
    CHARISMA: []
  },
  savingThrows: {
    STRENGTH: [],
    DEXTERITY: [],
    CONSTITUTION: [],
    INTELLIGENCE: [],
    WISDOM: [],
    CHARISMA: []
  },
  skillChecks: {},
  attacks: { MELEE: [], RANGED: [], SPELL: [], UNARMED: [] }
})

export const characterRulePolicyOutputSchema = z.strictObject({
  grantFold: characterGrantFoldOutputSchema,
  proficiencies: z.array(
    z.strictObject({
      kind: boundedIdentitySchema,
      subjectId: boundedIdentitySchema,
      scaling: z.enum(['HALF', 'FULL', 'DOUBLE']),
      source: characterMechanicSourceSchema,
      category: equipmentCategoryCodeSchema.optional(),
      grantId: boundedIdentitySchema.optional()
    })
  ),
  proficiencyBonus: z.number().int(),
  abilityModifiers: z.array(
    z.strictObject({ ability: boundedIdentitySchema, value: z.number().int() })
  ),
  passiveChecks: z.array(
    z.strictObject({ checkId: boundedIdentitySchema, value: z.number().int() })
  ),
  modifierGroups: z.array(
    z.strictObject({
      domainKey: boundedIdentitySchema,
      effective: z.number().finite(),
      contributions: z.array(characterRuleContributionResultSchema)
    })
  ),
  rollModes: z.strictObject({
    initiative: characterRollModeSchema,
    abilityChecks: characterAbilityRollModesSchema,
    savingThrows: characterAbilityRollModesSchema,
    skillChecks: z.record(boundedIdentitySchema, characterRollModeSchema),
    attacks: z.strictObject({
      MELEE: characterRollModeSchema,
      RANGED: characterRollModeSchema,
      SPELL: characterRollModeSchema,
      UNARMED: characterRollModeSchema
    })
  }),
  rollContributorEvidence: characterRollContributorEvidenceSchema.default(
    emptyCharacterRollContributors
  ),
  /** UUID-backed System-policy records for authored rules that select saves. */
  savingThrowDefinitions: z
    .array(
      z.strictObject({
        abilityDefinitionId: serverUuidIdentityDtoSchema,
        modifier: z.number().int(),
        rollMode: characterRollModeSchema,
        contributors: canonicalCharacterRollContributorsSchema
      })
    )
    .max(16)
    .default([]),
  defenses: canonicalCharacterTargetDefensesSchema,
  conditionImmunityIds: canonicalConditionImmunityIdsSchema.default([]),
  movement: z
    .strictObject({
      speeds: z
        .array(
          z.strictObject({
            speedId: boundedIdentitySchema,
            amount: z.number().finite(),
            unit: measurementUnitCodeSchema,
            calculation: characterDerivedNumericCalculationSchema
          })
        )
        .max(100),
      primaryMovementSpeedId: boundedIdentitySchema.nullable()
    })
    .default({ speeds: [], primaryMovementSpeedId: null }),
  senses: z.array(characterRuleSenseSchema).max(100).default([]),
  hitPointProgression: z
    .array(
      z.strictObject({
        sequence: z.number().int().min(0).max(399),
        level: z.number().int().min(1).max(400),
        classId: boundedIdentitySchema,
        classLevel: z.number().int().min(1).max(20),
        value: z.number().int()
      })
    )
    .max(400),
  derivedStats: z.strictObject({
    proficiencyBonus: characterDerivedNumericCalculationSchema,
    abilities: z.array(
      z.strictObject({
        abilityId: boundedIdentitySchema,
        score: characterDerivedNumericCalculationSchema,
        modifier: characterDerivedNumericCalculationSchema
      })
    ),
    savingThrows: z.array(
      z.strictObject({
        abilityId: boundedIdentitySchema,
        proficiency: characterDerivedProficiencyCalculationSchema,
        total: characterDerivedNumericCalculationSchema
      })
    ),
    skills: z.array(
      z.strictObject({
        skillId: boundedIdentitySchema,
        governingAbility: z.strictObject({
          base: boundedIdentitySchema,
          effective: boundedIdentitySchema,
          override: z
            .strictObject({
              sourceId: boundedIdentitySchema,
              value: boundedIdentitySchema
            })
            .nullable()
        }),
        proficiency: characterDerivedProficiencyCalculationSchema,
        total: characterDerivedNumericCalculationSchema,
        passive: characterDerivedNumericCalculationSchema
      })
    ),
    initiative: characterDerivedNumericCalculationSchema,
    armorClass: characterDerivedNumericCalculationSchema.default({
      base: 10,
      effective: 10,
      contributions: [],
      override: null
    }),
    maxHitPoints: characterDerivedNumericCalculationSchema.default({
      base: 0,
      effective: 0,
      contributions: [],
      override: null
    }),
    spellcasting: z
      .strictObject({
        abilityId: boundedIdentitySchema,
        saveDc: characterDerivedNumericCalculationSchema,
        attackBonus: characterDerivedNumericCalculationSchema
      })
      .nullable()
  }),
  spellAccessDecisions: z
    .array(
      z.strictObject({
        sequence: z.number().int().min(0).max(999),
        accessId: boundedIdentitySchema,
        status: z.enum(['INCLUDED', 'EXCLUDED']),
        reasonCode: characterSpellAccessReasonSchema
      })
    )
    .max(1000),
  spellAccess: z
    .array(
      z.strictObject({
        sequence: z.number().int().min(0).max(999),
        accessId: boundedIdentitySchema,
        sourceInstanceId: boundedIdentitySchema,
        spellId: boundedIdentitySchema,
        sourceFeatureId: boundedIdentitySchema,
        grantId: boundedIdentitySchema,
        sourceKind: z.enum(['CLASS', 'SUBCLASS', 'RACE', 'SUBRACE']),
        sourceId: boundedIdentitySchema,
        owningClassId: boundedIdentitySchema.nullable(),
        timingKind: z.enum(['CLASS_LEVEL', 'CHARACTER_LEVEL']),
        timingLevel: z.number().int().min(1).max(20),
        attributes: z.array(characterSpellGrantAttributeSchema).max(16),
        acquisition: z.enum(['KNOWN', 'ALWAYS_PREPARED', 'GRANTED']),
        castMode: z.enum(['SPELL_SLOT', 'AT_WILL', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE']),
        castAtLevel: z.number().int().min(1).max(9).nullable(),
        castingAbility: abilityCodeSchema.nullable(),
        charge: characterSpellChargeDescriptorSchema,
        learned: z.boolean(),
        prepared: z.boolean()
      })
    )
    .max(1000),
  spellMechanics: z
    .array(
      z.strictObject({
        source: characterSpellMechanicSourceSchema,
        attackBonus: z.number().finite().optional(),
        saveDC: z.number().finite().optional(),
        damageBonus: z.number().finite(),
        calculations: z.strictObject({
          attackBonus: characterDerivedNumericCalculationSchema.optional(),
          saveDC: characterDerivedNumericCalculationSchema.optional(),
          damageBonus: characterDerivedNumericCalculationSchema
        })
      })
    )
    .max(1_000),
  itemMechanics: z
    .array(
      z.strictObject({
        itemInstanceId: boundedIdentitySchema,
        attackBonus: z.number().finite(),
        cost: z.number().finite().optional(),
        damageBonus: z.number().finite(),
        displayAsAttack: z.boolean(),
        properties: z.strictObject({
          adamantine: z.boolean(),
          dualWield: z.boolean(),
          silvered: z.boolean()
        }),
        weight: z
          .strictObject({ amount: z.number().finite(), unit: measurementUnitCodeSchema })
          .optional(),
        calculations: z.strictObject({
          attackBonus: characterDerivedNumericCalculationSchema,
          cost: characterDerivedNumericCalculationSchema.optional(),
          damageBonus: characterDerivedNumericCalculationSchema,
          weight: characterDerivedNumericCalculationSchema.optional()
        })
      })
    )
    .max(500),
  companions: z
    .array(
      z.strictObject({
        companionInstanceId: boundedIdentitySchema,
        creatureId: boundedIdentitySchema,
        abilityScores: z.record(boundedIdentitySchema, z.number().finite()),
        armorClass: z.number().finite(),
        maxHitPoints: z.number().finite(),
        size: sizeCodeSchema.optional(),
        alignmentId: boundedIdentitySchema.optional(),
        creatureTypeId: boundedIdentitySchema.optional(),
        calculations: z.strictObject({
          armorClass: characterDerivedNumericCalculationSchema,
          maxHitPoints: characterDerivedNumericCalculationSchema,
          size: characterDerivedSelectionCalculationSchema
            .extend({
              base: sizeCodeSchema,
              effective: sizeCodeSchema,
              override: z
                .strictObject({
                  sourceId: boundedIdentitySchema,
                  source: characterMechanicSourceSchema,
                  value: sizeCodeSchema
                })
                .nullable()
            })
            .optional(),
          alignmentId: characterDerivedSelectionCalculationSchema.optional(),
          creatureTypeId: characterDerivedSelectionCalculationSchema.optional()
        })
      })
    )
    .max(500),
  classSpellStates: z
    .array(
      z.strictObject({
        classId: boundedIdentitySchema,
        learnedSpellIds: z.array(boundedIdentitySchema).max(500),
        preparedSpellIds: z.array(boundedIdentitySchema).max(500)
      })
    )
    .max(20),
  spellPreparation: z.strictObject({
    sources: z
      .array(
        z.strictObject({
          classId: boundedIdentitySchema,
          sourceIds: z.array(boundedIdentitySchema).max(20),
          preparedSpellLimit: z.number().int().min(-999).max(999).nullable(),
          maxPreparableSpellLevel: z.number().int().min(0).max(9),
          availableSpellIds: z.array(boundedIdentitySchema).max(5000),
          learnedSpellIds: z.array(boundedIdentitySchema).max(500),
          preparedSpellIds: z.array(boundedIdentitySchema).max(500)
        })
      )
      .max(20),
    requestDecision: z
      .strictObject({
        classId: boundedIdentitySchema,
        requestedSpellIds: z.array(boundedIdentitySchema).max(500),
        status: z.enum(['ALLOWED', 'REJECTED']),
        reasonCode: characterSpellPreparationRequestReasonSchema,
        unavailableSpellId: boundedIdentitySchema.nullable()
      })
      .nullable()
  }),
  spellCastDecisions: characterSpellCastDecisionsSchema,
  spellSlots: z.strictObject({
    calculationId: boundedIdentitySchema,
    sourceClassIds: z.array(boundedIdentitySchema).max(20),
    maxByLevel: z.array(
      spellSlotEntrySchema.extend({
        sourceIds: z.array(boundedIdentitySchema).max(20),
        rawUsed: z.number().int().min(0).max(2_147_483_647),
        effectiveUsed: z.number().int().min(0),
        remaining: z.number().int().min(0)
      })
    ),
    pactMagic: z
      .strictObject({
        sourceClassId: boundedIdentitySchema,
        slots: z.number().int().min(0),
        level: z.number().int().min(1).max(9),
        rawUsed: z.number().int().min(0).max(2_147_483_647),
        effectiveUsed: z.number().int().min(0),
        remaining: z.number().int().min(0)
      })
      .nullable(),
    fusionStrategy: z.enum(['NONE', 'SINGLE_CLASS', 'MULTICLASS_FUSED'])
  }),
  chargeMaximums: z.array(
    z.strictObject({
      calculationId: boundedIdentitySchema,
      sourceId: boundedIdentitySchema,
      state: z.enum(['RESOLVED', 'UNRESOLVED']),
      maximum: z.number().int().min(0).nullable(),
      reasonCode: z.enum(['CALCULATED', 'MISSING_REQUIRED_FACT']),
      baseContribution: z
        .strictObject({
          sourceId: boundedIdentitySchema,
          value: z.number().int()
        })
        .nullable(),
      bonusContributions: z.array(
        z.strictObject({
          sourceId: boundedIdentitySchema,
          value: z.number().int()
        })
      )
    })
  ),
  resources: characterResourcesSchema.default([]),
  actionDecisions: characterActionDecisionsSchema.default([]),
  spellCastMechanics: characterSpellCastMechanicsSchema.default([]),
  spellReferenceMechanics: characterSpellReferenceMechanicsSchema.default([]),
  eligibilityFacets: z.array(
    z.strictObject({
      evaluationId: boundedIdentitySchema,
      passed: z.boolean(),
      failures: z.array(
        z.strictObject({
          conditionId: boundedIdentitySchema,
          reasonCode: z.enum([
            'REQUIRED_CONDITION_FAILED',
            'EXCLUDED_CONDITION_MATCHED',
            'UNSUPPORTED_CONDITION'
          ])
        })
      )
    })
  ),
  rest: z.strictObject({
    hitDieConstitutionModifier: z.number().finite(),
    hitDiceRecoveredAfterLongRest: z.number().int().min(0),
    currentExhaustion: z.number().int().min(0).max(6),
    minimumExhaustion: z.number().int().min(0).max(6),
    maximumExhaustion: z.number().int().min(0).max(6),
    exhaustionAfterLongRest: z.number().int().min(0).max(6),
    attunementSlotLimit: z.number().int().min(0),
    companionHitDiceRecoveredAfterLongRest: z
      .array(
        z.strictObject({
          companionInstanceId: boundedIdentitySchema,
          recovered: z.number().int().min(0)
        })
      )
      .max(500)
  })
})

export type CharacterRulePolicyInput = z.infer<typeof characterRulePolicyInputSchema>
export type CharacterRulePolicyOutput = z.infer<typeof characterRulePolicyOutputSchema>
