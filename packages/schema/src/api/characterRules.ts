import { z, lazySchema } from '../zod.js'
import { EQUIPPED_SLOT_CODES } from '@artificer-toolkit/shared/core'

import {
  characterGrantFoldInputSchema,
  characterGrantFoldOutputSchema,
  characterMechanicSourceSchema,
  equipmentInstanceMechanicSourceSchema
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
  damageDefenseBypassCodeSchema,
  equipmentCategoryCodeSchema,
  lengthUnitCodeSchema,
  measurementUnitCodeSchema,
  sizeCodeSchema
} from '../shared/enums.js'
import {
  characterSpellAccessCandidatesSchema,
  characterSpellChargeDescriptorSchema,
  characterSpellGrantAttributeSchema
} from './characterSpellAccessCandidates.js'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'
import { postgresUuidSchema as serverUuidIdentityDtoSchema } from '../shared/postgresUuid.js'
import { characterResourcePoolIdentitySchema } from '../shared/characterResourceIdentity.js'
import { rollModeContributorSourceDtoSchema } from '../shared/ruleExecutionEvidence.js'
import { unlimitedRangeDtoSchema } from '../shared/range.js'
import { authoredLengthSchema } from '../shared/authoredLimits.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

const finiteNumberSchema = lazySchema(() => z.number())
const integerSchema = lazySchema(() => z.number().check(z.int()))
const booleanSchema = lazySchema(() => z.boolean())

const boundedIdentitySchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)

const characterAbilityDefinitionFactSchema = lazySchema(() =>
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    code: boundedIdentitySchema
  })
)

const characterAbilityDefinitionsSchema = lazySchema(() =>
  z.pipe(
    z
      .array(characterAbilityDefinitionFactSchema)
      .check(z.maxLength(32))
      .check(
        z.superRefine((definitions, context) => {
          const ids = new Set<string>()
          const codes = new Set<string>()
          for (const [index, definition] of definitions.entries()) {
            if (ids.has(definition.id)) {
              context.addIssue({
                code: 'custom',
                path: [index, 'id'],
                message: 'Character ability definition IDs must be unique.'
              })
            }
            if (codes.has(definition.code)) {
              context.addIssue({
                code: 'custom',
                path: [index, 'code'],
                message: 'Character ability definition codes must be unique.'
              })
            }
            ids.add(definition.id)
            codes.add(definition.code)
          }
        })
      ),
    z.transform((definitions) =>
      [...definitions].sort((left, right) => left.id.localeCompare(right.id))
    )
  )
)

const characterTargetDefenseSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY']),
    damageTypeId: serverUuidIdentityDtoSchema,
    /** Applies only to damage from actions owned by this authored content; absent: any. */
    sourceEffectIds: z.optional(z.array(serverUuidIdentityDtoSchema).check(z.maxLength(100))),
    source: characterMechanicSourceSchema
  })
)

/** A resistance or immunity that applies only to attacks without any of `bypassedBy`. */
const characterQualifiedDefenseSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum(['RESISTANCE', 'IMMUNITY']),
    damageTypeId: serverUuidIdentityDtoSchema,
    bypassedBy: z.array(damageDefenseBypassCodeSchema).check(z.minLength(1)).check(z.maxLength(3))
  })
)

const canonicalCharacterQualifiedDefensesSchema = lazySchema(() =>
  z.pipe(
    z
      .array(characterQualifiedDefenseSchema)
      .check(z.maxLength(100))
      .check(
        z.superRefine((defenses, ctx) => {
          const keys = new Set<string>()
          defenses.forEach((defense, index) => {
            const key = `${defense.kind}:${defense.damageTypeId}:${[...defense.bypassedBy].sort().join(',')}`
            if (keys.has(key)) {
              ctx.addIssue({
                code: 'custom',
                message: 'Character qualified defenses must be unique.',
                path: [index]
              })
            }
            keys.add(key)
          })
        })
      ),
    z.transform((defenses) =>
      [...defenses].sort(
        (left, right) =>
          left.damageTypeId.localeCompare(right.damageTypeId) ||
          left.kind.localeCompare(right.kind) ||
          [...left.bypassedBy]
            .sort()
            .join(',')
            .localeCompare([...right.bypassedBy].sort().join(','))
      )
    )
  )
)

const canonicalCharacterTargetDefensesSchema = lazySchema(() =>
  z.pipe(
    z
      .array(characterTargetDefenseSchema)
      .check(z.maxLength(100))
      .check(
        z.superRefine((defenses, ctx) => {
          const keys = new Set<string>()
          defenses.forEach((defense, index) => {
            const key = `${defense.kind}:${defense.damageTypeId}:${[...(defense.sourceEffectIds ?? [])].sort().join(',')}`
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
      ),
    z.transform((defenses) =>
      [...defenses].sort(
        (left, right) =>
          left.damageTypeId.localeCompare(right.damageTypeId) ||
          left.kind.localeCompare(right.kind) ||
          (left.sourceEffectIds ?? [])
            .join(',')
            .localeCompare((right.sourceEffectIds ?? []).join(','))
      )
    )
  )
)

const canonicalImmunityIdsSchema = (noun: string) =>
  lazySchema(() =>
    z.pipe(
      z
        .array(serverUuidIdentityDtoSchema)
        .check(z.maxLength(100))
        .check(
          z.superRefine((ids, ctx) => {
            const seen = new Set<string>()
            ids.forEach((id, index) => {
              if (seen.has(id)) {
                ctx.addIssue({
                  code: 'custom',
                  message: `Character ${noun} immunities must be unique.`,
                  path: [index]
                })
              }
              seen.add(id)
            })
          })
        ),
      z.transform((ids) => [...ids].sort())
    )
  )

const canonicalConditionImmunityIdsSchema = canonicalImmunityIdsSchema('condition')
const canonicalSpellSchoolImmunityIdsSchema = canonicalImmunityIdsSchema('spell school')

const characterRuleContributionInputSchema = lazySchema(() =>
  z.strictObject({
    sourceId: boundedIdentitySchema,
    value: finiteNumberSchema
  })
)

const characterMovementFactsSchema = lazySchema(() =>
  z.strictObject({
    speeds: z
      .array(
        z.strictObject({
          speedId: boundedIdentitySchema,
          code: z.nullable(boundedIdentitySchema),
          base: z.nullable(authoredLengthSchema),
          override: z.nullable(
            z.strictObject({ sourceId: boundedIdentitySchema, value: authoredLengthSchema })
          )
        })
      )
      .check(z.maxLength(100)),
    preference: z.strictObject({
      mode: z.enum(['AUTO', 'EXPLICIT']),
      speedId: z.nullable(boundedIdentitySchema)
    })
  })
)

const characterSenseFactsSchema = lazySchema(() =>
  z.strictObject({
    overrides: z
      .array(
        z.strictObject({
          senseDefinitionId: serverUuidIdentityDtoSchema,
          sourceId: boundedIdentitySchema,
          value: authoredLengthSchema
        })
      )
      .check(z.maxLength(100))
  })
)

const characterArmorClassFactsSchema = lazySchema(() =>
  z.strictObject({
    dexterityAbilityIndex: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(31))),
    equipment: z
      .array(
        z.strictObject({
          itemInstanceId: boundedIdentitySchema,
          source: equipmentInstanceMechanicSourceSchema,
          category: z.enum(['ARMOR', 'SHIELD']),
          equippedSlot: z.enum(EQUIPPED_SLOT_CODES),
          armorClass: z.nullable(finiteNumberSchema),
          /** Corrosion that lowers the armor class this item offers. */
          degradation: z.optional(integerSchema.check(z.gte(1)))
        })
      )
      .check(z.maxLength(500))
  })
)

/** What the Character's equipped items occupy, read by the `FREE_HAND` predicate (D107). */
const characterHandFactsSchema = lazySchema(() =>
  z.strictObject({
    items: z
      .array(
        z.strictObject({
          itemInstanceId: boundedIdentitySchema,
          slot: z.enum(EQUIPPED_SLOT_CODES),
          twoHanded: z.boolean()
        })
      )
      .check(z.maxLength(500))
  })
)

const characterHitPointFactsSchema = lazySchema(() =>
  z.strictObject({
    rows: z
      .array(
        z.strictObject({
          classId: boundedIdentitySchema,
          classLevel: integerSchema.check(z.gte(0)).check(z.lte(20)),
          value: finiteNumberSchema
        })
      )
      .check(z.maxLength(400)),
    constitutionAbilityId: boundedIdentitySchema,
    constitutionAbilityIndex: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(31))),
    progression: z._default(
      z.nullable(
        z.strictObject({
          method: z.enum(['FIXED', 'MANUAL']),
          rows: z
            .array(
              z.strictObject({
                sequence: integerSchema.check(z.gte(0)).check(z.lte(399)),
                level: integerSchema.check(z.gte(1)).check(z.lte(400)),
                classId: boundedIdentitySchema,
                classLevel: integerSchema.check(z.gte(1)).check(z.lte(20)),
                die: z.nullable(integerSchema.check(z.positive())),
                abilityIndex: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(31))),
                fallbackValue: integerSchema,
                rollValue: z.nullable(integerSchema)
              })
            )
            .check(z.maxLength(400))
            .check(
              z.superRefine((rows, context) => {
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
            )
        })
      ),
      null
    ),
    manualMaximumModifier: z.nullable(
      z.strictObject({
        sourceId: boundedIdentitySchema,
        source: characterMechanicSourceSchema,
        value: finiteNumberSchema
      })
    ),
    manualMaximumOverride: z.nullable(
      z.strictObject({
        sourceId: boundedIdentitySchema,
        source: characterMechanicSourceSchema,
        value: finiteNumberSchema
      })
    )
  })
)

const characterDerivedNumericBonusSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('FIXED'),
      sourceId: boundedIdentitySchema,
      source: characterMechanicSourceSchema,
      value: finiteNumberSchema,
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
)

const characterDerivedNumericOverrideSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      sourceId: boundedIdentitySchema,
      source: characterMechanicSourceSchema,
      value: finiteNumberSchema
    })
  )
)

const characterDerivedProficiencyOverrideSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      sourceId: boundedIdentitySchema,
      source: characterMechanicSourceSchema,
      value: z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE'])
    })
  )
)

const characterDerivedBaseFactsSchema = lazySchema(() =>
  z.strictObject({
    abilities: z
      .array(
        z.strictObject({
          abilityId: boundedIdentitySchema,
          baseScore: integerSchema.check(z.gte(0)).check(z.lte(30)),
          bonuses: z.array(characterDerivedNumericBonusSchema).check(z.maxLength(200)),
          scoreOverride: characterDerivedNumericOverrideSchema
        })
      )
      .check(z.maxLength(32)),
    savingThrows: z
      .array(
        z.strictObject({
          abilityId: boundedIdentitySchema,
          abilityIndex: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(31))),
          proficiencySubjectId: boundedIdentitySchema,
          proficiencyOverride: characterDerivedProficiencyOverrideSchema,
          bonuses: z.array(characterDerivedNumericBonusSchema).check(z.maxLength(200)),
          totalOverride: characterDerivedNumericOverrideSchema
        })
      )
      .check(z.maxLength(32)),
    skills: z
      .array(
        z.strictObject({
          skillId: boundedIdentitySchema,
          governingAbilityId: boundedIdentitySchema,
          governingAbilityIndex: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(31))),
          governingAbilityOverride: z.nullable(
            z.strictObject({
              sourceId: boundedIdentitySchema,
              value: boundedIdentitySchema,
              abilityIndex: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(31)))
            })
          ),
          proficiencySubjectIds: z
            .array(boundedIdentitySchema)
            .check(z.minLength(1))
            .check(z.maxLength(100)),
          proficiencyOverride: characterDerivedProficiencyOverrideSchema,
          bonuses: z.array(characterDerivedNumericBonusSchema).check(z.maxLength(200)),
          totalOverride: characterDerivedNumericOverrideSchema,
          passiveOverride: characterDerivedNumericOverrideSchema
        })
      )
      .check(z.maxLength(100)),
    initiative: z.strictObject({
      abilityId: boundedIdentitySchema,
      abilityIndex: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(31))),
      bonuses: z.array(characterDerivedNumericBonusSchema).check(z.maxLength(200))
    }),
    spellcasting: z.nullable(
      z.strictObject({
        abilityId: boundedIdentitySchema,
        abilityIndex: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(31))),
        saveDcBonuses: z.array(characterDerivedNumericBonusSchema).check(z.maxLength(200)),
        attackBonuses: z.array(characterDerivedNumericBonusSchema).check(z.maxLength(200))
      })
    )
  })
)

const spellSlotEntrySchema = lazySchema(() =>
  z.strictObject({
    spellLevel: integerSchema.check(z.gte(1)).check(z.lte(9)),
    slotCount: integerSchema.check(z.gte(0)).check(z.lte(99))
  })
)

const characterSpellcastingClassSchema = lazySchema(() =>
  z.strictObject({
    classId: boundedIdentitySchema,
    classLevel: integerSchema.check(z.gte(1)).check(z.lte(20)),
    resetKind: z.string().check(z.regex(/^[A-Z][A-Z0-9_]{0,79}$/)),
    spellLimits: z
      .array(
        z.strictObject({
          classLevel: integerSchema.check(z.gte(1)).check(z.lte(20)),
          slots: z.array(spellSlotEntrySchema).check(z.maxLength(9))
        })
      )
      .check(z.minLength(1))
      .check(z.maxLength(20))
  })
)

const characterSpellSlotUsageFactsSchema = lazySchema(() =>
  z
    .array(
      z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('STANDARD'),
          spellLevel: integerSchema.check(z.gte(1)).check(z.lte(9)),
          rawUsed: integerSchema.check(z.gte(0)).check(z.lte(2_147_483_647))
        }),
        z.strictObject({
          kind: z.literal('POOL'),
          poolCode: boundedIdentitySchema,
          rawUsed: integerSchema.check(z.gte(0)).check(z.lte(2_147_483_647))
        })
      ])
    )
    .check(z.maxLength(10))
    .check(
      z.superRefine((usage, context) => {
        const keys = new Set<string>()
        for (const [index, entry] of usage.entries()) {
          const key = entry.kind === 'STANDARD' ? `STANDARD:${entry.spellLevel}` : entry.poolCode
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
    )
)

const characterChargeLevelsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        sourceId: boundedIdentitySchema,
        level: integerSchema.check(z.gte(1)).check(z.lte(20)),
        amount: finiteNumberSchema
      })
    )
    .check(z.maxLength(20))
)

const characterChargeScaledBaseSchema = lazySchema(() =>
  z.strictObject({
    multiplier: z.nullable(finiteNumberSchema),
    minimum: z.nullable(finiteNumberSchema),
    maximum: z.nullable(finiteNumberSchema)
  })
)

const characterChargeBaseSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.extend(characterChargeScaledBaseSchema, {
      kind: z.literal('ABILITY_MODIFIER'),
      abilityId: boundedIdentitySchema
    }),
    z.extend(characterChargeScaledBaseSchema, { kind: z.literal('CHARACTER_LEVEL') }),
    z.extend(characterChargeScaledBaseSchema, {
      kind: z.literal('CLASS_LEVEL'),
      classId: boundedIdentitySchema
    }),
    z.extend(characterChargeScaledBaseSchema, {
      kind: z.literal('PARENT_CLASS_LEVEL'),
      sourceLevel: characterChargeSourceLevelSchema
    }),
    z.extend(characterChargeScaledBaseSchema, {
      kind: z.literal('SPELL_CAST_LEVEL'),
      spellCastLevel: z.nullable(integerSchema.check(z.gte(1)).check(z.lte(9)))
    }),
    z.strictObject({ kind: z.literal('FIXED_AMOUNT'), amount: finiteNumberSchema }),
    z.strictObject({
      kind: z.literal('PER_LEVEL'),
      sourceLevel: characterChargeSourceLevelSchema,
      levels: characterChargeLevelsSchema
    })
  ])
)

const characterChargeBonusSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.extend(characterChargeScaledBaseSchema, {
      kind: z.literal('ABILITY_MODIFIER'),
      sourceId: boundedIdentitySchema,
      abilityId: boundedIdentitySchema
    }),
    z.extend(characterChargeScaledBaseSchema, {
      kind: z.literal('SKILL_BONUS'),
      sourceId: boundedIdentitySchema,
      skillId: boundedIdentitySchema
    }),
    z.extend(characterChargeScaledBaseSchema, {
      kind: z.literal('PROFICIENCY_BONUS'),
      sourceId: boundedIdentitySchema
    })
  ])
)

const characterChargeCalculationSchema = lazySchema(() =>
  z.strictObject({
    calculationId: characterResourcePoolIdentitySchema,
    sourceId: boundedIdentitySchema,
    base: characterChargeBaseSchema,
    bonuses: z.array(characterChargeBonusSchema).check(z.maxLength(100))
  })
)

const eligibilityConstraintSchema = lazySchema(() => z.enum(['INCLUDE', 'EXCLUDE']))
const eligibilityModeSchema = lazySchema(() => z.enum(['ALL', 'SELECTED']))
const eligibilityRankSchema = lazySchema(() => z.enum(['HALF', 'FULL', 'DOUBLE']))

const eligibilityConditionBaseSchema = lazySchema(() =>
  z.strictObject({
    conditionId: boundedIdentitySchema,
    constraint: eligibilityConstraintSchema
  })
)

const eligibilityConditionSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.extend(eligibilityConditionBaseSchema, {
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
      abilityId: z.nullable(boundedIdentitySchema),
      min: z.nullable(finiteNumberSchema),
      max: z.nullable(finiteNumberSchema),
      requiredIds: z.array(boundedIdentitySchema).check(z.maxLength(500)),
      secondaryRequiredIds: z._default(z.array(boundedIdentitySchema).check(z.maxLength(500)), []),
      category: z.nullable(boundedIdentitySchema),
      requiredProperties: z.array(boundedIdentitySchema).check(z.maxLength(100)),
      minimumRank: z.nullable(eligibilityRankSchema)
    }),
    z.extend(eligibilityConditionBaseSchema, { kind: z.literal('UNSUPPORTED') })
  ])
)

const eligibilityEvaluationSchema = lazySchema(() =>
  z.strictObject({
    evaluationId: boundedIdentitySchema,
    sourceState: z.strictObject({
      carried: booleanSchema,
      equipped: booleanSchema,
      attuned: booleanSchema
    }),
    groups: z
      .array(
        z.strictObject({
          groupId: boundedIdentitySchema,
          conditions: z.array(eligibilityConditionSchema).check(z.maxLength(200))
        })
      )
      .check(z.maxLength(100))
  })
)

const characterSpellMechanicSourceSchema = characterActionSpellSourceSchema

const characterSpellMechanicSourceFactSchema = lazySchema(() =>
  z.extend(characterSpellMechanicSourceSchema, {
    sequence: integerSchema.check(z.gte(0)).check(z.lte(9_999))
  })
)

const characterSpellMechanicAdjustmentSchema = lazySchema(() =>
  z.strictObject({
    sequence: integerSchema.check(z.gte(0)).check(z.lte(9_999)),
    id: boundedIdentitySchema,
    source: characterSpellMechanicSourceSchema,
    field: z.enum(['ATTACK_BONUS', 'ATTACK_OVERRIDE', 'DC_BONUS', 'DC_OVERRIDE', 'DAMAGE_BONUS']),
    value: finiteNumberSchema
  })
)

const characterSpellMechanicsFactsSchema = lazySchema(() =>
  z.strictObject({
    snapshotSources: z.array(characterSpellMechanicSourceFactSchema).check(z.maxLength(1_000)),
    adjustments: z.array(characterSpellMechanicAdjustmentSchema).check(z.maxLength(1_000))
  })
)

const characterItemMechanicsItemSchema = lazySchema(() =>
  z.strictObject({
    itemInstanceId: boundedIdentitySchema,
    costAmount: z.nullable(finiteNumberSchema),
    weight: z.nullable(
      z.strictObject({
        amount: finiteNumberSchema,
        unit: measurementUnitCodeSchema
      })
    )
  })
)

const characterItemMechanicsAdjustmentSchema = lazySchema(() =>
  z.union([
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
      value: finiteNumberSchema
    }),
    z.strictObject({
      id: boundedIdentitySchema,
      itemInstanceId: boundedIdentitySchema,
      field: z.enum(['ADAMANTINE', 'DISPLAY_AS_ATTACK', 'DUAL_WIELD', 'SILVERED']),
      value: z.literal(true)
    })
  ])
)

const characterItemMechanicsFactsSchema = lazySchema(() =>
  z.strictObject({
    items: z.array(characterItemMechanicsItemSchema).check(z.maxLength(500)),
    adjustments: z.array(characterItemMechanicsAdjustmentSchema).check(z.maxLength(1_000))
  })
)

const characterCompanionMechanicsCompanionSchema = lazySchema(() =>
  z.strictObject({
    companionInstanceId: boundedIdentitySchema,
    creatureId: boundedIdentitySchema,
    abilityScores: z.record(boundedIdentitySchema, finiteNumberSchema),
    armorClass: finiteNumberSchema,
    maxHitPoints: finiteNumberSchema,
    size: z.nullable(sizeCodeSchema),
    alignmentId: z.nullable(boundedIdentitySchema),
    creatureTypeId: z.nullable(boundedIdentitySchema)
  })
)

const characterCompanionMechanicsAdjustmentSchema = lazySchema(() =>
  z.union([
    z.strictObject({
      id: boundedIdentitySchema,
      companionInstanceId: boundedIdentitySchema,
      field: z.enum(['ARMOR_CLASS_OVERRIDE', 'MAXIMUM_HIT_POINTS_OVERRIDE']),
      value: finiteNumberSchema
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
)

const characterCompanionMechanicsFactsSchema = lazySchema(() =>
  z.strictObject({
    companions: z.array(characterCompanionMechanicsCompanionSchema).check(z.maxLength(500)),
    adjustments: z.array(characterCompanionMechanicsAdjustmentSchema).check(z.maxLength(1_000))
  })
)

const characterDefenseFactsSchema = lazySchema(() =>
  z.strictObject({
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
      .check(z.maxLength(100))
  })
)

const characterProficiencyFactsSchema = lazySchema(() =>
  z.strictObject({
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
      .check(z.maxLength(1_000))
  })
)

const characterSpellAccessReasonSchema = lazySchema(() =>
  z.enum([
    'ACCESS_GRANTED',
    'SOURCE_LEVEL_LOCKED',
    'PROGRESSION_LEVEL_LOCKED',
    'SPECIALIZATION_MISMATCH',
    'TARGET_NOT_SELECTED',
    'INHERITED_FEATURE_DUPLICATE',
    'DUPLICATE_ACCESS_ID',
    'UNSUPPORTED_SCALING_SOURCE'
  ])
)

const characterSpellPreparationSourceSchema = lazySchema(() =>
  z.strictObject({
    sourceKind: z.enum(['CLASS', 'SUBCLASS']),
    sourceId: boundedIdentitySchema,
    attributes: z.array(boundedIdentitySchema).check(z.maxLength(20)),
    abilityIndex: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(31))),
    spellLimits: z
      .array(
        z.strictObject({
          classLevel: integerSchema.check(z.gte(1)).check(z.lte(20)),
          preparedSpellsLimit: z.nullable(integerSchema.check(z.gte(-999)).check(z.lte(999))),
          spellLevels: z.array(integerSchema.check(z.gte(1)).check(z.lte(9))).check(z.maxLength(9))
        })
      )
      .check(z.maxLength(20)),
    prepareLimit: z.nullable(
      z.strictObject({
        methodKinds: z
          .array(z.enum(['SPELLCASTING_ABILITY', 'CLASS_LEVEL', 'PER_LEVEL']))
          .check(z.maxLength(3)),
        scaling: z.nullable(z.enum(['FULL', 'HALF', 'DOUBLE'])),
        rounding: z.nullable(z.enum(['UP', 'DOWN', 'NEAREST'])),
        perLevel: z
          .array(
            z.strictObject({
              classLevel: integerSchema.check(z.gte(1)).check(z.lte(20)),
              amount: integerSchema.check(z.gte(-999)).check(z.lte(999))
            })
          )
          .check(z.maxLength(20))
      })
    )
  })
)

const characterSpellPreparationClassSchema = lazySchema(() =>
  z.strictObject({
    classId: boundedIdentitySchema,
    classLevel: integerSchema.check(z.gte(1)).check(z.lte(20)),
    sources: z.array(characterSpellPreparationSourceSchema).check(z.maxLength(20)),
    learnedStatePresent: booleanSchema,
    learnedStateSpellIds: z.array(boundedIdentitySchema).check(z.maxLength(500)),
    intentSpellIds: z.array(boundedIdentitySchema).check(z.maxLength(500)),
    preparedStateSpellIds: z.array(boundedIdentitySchema).check(z.maxLength(500))
  })
)

const characterSpellPreparationRequestReasonSchema = lazySchema(() =>
  z.enum([
    'REQUEST_ALLOWED',
    'CLASS_NOT_ACTIVE',
    'CLASS_DOES_NOT_PREPARE_SPELLS',
    'PREPARATION_LIMIT_EXCEEDED',
    'SPELL_NOT_AVAILABLE'
  ])
)

export const characterRulePolicyInputSchema = lazySchema(() =>
  z.strictObject({
    contractVersion: z.literal(4),
    /** Exact System vocabulary frozen with the Character source snapshot. */
    abilityDefinitions: z._default(characterAbilityDefinitionsSchema, []),
    grantFoldFacts: characterGrantFoldInputSchema,
    totalLevel: integerSchema.check(z.gte(0)).check(z.lte(20)),
    derivedBaseFacts: characterDerivedBaseFactsSchema,
    spellMechanicsFacts: z._default(characterSpellMechanicsFactsSchema, {
      snapshotSources: [],
      adjustments: []
    }),
    itemMechanicsFacts: z._default(characterItemMechanicsFactsSchema, {
      items: [],
      adjustments: []
    }),
    companionMechanicsFacts: z._default(characterCompanionMechanicsFactsSchema, {
      companions: [],
      adjustments: []
    }),
    defenseFacts: z._default(characterDefenseFactsSchema, { manualAdditions: [] }),
    proficiencyFacts: z._default(characterProficiencyFactsSchema, { manualAdditions: [] }),
    movementFacts: z.optional(characterMovementFactsSchema),
    senseFacts: z.optional(characterSenseFactsSchema),
    armorClassFacts: z.optional(characterArmorClassFactsSchema),
    handFacts: z.optional(characterHandFactsSchema),
    hitPointFacts: z.optional(characterHitPointFactsSchema),
    spellAccessCandidates: characterSpellAccessCandidatesSchema,
    spellClasses: z
      .array(z.strictObject({ classId: boundedIdentitySchema }))
      .check(z.maxLength(20)),
    spellPreparationClasses: z.array(characterSpellPreparationClassSchema).check(z.maxLength(20)),
    spellPreparationCatalog: z
      .array(
        z.strictObject({
          spellId: boundedIdentitySchema,
          spellLevel: integerSchema.check(z.gte(0)).check(z.lte(9)),
          classIds: z.array(boundedIdentitySchema).check(z.maxLength(50))
        })
      )
      .check(z.maxLength(5000)),
    spellPreparationRequest: z.nullable(
      z.strictObject({
        classId: boundedIdentitySchema,
        spellIds: z.array(boundedIdentitySchema).check(z.maxLength(500))
      })
    ),
    spellCastCandidates: characterSpellCastCandidatesSchema,
    spellActionFacts: z._default(characterSpellActionFactsSchema, []),
    spellCastSlots: characterSpellCastSlotsSchema,
    spellCastResources: z
      .array(
        z.strictObject({
          ownerKey: boundedIdentitySchema,
          remaining: integerSchema.check(z.gte(0)).check(z.lte(999))
        })
      )
      .check(z.maxLength(500)),
    spellcastingClasses: z.array(characterSpellcastingClassSchema).check(z.maxLength(20)),
    chargeCalculations: z
      .array(characterChargeCalculationSchema)
      .check(z.maxLength(500))
      .check(
        z.superRefine((calculations, context) => {
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
        })
      ),
    resourcePoolCandidates: z._default(characterResourcePoolCandidatesSchema, []),
    actionCandidates: z._default(characterActionCandidatesSchema, []),
    resourceUsageFacts: z.optional(characterResourceUsageFactsSchema),
    spellSlotUsageFacts: z.optional(characterSpellSlotUsageFactsSchema),
    eligibilityFacets: z.array(eligibilityEvaluationSchema).check(z.maxLength(200)),
    rest: z.strictObject({
      totalHitDice: integerSchema.check(z.gte(0)).check(z.lte(100)),
      currentExhaustion: integerSchema.check(z.gte(0)).check(z.lte(6)),
      attunementSlotOverride: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(100))),
      companions: z.optional(
        z
          .array(
            z.strictObject({
              companionInstanceId: boundedIdentitySchema,
              totalHitDice: integerSchema.check(z.gte(0)).check(z.lte(100))
            })
          )
          .check(z.maxLength(500))
      )
    })
  })
)

const characterRuleContributionResultSchema = lazySchema(() =>
  z.extend(characterRuleContributionInputSchema, {
    acceptedModifierIndex: z.optional(integerSchema.check(z.gte(0)).check(z.lte(9_999))),
    grantId: z.optional(boundedIdentitySchema),
    domainKey: z.optional(boundedIdentitySchema),
    /** The ability an ability-modifier contribution adds; attack-ability facets read it. */
    ability: z.optional(boundedIdentitySchema),
    source: z.optional(characterMechanicSourceSchema),
    state: z.enum(['APPLIED', 'SUPPRESSED']),
    reasonCode: z.enum(['STACKED', 'SUPPRESSED_BY_STACKING'])
  })
)

const characterDerivedNumericCalculationSchema = lazySchema(() =>
  z.strictObject({
    base: finiteNumberSchema,
    effective: finiteNumberSchema,
    contributions: z.array(
      z.strictObject({
        sourceId: boundedIdentitySchema,
        source: characterMechanicSourceSchema,
        acceptedModifierIndex: z.optional(integerSchema.check(z.gte(0)).check(z.lte(9_999))),
        grantId: z.optional(boundedIdentitySchema),
        domainKey: z.optional(boundedIdentitySchema),
        value: finiteNumberSchema,
        state: z.enum(['APPLIED', 'SUPPRESSED']),
        reasonCode: z.enum([
          'APPLIED',
          'STACKED',
          'SUPPRESSED_BY_STACKING',
          'SUPPRESSED_BY_OVERRIDE'
        ])
      })
    ),
    override: characterDerivedNumericOverrideSchema
  })
)

const characterDerivedSelectionCalculationSchema = lazySchema(() =>
  z.strictObject({
    base: boundedIdentitySchema,
    effective: boundedIdentitySchema,
    contributions: z.array(z.never()),
    override: z.nullable(
      z.strictObject({
        sourceId: boundedIdentitySchema,
        source: characterMechanicSourceSchema,
        value: boundedIdentitySchema
      })
    )
  })
)

const characterDerivedProficiencyCalculationSchema = lazySchema(() =>
  z.strictObject({
    base: z.literal('NONE'),
    effective: z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE']),
    contributions: z.array(
      z.strictObject({
        acceptedProficiencyIndex: integerSchema.check(z.gte(0)).check(z.lte(9_999)),
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
)

/** A Character's resolved reach with a Sense; an unlimited Sense has no distance to calculate. */
export const characterRuleSenseRangeSchema = lazySchema(() =>
  z.union([
    unlimitedRangeDtoSchema,
    z.strictObject({
      id: boundedIdentitySchema,
      rangeKind: z.literal('DISTANCE'),
      amount: finiteNumberSchema,
      unit: lengthUnitCodeSchema,
      calculation: characterDerivedNumericCalculationSchema
    })
  ])
)
const characterRuleSenseSchema = lazySchema(() =>
  z.strictObject({
    senseDefinitionId: serverUuidIdentityDtoSchema,
    range: characterRuleSenseRangeSchema
  })
)
const characterAbilityRollModesSchema = lazySchema(() =>
  z.strictObject({
    STRENGTH: systemCoreCodeSchema,
    DEXTERITY: systemCoreCodeSchema,
    CONSTITUTION: systemCoreCodeSchema,
    INTELLIGENCE: systemCoreCodeSchema,
    WISDOM: systemCoreCodeSchema,
    CHARISMA: systemCoreCodeSchema
  })
)

const characterRollContributorSchema = lazySchema(() =>
  z.strictObject({
    sourceId: boundedIdentitySchema,
    source: rollModeContributorSourceDtoSchema,
    grantId: boundedIdentitySchema,
    domainKey: boundedIdentitySchema,
    influence: systemCoreCodeSchema
  })
)

const characterRollContributorsSchema = lazySchema(() =>
  z.array(characterRollContributorSchema).check(z.maxLength(500))
)
const canonicalCharacterRollContributorsSchema = lazySchema(() =>
  characterRollContributorsSchema.check(
    z.superRefine((contributors, context) => {
      let priorKey: string | null = null
      for (const [index, contributor] of contributors.entries()) {
        const prior = contributors[index - 1]
        if (
          priorKey !== null &&
          prior &&
          compareCanonicalD20Contributors(prior, contributor) >= 0
        ) {
          context.addIssue({
            code: 'custom',
            path: [index],
            message: 'Roll contributors must be strictly sorted and unique.'
          })
        }
        priorKey = 'set'
      }
    })
  )
)
const characterRollContributorRecordSchema = lazySchema(() =>
  z.record(boundedIdentitySchema, characterRollContributorsSchema).check(
    z.refine((record) => Object.keys(record).length <= 100, {
      message: 'Roll contributor records support at most 100 test keys.'
    })
  )
)

const characterRollContributorEvidenceSchema = lazySchema(() =>
  z.strictObject({
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
)

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

export const characterRulePolicyOutputSchema = lazySchema(() =>
  z.strictObject({
    grantFold: characterGrantFoldOutputSchema,
    proficiencies: z.array(
      z.strictObject({
        kind: boundedIdentitySchema,
        subjectId: boundedIdentitySchema,
        scaling: z.enum(['HALF', 'FULL', 'DOUBLE']),
        source: characterMechanicSourceSchema,
        category: z.optional(equipmentCategoryCodeSchema),
        grantId: z.optional(boundedIdentitySchema)
      })
    ),
    proficiencyBonus: integerSchema,
    abilityModifiers: z.array(
      z.strictObject({ ability: boundedIdentitySchema, value: integerSchema })
    ),
    passiveChecks: z.array(
      z.strictObject({ checkId: boundedIdentitySchema, value: integerSchema })
    ),
    modifierGroups: z.array(
      z.strictObject({
        domainKey: boundedIdentitySchema,
        effective: finiteNumberSchema,
        contributions: z.array(characterRuleContributionResultSchema)
      })
    ),
    rollModes: z.strictObject({
      initiative: systemCoreCodeSchema,
      abilityChecks: characterAbilityRollModesSchema,
      savingThrows: characterAbilityRollModesSchema,
      skillChecks: z.record(boundedIdentitySchema, systemCoreCodeSchema),
      attacks: z.strictObject({
        MELEE: systemCoreCodeSchema,
        RANGED: systemCoreCodeSchema,
        SPELL: systemCoreCodeSchema,
        UNARMED: systemCoreCodeSchema
      })
    }),
    rollContributorEvidence: z._default(
      characterRollContributorEvidenceSchema,
      emptyCharacterRollContributors
    ),
    /** UUID-backed System-policy records for authored rules that select saves. */
    savingThrowDefinitions: z._default(
      z
        .array(
          z.strictObject({
            abilityDefinitionId: serverUuidIdentityDtoSchema,
            ruleDefinitionId: z.optional(serverUuidIdentityDtoSchema),
            /** Set on a save against a condition, which includes that condition's scoped grants. */
            conditionTypeId: z.optional(serverUuidIdentityDtoSchema),
            modifier: integerSchema,
            rollMode: systemCoreCodeSchema,
            contributors: canonicalCharacterRollContributorsSchema
          })
        )
        .check(z.maxLength(64)),
      []
    ),
    defenses: canonicalCharacterTargetDefensesSchema,
    qualifiedDefenses: z._default(canonicalCharacterQualifiedDefensesSchema, []),
    conditionImmunityIds: z._default(canonicalConditionImmunityIdsSchema, []),
    spellSchoolImmunityIds: z._default(canonicalSpellSchoolImmunityIdsSchema, []),
    movement: z._default(
      z.strictObject({
        speeds: z
          .array(
            z.strictObject({
              speedId: boundedIdentitySchema,
              amount: finiteNumberSchema,
              unit: lengthUnitCodeSchema,
              calculation: characterDerivedNumericCalculationSchema
            })
          )
          .check(z.maxLength(100)),
        primaryMovementSpeedId: z.nullable(boundedIdentitySchema)
      }),
      { speeds: [], primaryMovementSpeedId: null }
    ),
    senses: z._default(z.array(characterRuleSenseSchema).check(z.maxLength(100)), []),
    /** Attacks one Attack action makes; the highest Extra Attack source applies, they do not add. */
    attacksPerAttackAction: z._default(integerSchema.check(z.gte(1), z.lte(10)), 1),
    hitPointProgression: z
      .array(
        z.strictObject({
          sequence: integerSchema.check(z.gte(0)).check(z.lte(399)),
          level: integerSchema.check(z.gte(1)).check(z.lte(400)),
          classId: boundedIdentitySchema,
          classLevel: integerSchema.check(z.gte(1)).check(z.lte(20)),
          value: integerSchema
        })
      )
      .check(z.maxLength(400)),
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
            override: z.nullable(
              z.strictObject({
                sourceId: boundedIdentitySchema,
                value: boundedIdentitySchema
              })
            )
          }),
          proficiency: characterDerivedProficiencyCalculationSchema,
          total: characterDerivedNumericCalculationSchema,
          passive: characterDerivedNumericCalculationSchema
        })
      ),
      initiative: characterDerivedNumericCalculationSchema,
      armorClass: z._default(characterDerivedNumericCalculationSchema, {
        base: 10,
        effective: 10,
        contributions: [],
        override: null
      }),
      maxHitPoints: z._default(characterDerivedNumericCalculationSchema, {
        base: 0,
        effective: 0,
        contributions: [],
        override: null
      }),
      spellcasting: z.nullable(
        z.strictObject({
          abilityId: boundedIdentitySchema,
          saveDc: characterDerivedNumericCalculationSchema,
          attackBonus: characterDerivedNumericCalculationSchema
        })
      )
    }),
    spellAccessDecisions: z
      .array(
        z.strictObject({
          sequence: integerSchema.check(z.gte(0)).check(z.lte(999)),
          accessId: boundedIdentitySchema,
          status: z.enum(['INCLUDED', 'EXCLUDED']),
          reasonCode: characterSpellAccessReasonSchema
        })
      )
      .check(z.maxLength(1000)),
    spellAccess: z
      .array(
        z.strictObject({
          sequence: integerSchema.check(z.gte(0)).check(z.lte(999)),
          accessId: boundedIdentitySchema,
          sourceInstanceId: boundedIdentitySchema,
          spellId: boundedIdentitySchema,
          sourceFeatureId: boundedIdentitySchema,
          grantId: boundedIdentitySchema,
          sourceKind: z.enum([
            'CLASS',
            'SUBCLASS',
            'RACE',
            'SUBRACE',
            'FEAT',
            'BACKGROUND',
            'OPTION'
          ]),
          sourceId: boundedIdentitySchema,
          acquiredParentId: z._default(z.nullable(boundedIdentitySchema), null),
          owningClassId: z.nullable(boundedIdentitySchema),
          timingKind: z.enum(['CLASS_LEVEL', 'CHARACTER_LEVEL']),
          timingLevel: integerSchema.check(z.gte(1)).check(z.lte(20)),
          attributes: z.array(characterSpellGrantAttributeSchema).check(z.maxLength(16)),
          acquisition: z.enum(['KNOWN', 'ALWAYS_PREPARED', 'GRANTED']),
          castMode: z.enum(['SPELL_SLOT', 'AT_WILL', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE']),
          castAtLevel: z.nullable(integerSchema.check(z.gte(1)).check(z.lte(9))),
          castingAbility: z.nullable(abilityCodeSchema),
          charge: characterSpellChargeDescriptorSchema,
          learned: booleanSchema,
          prepared: booleanSchema
        })
      )
      .check(z.maxLength(1000)),
    spellMechanics: z
      .array(
        z.strictObject({
          source: characterSpellMechanicSourceSchema,
          attackBonus: z.optional(finiteNumberSchema),
          saveDC: z.optional(finiteNumberSchema),
          damageBonus: finiteNumberSchema,
          calculations: z.strictObject({
            attackBonus: z.optional(characterDerivedNumericCalculationSchema),
            saveDC: z.optional(characterDerivedNumericCalculationSchema),
            damageBonus: characterDerivedNumericCalculationSchema
          })
        })
      )
      .check(z.maxLength(1_000)),
    itemMechanics: z
      .array(
        z.strictObject({
          itemInstanceId: boundedIdentitySchema,
          attackBonus: finiteNumberSchema,
          cost: z.optional(finiteNumberSchema),
          damageBonus: finiteNumberSchema,
          displayAsAttack: booleanSchema,
          properties: z.strictObject({
            adamantine: booleanSchema,
            dualWield: booleanSchema,
            silvered: booleanSchema
          }),
          weight: z.optional(
            z.strictObject({ amount: finiteNumberSchema, unit: measurementUnitCodeSchema })
          ),
          calculations: z.strictObject({
            attackBonus: characterDerivedNumericCalculationSchema,
            cost: z.optional(characterDerivedNumericCalculationSchema),
            damageBonus: characterDerivedNumericCalculationSchema,
            weight: z.optional(characterDerivedNumericCalculationSchema)
          })
        })
      )
      .check(z.maxLength(500)),
    companions: z
      .array(
        z.strictObject({
          companionInstanceId: boundedIdentitySchema,
          creatureId: boundedIdentitySchema,
          abilityScores: z.record(boundedIdentitySchema, finiteNumberSchema),
          armorClass: finiteNumberSchema,
          maxHitPoints: finiteNumberSchema,
          size: z.optional(sizeCodeSchema),
          alignmentId: z.optional(boundedIdentitySchema),
          creatureTypeId: z.optional(boundedIdentitySchema),
          calculations: z.strictObject({
            armorClass: characterDerivedNumericCalculationSchema,
            maxHitPoints: characterDerivedNumericCalculationSchema,
            size: z.optional(
              z.extend(characterDerivedSelectionCalculationSchema, {
                base: sizeCodeSchema,
                effective: sizeCodeSchema,
                override: z.nullable(
                  z.strictObject({
                    sourceId: boundedIdentitySchema,
                    source: characterMechanicSourceSchema,
                    value: sizeCodeSchema
                  })
                )
              })
            ),
            alignmentId: z.optional(characterDerivedSelectionCalculationSchema),
            creatureTypeId: z.optional(characterDerivedSelectionCalculationSchema)
          })
        })
      )
      .check(z.maxLength(500)),
    classSpellStates: z
      .array(
        z.strictObject({
          classId: boundedIdentitySchema,
          learnedSpellIds: z.array(boundedIdentitySchema).check(z.maxLength(500)),
          preparedSpellIds: z.array(boundedIdentitySchema).check(z.maxLength(500))
        })
      )
      .check(z.maxLength(20)),
    spellPreparation: z.strictObject({
      sources: z
        .array(
          z.strictObject({
            classId: boundedIdentitySchema,
            sourceIds: z.array(boundedIdentitySchema).check(z.maxLength(20)),
            preparedSpellLimit: z.nullable(integerSchema.check(z.gte(-999)).check(z.lte(999))),
            maxPreparableSpellLevel: integerSchema.check(z.gte(0)).check(z.lte(9)),
            availableSpellIds: z.array(boundedIdentitySchema).check(z.maxLength(5000)),
            learnedSpellIds: z.array(boundedIdentitySchema).check(z.maxLength(500)),
            preparedSpellIds: z.array(boundedIdentitySchema).check(z.maxLength(500))
          })
        )
        .check(z.maxLength(20)),
      requestDecision: z.nullable(
        z.strictObject({
          classId: boundedIdentitySchema,
          requestedSpellIds: z.array(boundedIdentitySchema).check(z.maxLength(500)),
          status: z.enum(['ALLOWED', 'REJECTED']),
          reasonCode: characterSpellPreparationRequestReasonSchema,
          unavailableSpellId: z.nullable(boundedIdentitySchema)
        })
      )
    }),
    spellCastDecisions: characterSpellCastDecisionsSchema,
    spellSlots: z.strictObject({
      calculationId: boundedIdentitySchema,
      sourceClassIds: z.array(boundedIdentitySchema).check(z.maxLength(20)),
      maxByLevel: z.array(
        z.extend(spellSlotEntrySchema, {
          sourceIds: z.array(boundedIdentitySchema).check(z.maxLength(20)),
          rawUsed: integerSchema.check(z.gte(0)).check(z.lte(2_147_483_647)),
          effectiveUsed: integerSchema.check(z.gte(0)),
          remaining: integerSchema.check(z.gte(0))
        })
      ),
      pactMagic: z.nullable(
        z.strictObject({
          poolCode: boundedIdentitySchema,
          sourceClassId: boundedIdentitySchema,
          slots: integerSchema.check(z.gte(0)),
          level: integerSchema.check(z.gte(1)).check(z.lte(9)),
          rawUsed: integerSchema.check(z.gte(0)).check(z.lte(2_147_483_647)),
          effectiveUsed: integerSchema.check(z.gte(0)),
          remaining: integerSchema.check(z.gte(0))
        })
      ),
      fusionStrategy: z.enum(['NONE', 'SINGLE_CLASS', 'MULTICLASS_FUSED'])
    }),
    chargeMaximums: z.array(
      z.strictObject({
        calculationId: characterResourcePoolIdentitySchema,
        sourceId: boundedIdentitySchema,
        state: z.enum(['RESOLVED', 'UNRESOLVED']),
        maximum: z.nullable(integerSchema.check(z.gte(0))),
        reasonCode: z.enum(['CALCULATED', 'MISSING_REQUIRED_FACT']),
        baseContribution: z.nullable(
          z.strictObject({
            sourceId: boundedIdentitySchema,
            value: integerSchema
          })
        ),
        bonusContributions: z.array(
          z.strictObject({
            sourceId: boundedIdentitySchema,
            value: integerSchema
          })
        )
      })
    ),
    resources: z._default(characterResourcesSchema, []),
    actionDecisions: z._default(characterActionDecisionsSchema, []),
    spellCastMechanics: z._default(characterSpellCastMechanicsSchema, []),
    spellReferenceMechanics: z._default(characterSpellReferenceMechanicsSchema, []),
    eligibilityFacets: z.array(
      z.strictObject({
        evaluationId: boundedIdentitySchema,
        passed: booleanSchema,
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
      hitDieConstitutionModifier: finiteNumberSchema,
      hitDiceRecoveredAfterLongRest: integerSchema.check(z.gte(0)),
      currentExhaustion: integerSchema.check(z.gte(0)).check(z.lte(6)),
      minimumExhaustion: integerSchema.check(z.gte(0)).check(z.lte(6)),
      maximumExhaustion: integerSchema.check(z.gte(0)).check(z.lte(6)),
      exhaustionAfterLongRest: integerSchema.check(z.gte(0)).check(z.lte(6)),
      attunementSlotLimit: integerSchema.check(z.gte(0)),
      companionHitDiceRecoveredAfterLongRest: z
        .array(
          z.strictObject({
            companionInstanceId: boundedIdentitySchema,
            recovered: integerSchema.check(z.gte(0))
          })
        )
        .check(z.maxLength(500))
    })
  })
)

export type CharacterRulePolicyInput = z.infer<typeof characterRulePolicyInputSchema>
export type CharacterRulePolicyOutput = z.infer<typeof characterRulePolicyOutputSchema>
