import { EQUIPPED_SLOT_CODES } from '@artificer-toolkit/shared/core'
import { z, lazySchema } from '../zod.js'

import { authoredLengthSchema } from '../shared/authoredLimits.js'
import { lengthUnitCodeSchema } from '../shared/enums.js'
import {
  characterMechanicSourceRefDtoSchema,
  characterMovementDisplayPreferenceDtoSchema,
  characterProficiencyLevelDtoSchema,
  characterResourceOwnerRefDtoSchema,
  characterResourceRecoveryDtoSchema,
  characterSheetReadInputSchema,
  characterSheetAdjustmentStateDtoSchema,
  characterSheetSourceNoteDtoSchema,
  characterSpellSourceRefDtoSchema
} from './characterSheet.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'
import { summonPickOptionsShape } from './summonPickOptions.js'

// PostgreSQL accepts UUID-shaped deterministic SRD IDs whose version bits are zero.
const uuidSchema = lazySchema(() => z.guid())
const stringSchema = lazySchema(() => z.string())
const numberSchema = lazySchema(() => z.number())
const integerSchema = lazySchema(() => z.number().check(z.int()))
const booleanSchema = lazySchema(() => z.boolean())
const identifierSchema = lazySchema(() => stringSchema.check(z.trim()).check(z.minLength(1)))

const sensesPanelTargetDtoSchema = lazySchema(() =>
  z.object({
    kind: z.literal('SENSES'),
    entry: z.optional(
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('PASSIVE'), skillId: identifierSchema }),
        z.object({ kind: z.literal('SENSE'), senseId: identifierSchema })
      ])
    )
  })
)

export const characterSheetPanelTargetDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('ABILITY'), ability: systemCoreCodeSchema }),
    z.object({ kind: z.literal('SAVING_THROW'), ability: systemCoreCodeSchema }),
    z.object({ kind: z.literal('SKILL'), skillId: uuidSchema }),
    z.object({ kind: z.literal('SKILLS') }),
    sensesPanelTargetDtoSchema,
    z.object({ kind: z.literal('MOVEMENT') }),
    z.object({ kind: z.literal('HIT_POINTS') }),
    z.object({ kind: z.literal('DEFENSES') }),
    z.object({ kind: z.literal('PROFICIENCIES') }),
    z.object({
      kind: z.literal('SPELL'),
      source: characterSpellSourceRefDtoSchema,
      castLevel: z.optional(integerSchema.check(z.nonnegative()))
    }),
    z.object({ kind: z.literal('SPELLS') }),
    z.object({
      kind: z.literal('FEATURE'),
      featureId: uuidSchema,
      sourceInstanceId: identifierSchema
    }),
    z.object({ kind: z.literal('ITEM'), itemInstanceId: uuidSchema }),
    z.object({ kind: z.literal('BACKGROUND') }),
    z.object({ kind: z.literal('RESOURCE'), owner: characterResourceOwnerRefDtoSchema }),
    z.object({ kind: z.literal('EXTRAS') }),
    z.object({ kind: z.literal('COMPANION'), companionInstanceId: uuidSchema }),
    z.object({ kind: z.literal('VEHICLE'), vehicleInstanceId: uuidSchema })
  ])
)

export const characterSheetPanelAllowedCommandDtoSchema = lazySchema(() =>
  z.enum([
    'UPSERT_ADJUSTMENT',
    'REMOVE_ADJUSTMENT',
    'RESET_ADJUSTMENTS',
    'SET_MOVEMENT_DISPLAY_PREFERENCE',
    'SET_PREPARED_SPELLS',
    'SET_KNOWN_SPELLS',
    'USE_SPELL_SLOT',
    'RESTORE_SPELL_SLOT',
    'CAST_SPELL',
    'SET_SPELL_MECHANIC_CUSTOMIZATION',
    'REMOVE_SPELL_MECHANIC_CUSTOMIZATION',
    'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
    'UPDATE_OWNED_ITEM',
    'REMOVE_OWNED_ITEM',
    'SET_ITEM_EQUIPPED',
    'SET_ITEM_ATTUNED',
    'USE_RESOURCE',
    'RECOVER_RESOURCE',
    'ADD_EXTRA',
    'UPDATE_EXTRA',
    'REMOVE_EXTRA'
  ])
)

const adjustmentEditorMetadataDtoSchema = lazySchema(() =>
  z.object({
    adjustmentId: z.optional(uuidSchema),
    sourceNote: z.optional(characterSheetSourceNoteDtoSchema)
  })
)

const numericAdjustmentEditorBaseDtoSchema = lazySchema(() =>
  z.extend(adjustmentEditorMetadataDtoSchema, {
    kind: z.literal('NUMBER'),
    label: stringSchema.check(z.minLength(1)),
    value: z.nullable(numberSchema),
    commitIntent: z.literal('ON_BLUR_OR_ENTER'),
    validation: z.object({
      integer: booleanSchema,
      minimum: z.optional(numberSchema),
      maximum: z.optional(numberSchema)
    })
  })
)

const lengthAdjustmentEditorBaseDtoSchema = lazySchema(() =>
  z.extend(adjustmentEditorMetadataDtoSchema, {
    kind: z.literal('LENGTH'),
    label: stringSchema.check(z.minLength(1)),
    value: z.nullable(authoredLengthSchema),
    /** The unit a blank draft starts in: the unit the Character already holds, when it holds one. */
    defaultUnit: z.optional(lengthUnitCodeSchema),
    commitIntent: z.literal('ON_BLUR_OR_ENTER')
  })
)

const selectAdjustmentEditorBaseDtoSchema = lazySchema(() =>
  z.extend(adjustmentEditorMetadataDtoSchema, {
    kind: z.literal('SELECT'),
    label: stringSchema.check(z.minLength(1)),
    value: z.nullable(stringSchema),
    options: z.array(
      z.object({
        value: stringSchema,
        label: stringSchema
      })
    ),
    commitIntent: z.literal('IMMEDIATE')
  })
)

const booleanAdjustmentEditorBaseDtoSchema = lazySchema(() =>
  z.extend(adjustmentEditorMetadataDtoSchema, {
    kind: z.literal('BOOLEAN'),
    label: stringSchema.check(z.minLength(1)),
    value: booleanSchema,
    commitIntent: z.literal('IMMEDIATE')
  })
)

const textEditorDtoSchema = lazySchema(() =>
  z.object({
    kind: z.literal('TEXT'),
    field: z.enum(['CUSTOM_NAME', 'NOTES']),
    label: stringSchema.check(z.minLength(1)),
    value: z.nullable(stringSchema),
    multiline: booleanSchema,
    maximumLength: integerSchema.check(z.positive()),
    commitIntent: z.literal('ON_BLUR_OR_ENTER')
  })
)

const panelFactDtoSchema = lazySchema(() =>
  z.object({
    label: stringSchema.check(z.minLength(1)),
    value: stringSchema
  })
)

const calculationContributionDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema.check(z.minLength(1)),
    source: characterMechanicSourceRefDtoSchema,
    sourceLabel: stringSchema.check(z.minLength(1)),
    sourceNote: z.optional(characterSheetSourceNoteDtoSchema),
    value: numberSchema,
    state: z.enum(['APPLIED', 'SUPPRESSED'])
  })
)

export const characterSheetPanelNumericCalculationDtoSchema = lazySchema(() =>
  z.object({
    base: numberSchema,
    contributions: z.array(calculationContributionDtoSchema),
    override: z.optional(
      z.object({
        adjustmentId: uuidSchema,
        value: numberSchema,
        sourceLabel: stringSchema.check(z.minLength(1)),
        sourceNote: z.optional(characterSheetSourceNoteDtoSchema)
      })
    ),
    effective: numberSchema
  })
)

const characterSheetPanelCommonDtoSchema = lazySchema(() =>
  z.object({
    panelId: stringSchema.check(z.minLength(1)),
    characterId: uuidSchema,
    title: stringSchema.check(z.minLength(1)),
    description: z.optional(stringSchema),
    state: characterSheetAdjustmentStateDtoSchema,
    editable: booleanSchema,
    allowedCommands: z.array(characterSheetPanelAllowedCommandDtoSchema)
  })
)

const abilityPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('ABILITY'),
    target: z.object({ kind: z.literal('ABILITY'), ability: systemCoreCodeSchema }),
    ability: systemCoreCodeSchema,
    score: integerSchema,
    modifier: integerSchema,
    scoreCalculation: characterSheetPanelNumericCalculationDtoSchema,
    editors: z.array(
      z.extend(numericAdjustmentEditorBaseDtoSchema, {
        field: z.enum(['OTHER_MODIFIER', 'SCORE_OVERRIDE'])
      })
    )
  })
)

const savingThrowPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('SAVING_THROW'),
    target: z.object({ kind: z.literal('SAVING_THROW'), ability: systemCoreCodeSchema }),
    ability: systemCoreCodeSchema,
    total: integerSchema,
    proficiency: characterProficiencyLevelDtoSchema,
    calculation: characterSheetPanelNumericCalculationDtoSchema,
    numericEditors: z.array(
      z.extend(numericAdjustmentEditorBaseDtoSchema, {
        field: z.enum(['MAGIC_BONUS', 'MISC_BONUS', 'TOTAL_OVERRIDE'])
      })
    ),
    proficiencyEditor: z.extend(selectAdjustmentEditorBaseDtoSchema, {
      field: z.literal('PROFICIENCY_OVERRIDE')
    })
  })
)

const skillPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('SKILL'),
    target: z.object({ kind: z.literal('SKILL'), skillId: uuidSchema }),
    skillId: uuidSchema,
    code: stringSchema.check(z.minLength(1)),
    ability: systemCoreCodeSchema,
    total: integerSchema,
    proficiency: characterProficiencyLevelDtoSchema,
    calculation: characterSheetPanelNumericCalculationDtoSchema,
    numericEditors: z.array(
      z.extend(numericAdjustmentEditorBaseDtoSchema, {
        field: z.enum(['MAGIC_BONUS', 'MISC_BONUS', 'TOTAL_OVERRIDE'])
      })
    ),
    proficiencyEditor: z.extend(selectAdjustmentEditorBaseDtoSchema, {
      field: z.literal('PROFICIENCY_OVERRIDE')
    }),
    abilityEditor: z.extend(selectAdjustmentEditorBaseDtoSchema, {
      field: z.literal('GOVERNING_ABILITY_OVERRIDE')
    })
  })
)

const skillsPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('SKILLS'),
    target: z.object({ kind: z.literal('SKILLS') }),
    skills: z.array(
      z.object({
        target: z.object({ kind: z.literal('SKILL'), skillId: uuidSchema }),
        skillId: uuidSchema,
        code: stringSchema.check(z.minLength(1)),
        label: stringSchema.check(z.minLength(1)),
        ability: systemCoreCodeSchema,
        total: integerSchema,
        proficiency: characterProficiencyLevelDtoSchema,
        state: characterSheetAdjustmentStateDtoSchema
      })
    )
  })
)

/** Shared by every sense kind: a flat union, because Convex infers an intersection as `any`. */
const senseRowShape = () => ({
  senseId: uuidSchema,
  label: stringSchema.check(z.minLength(1)),
  state: characterSheetAdjustmentStateDtoSchema,
  editor: z.extend(lengthAdjustmentEditorBaseDtoSchema, {
    field: z.literal('RANGE_OVERRIDE')
  })
})

const sensesPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('SENSES'),
    target: sensesPanelTargetDtoSchema,
    passiveChecks: z.array(
      z.object({
        skillId: uuidSchema,
        label: stringSchema.check(z.minLength(1)),
        total: integerSchema,
        state: characterSheetAdjustmentStateDtoSchema,
        calculation: characterSheetPanelNumericCalculationDtoSchema,
        editor: z.extend(numericAdjustmentEditorBaseDtoSchema, {
          field: z.literal('TOTAL_OVERRIDE')
        })
      })
    ),
    senses: z.array(
      z.discriminatedUnion('rangeKind', [
        z.object({ ...senseRowShape(), rangeKind: z.literal('NOT_HELD') }),
        z.object({ ...senseRowShape(), rangeKind: z.literal('UNLIMITED') }),
        z.object({
          ...senseRowShape(),
          rangeKind: z.literal('DISTANCE'),
          range: numberSchema.check(z.nonnegative()),
          unitLabel: stringSchema.check(z.minLength(1)),
          calculation: characterSheetPanelNumericCalculationDtoSchema
        })
      ])
    )
  })
)

/** Shared by both speed kinds: a flat union, because Convex infers an intersection as `any`. */
const movementSpeedShape = () => ({
  speedId: uuidSchema,
  label: stringSchema.check(z.minLength(1)),
  state: characterSheetAdjustmentStateDtoSchema,
  editor: z.extend(lengthAdjustmentEditorBaseDtoSchema, {
    field: z.literal('SPEED_OVERRIDE')
  })
})

const movementPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('MOVEMENT'),
    target: z.object({ kind: z.literal('MOVEMENT') }),
    primarySpeedId: z.optional(uuidSchema),
    preference: characterMovementDisplayPreferenceDtoSchema,
    preferenceOptions: z.array(
      z.object({
        value: stringSchema,
        label: stringSchema
      })
    ),
    speeds: z.array(
      z.discriminatedUnion('speedKind', [
        z.object({ ...movementSpeedShape(), speedKind: z.literal('NOT_HELD') }),
        z.object({
          ...movementSpeedShape(),
          speedKind: z.literal('HELD'),
          amount: numberSchema.check(z.nonnegative()),
          unitLabel: stringSchema.check(z.minLength(1)),
          calculation: characterSheetPanelNumericCalculationDtoSchema
        })
      ])
    )
  })
)

const defensePanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('DEFENSES'),
    target: z.object({ kind: z.literal('DEFENSES') }),
    defenses: z.array(
      z.object({
        kind: z.enum(['IMMUNITY', 'RESISTANCE', 'VULNERABILITY']),
        damageTypeId: uuidSchema,
        label: stringSchema.check(z.minLength(1)),
        sourceLabel: stringSchema.check(z.minLength(1)),
        adjustmentId: z.optional(uuidSchema)
      })
    ),
    additionOptions: z.array(
      z.object({
        defenseKind: z.enum(['IMMUNITY', 'RESISTANCE', 'VULNERABILITY']),
        damageTypeId: uuidSchema,
        label: stringSchema.check(z.minLength(1))
      })
    )
  })
)

const proficiencyPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('PROFICIENCIES'),
    target: z.object({ kind: z.literal('PROFICIENCIES') }),
    proficiencies: z.array(
      z.object({
        kind: z.enum(['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON']),
        targetId: identifierSchema,
        label: stringSchema.check(z.minLength(1)),
        sourceLabel: stringSchema.check(z.minLength(1)),
        adjustmentId: z.optional(uuidSchema)
      })
    ),
    additionOptions: z.array(
      z.object({
        kind: z.enum(['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON']),
        targetId: identifierSchema,
        label: stringSchema.check(z.minLength(1))
      })
    )
  })
)

const spellPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('SPELL'),
    target: z.object({
      kind: z.literal('SPELL'),
      source: characterSpellSourceRefDtoSchema,
      castLevel: z.optional(integerSchema.check(z.nonnegative()))
    }),
    source: characterSpellSourceRefDtoSchema,
    sourceLabel: stringSchema.check(z.minLength(1)),
    spellId: uuidSchema,
    displayName: stringSchema.check(z.minLength(1)),
    authoredName: stringSchema.check(z.minLength(1)),
    description: z.optional(stringSchema),
    facts: z.array(panelFactDtoSchema),
    effects: z.array(panelFactDtoSchema),
    references: z.array(panelFactDtoSchema),
    prepared: booleanSchema,
    canPrepare: booleanSchema,
    preparationClassId: z.optional(uuidSchema),
    known: booleanSchema,
    canManageKnown: booleanSchema,
    knownClassId: z.optional(identifierSchema),
    displayAsAttack: booleanSchema,
    legalCastModes: z.array(
      z.object({
        kind: z.enum(['AT_WILL', 'SPELL_SLOT', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE']),
        label: stringSchema.check(z.minLength(1)),
        slotKey: z.optional(identifierSchema),
        castLevel: z.optional(integerSchema.check(z.nonnegative())),
        available: booleanSchema,
        unavailableReason: z.optional(stringSchema),
        ...summonPickOptionsShape()
      })
    ),
    calculations: z.object({
      attackBonus: z.optional(characterSheetPanelNumericCalculationDtoSchema),
      saveDC: z.optional(characterSheetPanelNumericCalculationDtoSchema),
      damageBonus: z.optional(characterSheetPanelNumericCalculationDtoSchema)
    }),
    customizationOptions: z.array(
      z.object({
        category: z.enum(['TO_HIT', 'SAVE_DC', 'DAMAGE']),
        label: stringSchema.check(z.minLength(1)),
        supportedModes: z.array(z.enum(['BONUS', 'OVERRIDE'])).check(z.minLength(1)),
        configured: z.optional(
          z.object({
            adjustmentId: uuidSchema,
            mode: z.enum(['BONUS', 'OVERRIDE']),
            value: integerSchema,
            sourceNote: z.optional(characterSheetSourceNoteDtoSchema)
          })
        )
      })
    ),
    textEditors: z.array(textEditorDtoSchema)
  })
)

const spellsPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('SPELLS'),
    target: z.object({ kind: z.literal('SPELLS') }),
    slots: z.array(
      z.object({
        slotKey: identifierSchema,
        label: stringSchema.check(z.minLength(1)),
        used: integerSchema.check(z.nonnegative()),
        maximum: integerSchema.check(z.nonnegative()),
        remaining: integerSchema.check(z.nonnegative())
      })
    ),
    groups: z.array(
      z.object({
        level: integerSchema.check(z.nonnegative()),
        label: stringSchema.check(z.minLength(1)),
        sources: z.array(
          z.object({
            target: z.object({
              kind: z.literal('SPELL'),
              source: characterSpellSourceRefDtoSchema
            }),
            source: characterSpellSourceRefDtoSchema,
            spellId: uuidSchema,
            label: stringSchema.check(z.minLength(1)),
            sourceLabel: stringSchema.check(z.minLength(1)),
            prepared: booleanSchema,
            canPrepare: booleanSchema,
            preparationClassId: z.optional(uuidSchema),
            known: booleanSchema,
            canManageKnown: booleanSchema,
            knownClassId: z.optional(identifierSchema),
            state: characterSheetAdjustmentStateDtoSchema
          })
        )
      })
    )
  })
)

const featurePanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('FEATURE'),
    target: z.object({
      kind: z.literal('FEATURE'),
      featureId: uuidSchema,
      sourceInstanceId: identifierSchema
    }),
    featureId: uuidSchema,
    sourceInstanceId: identifierSchema,
    sourceLabel: stringSchema.check(z.minLength(1)),
    description: z.optional(stringSchema),
    facts: z.array(panelFactDtoSchema),
    resources: z.array(
      z.object({
        target: z.object({
          kind: z.literal('RESOURCE'),
          owner: characterResourceOwnerRefDtoSchema
        }),
        label: stringSchema.check(z.minLength(1)),
        remaining: integerSchema.check(z.nonnegative()),
        maximum: integerSchema.check(z.nonnegative())
      })
    )
  })
)

const itemPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('ITEM'),
    target: z.object({ kind: z.literal('ITEM'), itemInstanceId: uuidSchema }),
    itemInstanceId: uuidSchema,
    equipmentId: uuidSchema,
    authoredName: stringSchema.check(z.minLength(1)),
    displayName: stringSchema.check(z.minLength(1)),
    description: z.optional(stringSchema),
    facts: z.array(panelFactDtoSchema),
    equippedSlot: z.nullable(z.enum(EQUIPPED_SLOT_CODES)),
    attuned: booleanSchema,
    requiresAttunement: booleanSchema,
    features: z.array(
      z.object({
        id: stringSchema.check(z.minLength(1)),
        label: stringSchema.check(z.minLength(1)),
        description: z.optional(stringSchema),
        resourceCost: z.optional(integerSchema.check(z.positive())),
        resourceGrantId: z.optional(stringSchema.check(z.minLength(1)))
      })
    ),
    numericEditors: z.array(
      z.extend(numericAdjustmentEditorBaseDtoSchema, {
        field: z.enum([
          'ATTACK_BONUS',
          'ATTACK_OVERRIDE',
          'COST_OVERRIDE',
          'DAMAGE_BONUS',
          'WEIGHT_OVERRIDE'
        ])
      })
    ),
    propertyEditors: z.array(
      z.extend(booleanAdjustmentEditorBaseDtoSchema, {
        field: z.enum(['ADAMANTINE', 'DISPLAY_AS_ATTACK', 'DUAL_WIELD', 'SILVERED'])
      })
    ),
    textEditors: z.array(textEditorDtoSchema),
    resources: z.array(
      z.object({
        id: stringSchema.check(z.minLength(1)),
        target: z.object({
          kind: z.literal('RESOURCE'),
          owner: characterResourceOwnerRefDtoSchema
        }),
        label: stringSchema.check(z.minLength(1)),
        remaining: integerSchema.check(z.nonnegative()),
        maximum: integerSchema.check(z.nonnegative()),
        recoveries: z.array(characterResourceRecoveryDtoSchema)
      })
    )
  })
)

const backgroundPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('BACKGROUND'),
    target: z.object({ kind: z.literal('BACKGROUND') }),
    backgroundId: uuidSchema,
    description: z.optional(stringSchema),
    facts: z.array(panelFactDtoSchema),
    features: z.array(
      z.object({
        target: z.object({
          kind: z.literal('FEATURE'),
          featureId: uuidSchema,
          sourceInstanceId: identifierSchema
        }),
        label: stringSchema.check(z.minLength(1)),
        description: z.optional(stringSchema)
      })
    )
  })
)

const resourcePanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('RESOURCE'),
    target: z.object({ kind: z.literal('RESOURCE'), owner: characterResourceOwnerRefDtoSchema }),
    owner: characterResourceOwnerRefDtoSchema,
    sourceLabel: stringSchema.check(z.minLength(1)),
    used: integerSchema.check(z.nonnegative()),
    maximum: integerSchema.check(z.nonnegative()),
    remaining: integerSchema.check(z.nonnegative()),
    recoveries: z.array(characterResourceRecoveryDtoSchema)
  })
)

const extraActionDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema.check(z.minLength(1)),
    label: stringSchema.check(z.minLength(1)),
    description: z.optional(stringSchema)
  })
)

const extraFeatureDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema.check(z.minLength(1)),
    label: stringSchema.check(z.minLength(1)),
    description: z.optional(stringSchema)
  })
)

const companionHitDiceDtoSchema = lazySchema(() =>
  z
    .array(
      z
        .object({
          die: integerSchema.check(z.positive()),
          total: integerSchema.check(z.nonnegative()),
          used: integerSchema.check(z.nonnegative()),
          remaining: integerSchema.check(z.nonnegative())
        })
        .check(
          z.refine(({ remaining, total, used }) => used <= total && remaining === total - used, {
            message: 'Hit dice usage and remaining count must be consistent.'
          })
        )
    )
    .check(
      z.superRefine((hitDice, context) => {
        const seen = new Set<number>()

        hitDice.forEach(({ die }, index) => {
          if (seen.has(die)) {
            context.addIssue({
              code: 'custom',
              path: [index, 'die'],
              message: 'Hit dice denominations must be unique.'
            })
          }
          seen.add(die)
        })
      })
    )
)

const extrasPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('EXTRAS'),
    target: z.object({ kind: z.literal('EXTRAS') }),
    companionCount: integerSchema.check(z.nonnegative()),
    mountCount: integerSchema.check(z.nonnegative()),
    ownedCreatureCount: integerSchema.check(z.nonnegative()),
    vehicleCount: integerSchema.check(z.nonnegative())
  })
)

const companionPanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('COMPANION'),
    target: z.object({ kind: z.literal('COMPANION'), companionInstanceId: uuidSchema }),
    companionInstanceId: uuidSchema,
    creatureId: uuidSchema,
    relationshipKind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
    relationshipLabel: stringSchema.check(z.minLength(1)),
    originKind: z.enum(['WORLD', 'SUMMONED']),
    originLabel: stringSchema.check(z.minLength(1)),
    size: z.optional(stringSchema.check(z.minLength(1))),
    alignmentId: z.optional(uuidSchema),
    creatureTypeId: z.optional(uuidSchema),
    authoredName: stringSchema.check(z.minLength(1)),
    displayName: stringSchema.check(z.minLength(1)),
    isActive: booleanSchema,
    armorClass: integerSchema.check(z.nonnegative()),
    hitPoints: z.object({
      current: integerSchema.check(z.nonnegative()),
      temp: integerSchema.check(z.nonnegative()),
      maximum: integerSchema.check(z.nonnegative())
    }),
    hitDice: companionHitDiceDtoSchema,
    facts: z.array(panelFactDtoSchema),
    actions: z.array(extraActionDtoSchema),
    features: z.array(extraFeatureDtoSchema),
    equipmentItemIds: z.array(uuidSchema),
    resources: z.array(
      z.object({
        target: z.object({
          kind: z.literal('RESOURCE'),
          owner: characterResourceOwnerRefDtoSchema
        }),
        label: stringSchema.check(z.minLength(1)),
        remaining: integerSchema.check(z.nonnegative()),
        maximum: integerSchema.check(z.nonnegative()),
        recoveries: z.array(characterResourceRecoveryDtoSchema)
      })
    ),
    numericEditors: z.array(
      z.extend(numericAdjustmentEditorBaseDtoSchema, {
        field: z.enum(['ARMOR_CLASS_OVERRIDE', 'MAXIMUM_HIT_POINTS_OVERRIDE'])
      })
    ),
    selectEditors: z.array(
      z.extend(selectAdjustmentEditorBaseDtoSchema, {
        field: z.enum(['ALIGNMENT_OVERRIDE', 'CREATURE_TYPE_OVERRIDE', 'SIZE_OVERRIDE'])
      })
    ),
    textEditors: z.array(textEditorDtoSchema)
  })
)

const vehiclePanelDtoSchema = lazySchema(() =>
  z.extend(characterSheetPanelCommonDtoSchema, {
    kind: z.literal('VEHICLE'),
    target: z.object({ kind: z.literal('VEHICLE'), vehicleInstanceId: uuidSchema }),
    vehicleInstanceId: uuidSchema,
    vehicleId: uuidSchema,
    authoredName: stringSchema.check(z.minLength(1)),
    displayName: stringSchema.check(z.minLength(1)),
    categoryLabel: stringSchema.check(z.minLength(1)),
    isActive: booleanSchema,
    hitPoints: z.object({
      current: integerSchema.check(z.nonnegative()),
      maximum: integerSchema.check(z.nonnegative())
    }),
    facts: z.array(panelFactDtoSchema),
    actions: z.array(extraActionDtoSchema),
    features: z.array(extraFeatureDtoSchema),
    equipmentItemIds: z.array(uuidSchema),
    textEditors: z.array(textEditorDtoSchema)
  })
)

export const characterSheetPanelDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    abilityPanelDtoSchema,
    savingThrowPanelDtoSchema,
    skillPanelDtoSchema,
    skillsPanelDtoSchema,
    sensesPanelDtoSchema,
    movementPanelDtoSchema,
    defensePanelDtoSchema,
    proficiencyPanelDtoSchema,
    spellPanelDtoSchema,
    spellsPanelDtoSchema,
    featurePanelDtoSchema,
    itemPanelDtoSchema,
    backgroundPanelDtoSchema,
    resourcePanelDtoSchema,
    extrasPanelDtoSchema,
    companionPanelDtoSchema,
    vehiclePanelDtoSchema
  ])
)

export const characterSheetPanelInputSchema = lazySchema(() =>
  z.extend(characterSheetReadInputSchema, {
    target: characterSheetPanelTargetDtoSchema
  })
)

export type CharacterSheetPanelInput = z.infer<typeof characterSheetPanelInputSchema>
export type CharacterSheetPanelTargetDto = z.infer<typeof characterSheetPanelTargetDtoSchema>
export type CharacterSheetPanelDto = z.infer<typeof characterSheetPanelDtoSchema>
export type CharacterSheetPanelNumericCalculationDto = z.infer<
  typeof characterSheetPanelNumericCalculationDtoSchema
>
