import { z } from 'zod'

import { abilityCodeSchema } from '../shared/enums.js'
import {
  characterMechanicSourceRefDtoSchema,
  characterMovementDisplayPreferenceDtoSchema,
  characterProficiencyLevelDtoSchema,
  characterResourceOwnerRefDtoSchema,
  characterResourceRecoveryDtoSchema,
  characterSheetAdjustmentStateDtoSchema,
  characterSheetSourceNoteDtoSchema,
  characterSpellSourceRefDtoSchema
} from './characterSheet.js'

// PostgreSQL accepts UUID-shaped deterministic SRD IDs whose version bits are zero.
const uuidSchema = z.guid()
const identifierSchema = z.string().trim().min(1)

export const characterSheetPanelTargetDtoSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ABILITY'), ability: abilityCodeSchema }),
  z.object({ kind: z.literal('SAVING_THROW'), ability: abilityCodeSchema }),
  z.object({ kind: z.literal('SKILL'), skillId: uuidSchema }),
  z.object({ kind: z.literal('SKILLS') }),
  z.object({ kind: z.literal('SENSES') }),
  z.object({ kind: z.literal('MOVEMENT') }),
  z.object({ kind: z.literal('DEFENSES') }),
  z.object({ kind: z.literal('PROFICIENCIES') }),
  z.object({
    kind: z.literal('SPELL'),
    source: characterSpellSourceRefDtoSchema,
    castLevel: z.number().int().nonnegative().optional()
  }),
  z.object({ kind: z.literal('SPELLS') }),
  z.object({
    kind: z.literal('FEATURE'),
    featureId: uuidSchema,
    sourceInstanceId: identifierSchema
  }),
  z.object({ kind: z.literal('ITEM'), itemInstanceId: uuidSchema }),
  z.object({ kind: z.literal('BACKGROUND') }),
  z.object({ kind: z.literal('RESOURCE'), owner: characterResourceOwnerRefDtoSchema })
])

export const characterSheetPanelAllowedCommandDtoSchema = z.enum([
  'UPSERT_ADJUSTMENT',
  'REMOVE_ADJUSTMENT',
  'RESET_ADJUSTMENTS',
  'SET_MOVEMENT_DISPLAY_PREFERENCE',
  'SET_PREPARED_SPELLS',
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
  'RECOVER_RESOURCE'
])

const adjustmentEditorMetadataDtoSchema = z.object({
  adjustmentId: uuidSchema.optional(),
  sourceNote: characterSheetSourceNoteDtoSchema.optional()
})

const numericAdjustmentEditorBaseDtoSchema = adjustmentEditorMetadataDtoSchema.extend({
  kind: z.literal('NUMBER'),
  label: z.string().min(1),
  value: z.number().nullable(),
  commitIntent: z.literal('ON_BLUR_OR_ENTER'),
  validation: z.object({
    integer: z.boolean(),
    minimum: z.number().optional(),
    maximum: z.number().optional()
  })
})

const selectAdjustmentEditorBaseDtoSchema = adjustmentEditorMetadataDtoSchema.extend({
  kind: z.literal('SELECT'),
  label: z.string().min(1),
  value: z.string().nullable(),
  options: z.array(
    z.object({
      value: z.string(),
      label: z.string()
    })
  ),
  commitIntent: z.literal('IMMEDIATE')
})

const booleanAdjustmentEditorBaseDtoSchema = adjustmentEditorMetadataDtoSchema.extend({
  kind: z.literal('BOOLEAN'),
  label: z.string().min(1),
  value: z.boolean(),
  commitIntent: z.literal('IMMEDIATE')
})

const textEditorDtoSchema = z.object({
  kind: z.literal('TEXT'),
  field: z.enum(['CUSTOM_NAME', 'NOTES']),
  label: z.string().min(1),
  value: z.string().nullable(),
  multiline: z.boolean(),
  maximumLength: z.number().int().positive(),
  commitIntent: z.literal('ON_BLUR_OR_ENTER')
})

const panelFactDtoSchema = z.object({
  label: z.string().min(1),
  value: z.string()
})

const calculationContributionDtoSchema = z.object({
  id: z.string().min(1),
  source: characterMechanicSourceRefDtoSchema,
  sourceLabel: z.string().min(1),
  sourceNote: characterSheetSourceNoteDtoSchema.optional(),
  value: z.number(),
  state: z.enum(['APPLIED', 'SUPPRESSED'])
})

export const characterSheetPanelNumericCalculationDtoSchema = z.object({
  base: z.number(),
  contributions: z.array(calculationContributionDtoSchema),
  override: z
    .object({
      adjustmentId: uuidSchema,
      value: z.number(),
      sourceLabel: z.string().min(1),
      sourceNote: characterSheetSourceNoteDtoSchema.optional()
    })
    .optional(),
  effective: z.number()
})

const characterSheetPanelCommonDtoSchema = z.object({
  panelId: z.string().min(1),
  characterId: uuidSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  state: characterSheetAdjustmentStateDtoSchema,
  editable: z.boolean(),
  allowedCommands: z.array(characterSheetPanelAllowedCommandDtoSchema)
})

const abilityPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('ABILITY'),
  target: z.object({ kind: z.literal('ABILITY'), ability: abilityCodeSchema }),
  ability: abilityCodeSchema,
  score: z.number().int(),
  modifier: z.number().int(),
  scoreCalculation: characterSheetPanelNumericCalculationDtoSchema,
  editors: z.array(
    numericAdjustmentEditorBaseDtoSchema.extend({
      field: z.enum(['OTHER_MODIFIER', 'SCORE_OVERRIDE'])
    })
  )
})

const savingThrowPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('SAVING_THROW'),
  target: z.object({ kind: z.literal('SAVING_THROW'), ability: abilityCodeSchema }),
  ability: abilityCodeSchema,
  total: z.number().int(),
  proficiency: characterProficiencyLevelDtoSchema,
  calculation: characterSheetPanelNumericCalculationDtoSchema,
  numericEditors: z.array(
    numericAdjustmentEditorBaseDtoSchema.extend({
      field: z.enum(['MAGIC_BONUS', 'MISC_BONUS', 'TOTAL_OVERRIDE'])
    })
  ),
  proficiencyEditor: selectAdjustmentEditorBaseDtoSchema.extend({
    field: z.literal('PROFICIENCY_OVERRIDE')
  })
})

const skillPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('SKILL'),
  target: z.object({ kind: z.literal('SKILL'), skillId: uuidSchema }),
  skillId: uuidSchema,
  code: z.string().min(1),
  ability: abilityCodeSchema,
  total: z.number().int(),
  proficiency: characterProficiencyLevelDtoSchema,
  calculation: characterSheetPanelNumericCalculationDtoSchema,
  numericEditors: z.array(
    numericAdjustmentEditorBaseDtoSchema.extend({
      field: z.enum(['MAGIC_BONUS', 'MISC_BONUS', 'TOTAL_OVERRIDE'])
    })
  ),
  proficiencyEditor: selectAdjustmentEditorBaseDtoSchema.extend({
    field: z.literal('PROFICIENCY_OVERRIDE')
  }),
  abilityEditor: selectAdjustmentEditorBaseDtoSchema.extend({
    field: z.literal('GOVERNING_ABILITY_OVERRIDE')
  })
})

const skillsPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('SKILLS'),
  target: z.object({ kind: z.literal('SKILLS') }),
  skills: z.array(
    z.object({
      target: z.object({ kind: z.literal('SKILL'), skillId: uuidSchema }),
      skillId: uuidSchema,
      code: z.string().min(1),
      label: z.string().min(1),
      ability: abilityCodeSchema,
      total: z.number().int(),
      proficiency: characterProficiencyLevelDtoSchema,
      state: characterSheetAdjustmentStateDtoSchema
    })
  )
})

const sensesPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('SENSES'),
  target: z.object({ kind: z.literal('SENSES') }),
  passiveChecks: z.array(
    z.object({
      skillId: uuidSchema,
      label: z.string().min(1),
      total: z.number().int(),
      state: characterSheetAdjustmentStateDtoSchema,
      calculation: characterSheetPanelNumericCalculationDtoSchema,
      editor: numericAdjustmentEditorBaseDtoSchema.extend({
        field: z.literal('TOTAL_OVERRIDE')
      })
    })
  ),
  senses: z.array(
    z.object({
      senseId: uuidSchema,
      label: z.string().min(1),
      range: z.number().int().nonnegative(),
      unitLabel: z.string().min(1),
      state: characterSheetAdjustmentStateDtoSchema,
      calculation: characterSheetPanelNumericCalculationDtoSchema,
      editor: numericAdjustmentEditorBaseDtoSchema.extend({
        field: z.literal('RANGE_OVERRIDE')
      })
    })
  )
})

const movementPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('MOVEMENT'),
  target: z.object({ kind: z.literal('MOVEMENT') }),
  primarySpeedId: uuidSchema.optional(),
  preference: characterMovementDisplayPreferenceDtoSchema,
  preferenceOptions: z.array(
    z.object({
      value: z.string(),
      label: z.string()
    })
  ),
  speeds: z.array(
    z.object({
      speedId: uuidSchema,
      label: z.string().min(1),
      amount: z.number().int().nonnegative(),
      unitLabel: z.string().min(1),
      state: characterSheetAdjustmentStateDtoSchema,
      calculation: characterSheetPanelNumericCalculationDtoSchema,
      editor: numericAdjustmentEditorBaseDtoSchema.extend({
        field: z.literal('SPEED_OVERRIDE')
      })
    })
  )
})

const defensePanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('DEFENSES'),
  target: z.object({ kind: z.literal('DEFENSES') }),
  defenses: z.array(
    z.object({
      kind: z.enum(['IMMUNITY', 'RESISTANCE', 'VULNERABILITY']),
      damageTypeId: uuidSchema,
      label: z.string().min(1),
      sourceLabel: z.string().min(1),
      adjustmentId: uuidSchema.optional()
    })
  ),
  additionOptions: z.array(
    z.object({
      defenseKind: z.enum(['IMMUNITY', 'RESISTANCE', 'VULNERABILITY']),
      damageTypeId: uuidSchema,
      label: z.string().min(1)
    })
  )
})

const proficiencyPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('PROFICIENCIES'),
  target: z.object({ kind: z.literal('PROFICIENCIES') }),
  proficiencies: z.array(
    z.object({
      kind: z.enum(['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON']),
      targetId: uuidSchema,
      label: z.string().min(1),
      sourceLabel: z.string().min(1),
      adjustmentId: uuidSchema.optional()
    })
  ),
  additionOptions: z.array(
    z.object({
      kind: z.enum(['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON']),
      targetId: uuidSchema,
      label: z.string().min(1)
    })
  )
})

const spellPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('SPELL'),
  target: z.object({
    kind: z.literal('SPELL'),
    source: characterSpellSourceRefDtoSchema,
    castLevel: z.number().int().nonnegative().optional()
  }),
  source: characterSpellSourceRefDtoSchema,
  sourceLabel: z.string().min(1),
  spellId: uuidSchema,
  displayName: z.string().min(1),
  authoredName: z.string().min(1),
  description: z.string().optional(),
  facts: z.array(panelFactDtoSchema),
  effects: z.array(panelFactDtoSchema),
  references: z.array(panelFactDtoSchema),
  prepared: z.boolean(),
  canPrepare: z.boolean(),
  preparationClassId: uuidSchema.optional(),
  displayAsAttack: z.boolean(),
  legalCastModes: z.array(
    z.object({
      kind: z.enum(['AT_WILL', 'SPELL_SLOT', 'FIXED_LEVEL', 'LIMITED_USE']),
      label: z.string().min(1),
      slotKey: identifierSchema.optional(),
      castLevel: z.number().int().nonnegative().optional(),
      available: z.boolean(),
      unavailableReason: z.string().optional()
    })
  ),
  calculations: z.object({
    attackBonus: characterSheetPanelNumericCalculationDtoSchema.optional(),
    saveDC: characterSheetPanelNumericCalculationDtoSchema.optional(),
    damageBonus: characterSheetPanelNumericCalculationDtoSchema.optional()
  }),
  customizationOptions: z.array(
    z.object({
      category: z.enum(['TO_HIT', 'SAVE_DC', 'DAMAGE']),
      label: z.string().min(1),
      supportedModes: z.array(z.enum(['BONUS', 'OVERRIDE'])).min(1),
      configured: z
        .object({
          adjustmentId: uuidSchema,
          mode: z.enum(['BONUS', 'OVERRIDE']),
          value: z.number().int(),
          sourceNote: characterSheetSourceNoteDtoSchema.optional()
        })
        .optional()
    })
  ),
  textEditors: z.array(textEditorDtoSchema)
})

const spellsPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('SPELLS'),
  target: z.object({ kind: z.literal('SPELLS') }),
  slots: z.array(
    z.object({
      slotKey: identifierSchema,
      label: z.string().min(1),
      used: z.number().int().nonnegative(),
      maximum: z.number().int().nonnegative(),
      remaining: z.number().int().nonnegative()
    })
  ),
  groups: z.array(
    z.object({
      level: z.number().int().nonnegative(),
      label: z.string().min(1),
      sources: z.array(
        z.object({
          target: z.object({ kind: z.literal('SPELL'), source: characterSpellSourceRefDtoSchema }),
          source: characterSpellSourceRefDtoSchema,
          spellId: uuidSchema,
          label: z.string().min(1),
          sourceLabel: z.string().min(1),
          prepared: z.boolean(),
          canPrepare: z.boolean(),
          preparationClassId: uuidSchema.optional(),
          state: characterSheetAdjustmentStateDtoSchema
        })
      )
    })
  )
})

const featurePanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('FEATURE'),
  target: z.object({
    kind: z.literal('FEATURE'),
    featureId: uuidSchema,
    sourceInstanceId: identifierSchema
  }),
  featureId: uuidSchema,
  sourceInstanceId: identifierSchema,
  sourceLabel: z.string().min(1),
  description: z.string().optional(),
  facts: z.array(panelFactDtoSchema),
  resources: z.array(
    z.object({
      target: z.object({ kind: z.literal('RESOURCE'), owner: characterResourceOwnerRefDtoSchema }),
      label: z.string().min(1),
      remaining: z.number().int().nonnegative(),
      maximum: z.number().int().nonnegative()
    })
  )
})

const itemPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('ITEM'),
  target: z.object({ kind: z.literal('ITEM'), itemInstanceId: uuidSchema }),
  itemInstanceId: uuidSchema,
  equipmentId: uuidSchema,
  authoredName: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  facts: z.array(panelFactDtoSchema),
  equipped: z.boolean(),
  attuned: z.boolean(),
  requiresAttunement: z.boolean(),
  numericEditors: z.array(
    numericAdjustmentEditorBaseDtoSchema.extend({
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
    booleanAdjustmentEditorBaseDtoSchema.extend({
      field: z.enum(['ADAMANTINE', 'DISPLAY_AS_ATTACK', 'DUAL_WIELD', 'SILVERED'])
    })
  ),
  textEditors: z.array(textEditorDtoSchema),
  resources: z.array(
    z.object({
      target: z.object({ kind: z.literal('RESOURCE'), owner: characterResourceOwnerRefDtoSchema }),
      label: z.string().min(1),
      remaining: z.number().int().nonnegative(),
      maximum: z.number().int().nonnegative()
    })
  )
})

const backgroundPanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('BACKGROUND'),
  target: z.object({ kind: z.literal('BACKGROUND') }),
  backgroundId: uuidSchema,
  description: z.string().optional(),
  facts: z.array(panelFactDtoSchema),
  features: z.array(
    z.object({
      target: z.object({
        kind: z.literal('FEATURE'),
        featureId: uuidSchema,
        sourceInstanceId: identifierSchema
      }),
      label: z.string().min(1),
      description: z.string().optional()
    })
  )
})

const resourcePanelDtoSchema = characterSheetPanelCommonDtoSchema.extend({
  kind: z.literal('RESOURCE'),
  target: z.object({ kind: z.literal('RESOURCE'), owner: characterResourceOwnerRefDtoSchema }),
  owner: characterResourceOwnerRefDtoSchema,
  sourceLabel: z.string().min(1),
  used: z.number().int().nonnegative(),
  maximum: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  recoveries: z.array(characterResourceRecoveryDtoSchema)
})

export const characterSheetPanelDtoSchema = z.discriminatedUnion('kind', [
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
  resourcePanelDtoSchema
])

export type CharacterSheetPanelTargetDto = z.infer<typeof characterSheetPanelTargetDtoSchema>
export type CharacterSheetPanelDto = z.infer<typeof characterSheetPanelDtoSchema>
export type CharacterSheetPanelNumericCalculationDto = z.infer<
  typeof characterSheetPanelNumericCalculationDtoSchema
>
