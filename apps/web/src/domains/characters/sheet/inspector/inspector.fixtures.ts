import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  astralTearChargeId,
  astralTearEquipmentId,
  astralTearItemInstanceId,
  astralTearResourceId
} from '../fixtures/astralTearSheet.fixtures'

const characterId = '00000000-0000-4000-8000-000000000101'
const systemId = '00000000-0000-4000-8000-000000000102'
const adjustmentId = '00000000-0000-4000-8000-000000000103'
const skillId = '00000000-0000-4000-8000-000000000104'
const passiveSkillId = '00000000-0000-4000-8000-000000000105'
const passiveInvestigationSkillId = '00000000-0000-4000-8000-000000000111'
const passiveInsightSkillId = '00000000-0000-4000-8000-000000000112'
const senseId = '00000000-0000-4000-8000-000000000106'
const walkingSpeedId = '00000000-0000-4000-8000-000000000107'
const swimmingSpeedId = '00000000-0000-4000-8000-000000000108'
const damageTypeId = '00000000-0000-4000-8000-000000000109'
const languageId = '00000000-0000-4000-8000-000000000110'

const defaultCalculation = {
  base: 8,
  contributions: [],
  effective: 8
}

const adjustedCalculation = {
  base: 8,
  contributions: [
    {
      id: 'manual-training',
      source: {
        kind: 'MANUAL_ADJUSTMENT',
        adjustmentId
      },
      sourceLabel: 'Manual adjustment',
      sourceNote: 'Earned after completing the cliffside trial.',
      value: 2,
      state: 'APPLIED'
    }
  ],
  effective: 10
} satisfies Extract<CharacterSheetPanelDto, { kind: 'ABILITY' }>['scoreCalculation']

const numberEditorDefaults = {
  kind: 'NUMBER' as const,
  commitIntent: 'ON_BLUR_OR_ENTER' as const,
  validation: { integer: true }
}

export const abilityPanelFixture = {
  kind: 'ABILITY',
  panelId: 'ability:STRENGTH',
  characterId,
  target: { kind: 'ABILITY', ability: 'STRENGTH' },
  title: 'Strength',
  description: 'Strength measures physical power, bodily force, and the ability to exert muscle.',
  state: 'DEFAULT',
  editable: true,
  allowedCommands: ['UPSERT_ADJUSTMENT', 'REMOVE_ADJUSTMENT', 'RESET_ADJUSTMENTS'],
  ability: 'STRENGTH',
  score: 8,
  modifier: -1,
  scoreCalculation: defaultCalculation,
  editors: [
    {
      ...numberEditorDefaults,
      field: 'OTHER_MODIFIER',
      label: 'Other modifier',
      value: null
    },
    {
      ...numberEditorDefaults,
      field: 'SCORE_OVERRIDE',
      label: 'Override score',
      value: null,
      validation: { integer: true, minimum: 0 }
    }
  ]
} satisfies CharacterSheetPanelDto

export const adjustedAbilityPanelFixture = {
  ...abilityPanelFixture,
  state: 'ADJUSTED',
  score: 10,
  modifier: 0,
  scoreCalculation: adjustedCalculation,
  editors: [
    {
      ...numberEditorDefaults,
      adjustmentId,
      field: 'OTHER_MODIFIER',
      label: 'Other modifier',
      value: 2,
      sourceNote: 'Earned after completing the cliffside trial.'
    },
    abilityPanelFixture.editors[1]
  ]
} satisfies CharacterSheetPanelDto

export const overriddenAbilityPanelFixture = {
  ...adjustedAbilityPanelFixture,
  state: 'OVERRIDDEN',
  score: 12,
  modifier: 1,
  scoreCalculation: {
    ...adjustedCalculation,
    contributions: adjustedCalculation.contributions.map((contribution) => ({
      ...contribution,
      state: 'SUPPRESSED' as const
    })),
    override: {
      adjustmentId: '00000000-0000-4000-8000-000000000111',
      value: 12,
      sourceLabel: 'Manual override',
      sourceNote: 'Temporary score for the alpha playtest.'
    },
    effective: 12
  },
  editors: [
    adjustedAbilityPanelFixture.editors[0],
    {
      ...numberEditorDefaults,
      adjustmentId: '00000000-0000-4000-8000-000000000111',
      field: 'SCORE_OVERRIDE',
      label: 'Override score',
      value: 12,
      validation: { integer: true, minimum: 0 },
      sourceNote: 'Temporary score for the alpha playtest.'
    }
  ]
} satisfies CharacterSheetPanelDto

export const savingThrowPanelFixture = {
  kind: 'SAVING_THROW',
  panelId: 'saving-throw:STRENGTH',
  characterId,
  target: { kind: 'SAVING_THROW', ability: 'STRENGTH' },
  title: 'Strength saving throw',
  state: 'DEFAULT',
  editable: true,
  allowedCommands: ['UPSERT_ADJUSTMENT', 'REMOVE_ADJUSTMENT', 'RESET_ADJUSTMENTS'],
  ability: 'STRENGTH',
  total: -1,
  proficiency: 'NONE',
  calculation: {
    base: -1,
    contributions: [],
    effective: -1
  },
  numericEditors: [
    {
      ...numberEditorDefaults,
      field: 'MAGIC_BONUS',
      label: 'Magic bonus',
      value: null
    },
    {
      ...numberEditorDefaults,
      field: 'MISC_BONUS',
      label: 'Miscellaneous bonus',
      value: null
    },
    {
      ...numberEditorDefaults,
      field: 'TOTAL_OVERRIDE',
      label: 'Override total',
      value: null
    }
  ],
  proficiencyEditor: {
    kind: 'SELECT',
    field: 'PROFICIENCY_OVERRIDE',
    label: 'Proficiency',
    value: null,
    options: [
      { value: 'NONE', label: 'Not proficient' },
      { value: 'HALF', label: 'Half proficiency' },
      { value: 'FULL', label: 'Proficient' },
      { value: 'DOUBLE', label: 'Expertise' }
    ],
    commitIntent: 'IMMEDIATE'
  }
} satisfies CharacterSheetPanelDto

export const skillPanelFixture = {
  kind: 'SKILL',
  panelId: `skill:${skillId}`,
  characterId,
  target: { kind: 'SKILL', skillId },
  title: 'Arcana',
  state: 'ADJUSTED',
  editable: true,
  allowedCommands: ['UPSERT_ADJUSTMENT', 'REMOVE_ADJUSTMENT', 'RESET_ADJUSTMENTS'],
  skillId,
  code: 'ARCANA',
  ability: 'INTELLIGENCE',
  total: 6,
  proficiency: 'FULL',
  calculation: {
    base: 3,
    contributions: [
      {
        id: 'proficiency',
        source: { kind: 'SYSTEM', systemId },
        sourceLabel: 'Wizard training',
        value: 2,
        state: 'APPLIED'
      },
      {
        id: 'manual-magic',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId },
        sourceLabel: 'Manual adjustment',
        sourceNote: 'Library access',
        value: 1,
        state: 'APPLIED'
      }
    ],
    effective: 6
  },
  numericEditors: savingThrowPanelFixture.numericEditors.map((editor) =>
    editor.field === 'MAGIC_BONUS'
      ? {
          ...editor,
          adjustmentId,
          value: 1,
          sourceNote: 'Library access'
        }
      : editor
  ),
  proficiencyEditor: savingThrowPanelFixture.proficiencyEditor,
  abilityEditor: {
    kind: 'SELECT',
    field: 'GOVERNING_ABILITY_OVERRIDE',
    label: 'Governing ability',
    value: null,
    options: [
      { value: 'STRENGTH', label: 'Strength' },
      { value: 'DEXTERITY', label: 'Dexterity' },
      { value: 'CONSTITUTION', label: 'Constitution' },
      { value: 'INTELLIGENCE', label: 'Intelligence' },
      { value: 'WISDOM', label: 'Wisdom' },
      { value: 'CHARISMA', label: 'Charisma' }
    ],
    commitIntent: 'IMMEDIATE'
  }
} satisfies CharacterSheetPanelDto

export const skillsPanelFixture = {
  kind: 'SKILLS',
  panelId: 'skills',
  characterId,
  target: { kind: 'SKILLS' },
  title: 'Skills',
  state: 'ADJUSTED',
  editable: false,
  allowedCommands: [],
  skills: [
    {
      target: { kind: 'SKILL', skillId },
      skillId,
      code: 'ARCANA',
      label: 'Arcana',
      ability: 'INTELLIGENCE',
      total: 6,
      proficiency: 'FULL',
      state: 'ADJUSTED'
    },
    {
      target: { kind: 'SKILL', skillId: passiveSkillId },
      skillId: passiveSkillId,
      code: 'PERCEPTION',
      label: 'Perception',
      ability: 'WISDOM',
      total: 3,
      proficiency: 'FULL',
      state: 'DEFAULT'
    }
  ]
} satisfies CharacterSheetPanelDto

export const sensesPanelFixture = {
  kind: 'SENSES',
  panelId: 'senses',
  characterId,
  target: { kind: 'SENSES' },
  title: 'Senses',
  state: 'DEFAULT',
  editable: true,
  allowedCommands: ['UPSERT_ADJUSTMENT', 'REMOVE_ADJUSTMENT', 'RESET_ADJUSTMENTS'],
  passiveChecks: [
    {
      skillId: passiveSkillId,
      label: 'Passive Perception',
      total: 13,
      state: 'DEFAULT',
      calculation: {
        base: 10,
        contributions: [
          {
            id: 'perception',
            source: { kind: 'SYSTEM', systemId },
            sourceLabel: 'Perception bonus',
            value: 3,
            state: 'APPLIED'
          }
        ],
        effective: 13
      },
      editor: {
        ...numberEditorDefaults,
        field: 'TOTAL_OVERRIDE',
        label: 'Override Passive Perception',
        value: null
      }
    },
    {
      skillId: passiveInvestigationSkillId,
      label: 'Passive Investigation',
      total: 13,
      state: 'DEFAULT',
      calculation: {
        base: 10,
        contributions: [
          {
            id: 'investigation',
            source: { kind: 'SYSTEM', systemId },
            sourceLabel: 'Investigation bonus',
            value: 3,
            state: 'APPLIED'
          }
        ],
        effective: 13
      },
      editor: {
        ...numberEditorDefaults,
        field: 'TOTAL_OVERRIDE',
        label: 'Override Passive Investigation',
        value: null
      }
    },
    {
      skillId: passiveInsightSkillId,
      label: 'Passive Insight',
      total: 11,
      state: 'DEFAULT',
      calculation: {
        base: 10,
        contributions: [
          {
            id: 'insight',
            source: { kind: 'SYSTEM', systemId },
            sourceLabel: 'Insight bonus',
            value: 1,
            state: 'APPLIED'
          }
        ],
        effective: 11
      },
      editor: {
        ...numberEditorDefaults,
        field: 'TOTAL_OVERRIDE',
        label: 'Override Passive Insight',
        value: null
      }
    }
  ],
  senses: [
    {
      senseId,
      label: 'Darkvision',
      range: 60,
      unitLabel: 'feet',
      state: 'DEFAULT',
      calculation: {
        base: 60,
        contributions: [],
        effective: 60
      },
      editor: {
        ...numberEditorDefaults,
        field: 'RANGE_OVERRIDE',
        label: 'Override Darkvision range',
        value: null,
        validation: { integer: true, minimum: 0 }
      }
    }
  ]
} satisfies CharacterSheetPanelDto

export const movementPanelFixture = {
  kind: 'MOVEMENT',
  panelId: 'movement',
  characterId,
  target: { kind: 'MOVEMENT' },
  title: 'Movement',
  state: 'DEFAULT',
  editable: true,
  allowedCommands: [
    'UPSERT_ADJUSTMENT',
    'REMOVE_ADJUSTMENT',
    'RESET_ADJUSTMENTS',
    'SET_MOVEMENT_DISPLAY_PREFERENCE'
  ],
  primarySpeedId: walkingSpeedId,
  preference: { mode: 'AUTO' },
  preferenceOptions: [
    { value: 'AUTO', label: 'Automatic' },
    { value: walkingSpeedId, label: 'Walking' },
    { value: swimmingSpeedId, label: 'Swimming' }
  ],
  speeds: [
    {
      speedId: walkingSpeedId,
      label: 'Walking',
      amount: 30,
      unitLabel: 'feet',
      state: 'DEFAULT',
      calculation: {
        base: 30,
        contributions: [],
        effective: 30
      },
      editor: {
        ...numberEditorDefaults,
        field: 'SPEED_OVERRIDE',
        label: 'Override Walking speed',
        value: null,
        validation: { integer: true, minimum: 0 }
      }
    },
    {
      speedId: swimmingSpeedId,
      label: 'Swimming',
      amount: 30,
      unitLabel: 'feet',
      state: 'DEFAULT',
      calculation: {
        base: 30,
        contributions: [],
        effective: 30
      },
      editor: {
        ...numberEditorDefaults,
        field: 'SPEED_OVERRIDE',
        label: 'Override Swimming speed',
        value: null,
        validation: { integer: true, minimum: 0 }
      }
    }
  ]
} satisfies CharacterSheetPanelDto

export const defensesPanelFixture = {
  kind: 'DEFENSES',
  panelId: 'defenses',
  characterId,
  target: { kind: 'DEFENSES' },
  title: 'Defenses',
  state: 'DEFAULT',
  editable: true,
  allowedCommands: ['UPSERT_ADJUSTMENT', 'REMOVE_ADJUSTMENT', 'RESET_ADJUSTMENTS'],
  defenses: [],
  additionOptions: [
    {
      defenseKind: 'RESISTANCE',
      damageTypeId,
      label: 'Fire resistance'
    },
    {
      defenseKind: 'IMMUNITY',
      damageTypeId,
      label: 'Fire immunity'
    }
  ]
} satisfies CharacterSheetPanelDto

export const proficienciesPanelFixture = {
  kind: 'PROFICIENCIES',
  panelId: 'proficiencies',
  characterId,
  target: { kind: 'PROFICIENCIES' },
  title: 'Proficiencies',
  state: 'DEFAULT',
  editable: true,
  allowedCommands: ['UPSERT_ADJUSTMENT', 'REMOVE_ADJUSTMENT', 'RESET_ADJUSTMENTS'],
  proficiencies: [
    {
      kind: 'LANGUAGE',
      targetId: languageId,
      label: 'Common',
      sourceLabel: 'Sea Elf'
    }
  ],
  additionOptions: [
    {
      kind: 'LANGUAGE',
      targetId: '00000000-0000-4000-8000-000000000112',
      label: 'Primordial'
    }
  ]
} satisfies CharacterSheetPanelDto

const wizardSpellSource = {
  sourceKind: 'CLASS' as const,
  sourceInstanceId: 'class:wizard'
}
const wizardClassId = '00000000-0000-4000-8000-000000000113'
const detectMagicSpellId = '00000000-0000-0000-0020-005200000000'
const magicMissileSpellId = '00000000-0000-0000-0020-00c600000000'
const shieldSpellId = '00000000-0000-0000-0020-011000000000'

export const spellPanelFixture = {
  kind: 'SPELL',
  panelId: 'spell:magic-missile:wizard',
  characterId,
  target: {
    kind: 'SPELL',
    source: {
      spellId: magicMissileSpellId,
      ...wizardSpellSource
    }
  },
  title: 'Magic Missile',
  description: 'Three glowing darts of magical force strike creatures you can see within range.',
  state: 'DEFAULT',
  editable: true,
  allowedCommands: [
    'RESET_ADJUSTMENTS',
    'CAST_SPELL',
    'SET_SPELL_MECHANIC_CUSTOMIZATION',
    'REMOVE_SPELL_MECHANIC_CUSTOMIZATION',
    'UPDATE_SPELL_SOURCE_CUSTOMIZATION'
  ],
  source: {
    spellId: magicMissileSpellId,
    ...wizardSpellSource
  },
  sourceLabel: 'Wizard',
  spellId: magicMissileSpellId,
  displayName: 'Magic Missile',
  authoredName: 'Magic Missile',
  facts: [
    { label: 'Level', value: '1st-level evocation' },
    { label: 'Casting time', value: '1 action' },
    { label: 'Range', value: '120 feet' },
    { label: 'Duration', value: 'Instantaneous' }
  ],
  effects: [{ label: 'Damage', value: '3 × (1d4 + 1) Force damage' }],
  references: [{ label: 'Source', value: 'Core Rules, p. 257' }],
  prepared: true,
  canPrepare: true,
  known: false,
  canManageKnown: false,
  preparationClassId: wizardClassId,
  displayAsAttack: false,
  legalCastModes: [
    {
      kind: 'SPELL_SLOT',
      label: 'Cast at 1st level',
      slotKey: 'STANDARD:1',
      castLevel: 1,
      available: true
    },
    {
      kind: 'SPELL_SLOT',
      label: 'Cast at 2nd level',
      slotKey: 'STANDARD:2',
      castLevel: 2,
      available: true
    }
  ],
  calculations: {
    damageBonus: {
      base: 1,
      contributions: [],
      effective: 1
    }
  },
  customizationOptions: [
    {
      category: 'DAMAGE',
      label: 'Damage',
      supportedModes: ['BONUS']
    }
  ],
  textEditors: [
    {
      kind: 'TEXT',
      field: 'CUSTOM_NAME',
      label: 'Custom name',
      value: null,
      multiline: false,
      maximumLength: 120,
      commitIntent: 'ON_BLUR_OR_ENTER'
    },
    {
      kind: 'TEXT',
      field: 'NOTES',
      label: 'Notes',
      value: null,
      multiline: true,
      maximumLength: 2000,
      commitIntent: 'ON_BLUR_OR_ENTER'
    }
  ]
} satisfies CharacterSheetPanelDto

export const spellPanelAttackDamageFixture = {
  ...spellPanelFixture,
  displayAsAttack: true,
  calculations: {
    attackBonus: {
      base: 5,
      contributions: [],
      effective: 5
    },
    damageBonus: {
      base: 1,
      contributions: [],
      effective: 1
    }
  },
  customizationOptions: [
    {
      category: 'TO_HIT',
      label: 'Spell attack',
      supportedModes: ['BONUS', 'OVERRIDE']
    },
    ...spellPanelFixture.customizationOptions
  ]
} satisfies CharacterSheetPanelDto

export const spellPanelSaveDamageFixture = {
  ...spellPanelFixture,
  calculations: {
    saveDC: {
      base: 13,
      contributions: [],
      effective: 13
    },
    damageBonus: {
      base: 1,
      contributions: [],
      effective: 1
    }
  },
  customizationOptions: [
    {
      category: 'SAVE_DC',
      label: 'Spell save DC',
      supportedModes: ['BONUS', 'OVERRIDE']
    },
    ...spellPanelFixture.customizationOptions
  ]
} satisfies CharacterSheetPanelDto

export const spellPanelEmptyCustomizationsFixture = {
  ...spellPanelFixture,
  customizationOptions: []
} satisfies CharacterSheetPanelDto

export const spellPanelConfiguredCustomizationsFixture = {
  ...spellPanelAttackDamageFixture,
  customizationOptions: [
    {
      category: 'TO_HIT',
      label: 'Spell attack',
      supportedModes: ['BONUS', 'OVERRIDE'],
      configured: {
        adjustmentId: adjustmentId,
        mode: 'BONUS',
        value: 2,
        sourceNote: 'Wand of the War Mage'
      }
    },
    {
      category: 'SAVE_DC',
      label: 'Spell save DC',
      supportedModes: ['BONUS', 'OVERRIDE'],
      configured: {
        adjustmentId: '00000000-0000-4000-8000-000000000119',
        mode: 'OVERRIDE',
        value: 17,
        sourceNote: 'Table ruling'
      }
    },
    {
      category: 'DAMAGE',
      label: 'Damage',
      supportedModes: ['BONUS'],
      configured: {
        adjustmentId: '00000000-0000-4000-8000-000000000120',
        mode: 'BONUS',
        value: 1,
        sourceNote: 'Empowered Evocation'
      }
    }
  ]
} satisfies CharacterSheetPanelDto

export const spellsPanelFixture = {
  kind: 'SPELLS',
  panelId: 'spells',
  characterId,
  target: { kind: 'SPELLS' },
  title: 'Manage Spells',
  state: 'DEFAULT',
  editable: true,
  allowedCommands: [
    'SET_PREPARED_SPELLS',
    'SET_KNOWN_SPELLS',
    'USE_SPELL_SLOT',
    'RESTORE_SPELL_SLOT',
    'CAST_SPELL'
  ],
  slots: [
    { slotKey: 'STANDARD:1', label: 'Level 1', used: 1, maximum: 4, remaining: 3 },
    { slotKey: 'STANDARD:2', label: 'Level 2', used: 1, maximum: 2, remaining: 1 }
  ],
  groups: [
    {
      level: 1,
      label: 'Level 1',
      sources: [
        {
          target: {
            kind: 'SPELL',
            source: { spellId: shieldSpellId, ...wizardSpellSource }
          },
          source: { spellId: shieldSpellId, ...wizardSpellSource },
          spellId: shieldSpellId,
          label: 'Shield',
          sourceLabel: 'Wizard',
          prepared: true,
          canPrepare: true,
          known: false,
          canManageKnown: false,
          preparationClassId: wizardClassId,
          state: 'DEFAULT'
        },
        {
          target: {
            kind: 'SPELL',
            source: { spellId: magicMissileSpellId, ...wizardSpellSource }
          },
          source: { spellId: magicMissileSpellId, ...wizardSpellSource },
          spellId: magicMissileSpellId,
          label: 'Magic Missile',
          sourceLabel: 'Wizard',
          prepared: true,
          canPrepare: true,
          known: false,
          canManageKnown: false,
          preparationClassId: wizardClassId,
          state: 'DEFAULT'
        },
        {
          target: {
            kind: 'SPELL',
            source: { spellId: detectMagicSpellId, ...wizardSpellSource }
          },
          source: { spellId: detectMagicSpellId, ...wizardSpellSource },
          spellId: detectMagicSpellId,
          label: 'Detect Magic',
          sourceLabel: 'Wizard',
          prepared: true,
          canPrepare: true,
          known: false,
          canManageKnown: false,
          preparationClassId: wizardClassId,
          state: 'DEFAULT'
        }
      ]
    }
  ]
} satisfies CharacterSheetPanelDto

export const companionPanelFixture = {
  kind: 'COMPANION',
  panelId: 'companion:00000000-0000-4000-8000-000000000501',
  characterId,
  target: { kind: 'COMPANION', companionInstanceId: '00000000-0000-4000-8000-000000000501' },
  title: 'Ferdinand',
  state: 'ADJUSTED',
  editable: true,
  allowedCommands: [
    'UPSERT_ADJUSTMENT',
    'REMOVE_ADJUSTMENT',
    'RESET_ADJUSTMENTS',
    'USE_RESOURCE',
    'RECOVER_RESOURCE',
    'UPDATE_EXTRA',
    'REMOVE_EXTRA'
  ],
  companionInstanceId: '00000000-0000-4000-8000-000000000501',
  creatureId: '00000000-0000-4000-8000-000000000502',
  relationshipKind: 'COMPANION',
  relationshipLabel: 'Companion',
  originKind: 'SUMMONED',
  originLabel: 'Summoned',
  authoredName: 'Owl',
  displayName: 'Ferdinand',
  isActive: true,
  armorClass: 11,
  hitPoints: { current: 1, temp: 0, maximum: 1 },
  hitDice: [{ die: 8, total: 2, used: 1, remaining: 1 }],
  facts: [{ label: 'Speed', value: 'Flying 60 feet' }],
  actions: [],
  features: [],
  equipmentItemIds: [],
  resources: [
    {
      target: {
        kind: 'RESOURCE',
        owner: {
          kind: 'COMPANION_FEATURE',
          chargeId: '00000000-0000-4000-8000-000000000508',
          companionInstanceId: '00000000-0000-4000-8000-000000000501',
          featureId: '00000000-0000-4000-8000-000000000503'
        }
      },
      label: 'Keen Sight',
      remaining: 1,
      maximum: 2,
      recoveries: [{ trigger: 'MANUAL', amount: { kind: 'ALL' } }]
    }
  ],
  numericEditors: [
    {
      kind: 'NUMBER',
      field: 'ARMOR_CLASS_OVERRIDE',
      label: 'Override armor class',
      value: 12,
      adjustmentId,
      commitIntent: 'ON_BLUR_OR_ENTER',
      validation: { integer: true, minimum: 0 }
    },
    {
      kind: 'NUMBER',
      field: 'MAXIMUM_HIT_POINTS_OVERRIDE',
      label: 'Override maximum hit points',
      value: null,
      commitIntent: 'ON_BLUR_OR_ENTER',
      validation: { integer: true, minimum: 0 }
    }
  ],
  selectEditors: [
    {
      kind: 'SELECT',
      field: 'SIZE_OVERRIDE',
      label: 'Override size',
      value: null,
      options: [{ value: 'SMALL', label: 'Small' }],
      commitIntent: 'IMMEDIATE'
    },
    {
      kind: 'SELECT',
      field: 'ALIGNMENT_OVERRIDE',
      label: 'Override alignment',
      value: null,
      options: [{ value: '00000000-0000-4000-8000-000000000504', label: 'Neutral' }],
      commitIntent: 'IMMEDIATE'
    },
    {
      kind: 'SELECT',
      field: 'CREATURE_TYPE_OVERRIDE',
      label: 'Override creature type',
      value: null,
      options: [{ value: '00000000-0000-4000-8000-000000000505', label: 'Beast' }],
      commitIntent: 'IMMEDIATE'
    }
  ],
  textEditors: []
} satisfies CharacterSheetPanelDto

export const vehiclePanelFixture = {
  kind: 'VEHICLE',
  panelId: 'vehicle:00000000-0000-4000-8000-000000000506',
  characterId,
  target: { kind: 'VEHICLE', vehicleInstanceId: '00000000-0000-4000-8000-000000000506' },
  title: 'Sailing Ship',
  state: 'DEFAULT',
  editable: true,
  allowedCommands: ['UPDATE_EXTRA', 'REMOVE_EXTRA'],
  vehicleInstanceId: '00000000-0000-4000-8000-000000000506',
  vehicleId: '00000000-0000-4000-8000-000000000507',
  authoredName: 'Sailing Ship',
  displayName: 'Sailing Ship',
  categoryLabel: 'Water vehicle',
  isActive: true,
  hitPoints: { current: 300, maximum: 300 },
  facts: [],
  actions: [],
  features: [],
  equipmentItemIds: [],
  textEditors: []
} satisfies CharacterSheetPanelDto

export const itemPanelFixture = {
  kind: 'ITEM',
  panelId: 'item:00000000-0000-4000-8000-000000000130',
  characterId,
  target: {
    kind: 'ITEM',
    itemInstanceId: '00000000-0000-4000-8000-000000000130'
  },
  title: 'Moon-Touched Longsword',
  state: 'ADJUSTED',
  editable: true,
  allowedCommands: [
    'UPSERT_ADJUSTMENT',
    'REMOVE_ADJUSTMENT',
    'RESET_ADJUSTMENTS',
    'UPDATE_OWNED_ITEM',
    'REMOVE_OWNED_ITEM',
    'SET_ITEM_EQUIPPED',
    'SET_ITEM_ATTUNED',
    'USE_RESOURCE',
    'RECOVER_RESOURCE'
  ],
  itemInstanceId: '00000000-0000-4000-8000-000000000130',
  equipmentId: '00000000-0000-4000-8000-000000000131',
  authoredName: 'Longsword',
  displayName: 'Moon-Touched Longsword',
  description: 'This longsword sheds moonlight while drawn.',
  facts: [
    { label: 'Category', value: 'Weapon' },
    { label: 'Quantity', value: '1' },
    { label: 'Weight', value: '3 pounds' },
    { label: 'Cost', value: '15 gold pieces' },
    { label: 'Properties', value: 'Versatile' }
  ],
  equippedSlot: 'MAIN_HAND',
  attuned: false,
  requiresAttunement: true,
  numericEditors: [
    {
      kind: 'NUMBER',
      field: 'ATTACK_BONUS',
      label: 'Attack bonus',
      value: 1,
      adjustmentId,
      sourceNote: 'Blessing of the moon',
      commitIntent: 'ON_BLUR_OR_ENTER',
      validation: { integer: true }
    },
    {
      kind: 'NUMBER',
      field: 'ATTACK_OVERRIDE',
      label: 'Attack override',
      value: null,
      commitIntent: 'ON_BLUR_OR_ENTER',
      validation: { integer: true }
    },
    {
      kind: 'NUMBER',
      field: 'DAMAGE_BONUS',
      label: 'Damage bonus',
      value: null,
      commitIntent: 'ON_BLUR_OR_ENTER',
      validation: { integer: true }
    },
    {
      kind: 'NUMBER',
      field: 'COST_OVERRIDE',
      label: 'Cost override',
      value: null,
      commitIntent: 'ON_BLUR_OR_ENTER',
      validation: { integer: true, minimum: 0 }
    },
    {
      kind: 'NUMBER',
      field: 'WEIGHT_OVERRIDE',
      label: 'Weight override',
      value: null,
      commitIntent: 'ON_BLUR_OR_ENTER',
      validation: { integer: false, minimum: 0 }
    }
  ],
  propertyEditors: [
    {
      kind: 'BOOLEAN',
      field: 'SILVERED',
      label: 'Silvered',
      value: false,
      commitIntent: 'IMMEDIATE'
    },
    {
      kind: 'BOOLEAN',
      field: 'ADAMANTINE',
      label: 'Adamantine',
      value: false,
      commitIntent: 'IMMEDIATE'
    },
    {
      kind: 'BOOLEAN',
      field: 'DUAL_WIELD',
      label: 'Dual wield',
      value: false,
      commitIntent: 'IMMEDIATE'
    },
    {
      kind: 'BOOLEAN',
      field: 'DISPLAY_AS_ATTACK',
      label: 'Display in Actions',
      value: true,
      adjustmentId: '00000000-0000-4000-8000-000000000132',
      commitIntent: 'IMMEDIATE'
    }
  ],
  textEditors: [
    {
      kind: 'TEXT',
      field: 'CUSTOM_NAME',
      label: 'Custom name',
      value: 'Moon-Touched Longsword',
      multiline: false,
      maximumLength: 120,
      commitIntent: 'ON_BLUR_OR_ENTER'
    },
    {
      kind: 'TEXT',
      field: 'NOTES',
      label: 'Item notes',
      value: 'Recovered from the old watchtower.',
      multiline: true,
      maximumLength: 2000,
      commitIntent: 'ON_BLUR_OR_ENTER'
    }
  ],
  features: [],
  resources: [
    {
      id: 'item:00000000-0000-4000-8000-000000000130:charge:00000000-0000-4000-8000-000000000133',
      target: {
        kind: 'RESOURCE',
        owner: {
          kind: 'ITEM_INSTANCE',
          chargeId: '00000000-0000-4000-8000-000000000133',
          itemInstanceId: '00000000-0000-4000-8000-000000000130'
        }
      },
      label: 'Moon-Touched Longsword charges',
      remaining: 2,
      maximum: 3,
      recoveries: [{ trigger: 'DAWN', amount: { kind: 'ALL' } }]
    }
  ]
} satisfies CharacterSheetPanelDto

export const astralTearItemPanelFixture = {
  ...itemPanelFixture,
  panelId: `item:${astralTearItemInstanceId}`,
  target: {
    kind: 'ITEM',
    itemInstanceId: astralTearItemInstanceId
  },
  title: 'The Astral Tear Awakened',
  state: 'DEFAULT',
  itemInstanceId: astralTearItemInstanceId,
  equipmentId: astralTearEquipmentId,
  authoredName: 'The Astral Tear Awakened',
  displayName: 'The Astral Tear Awakened',
  description:
    '<p>This mighty blade belongs to the Astral Champion of Vedur. While attuned to it, its wielder can call it to hand from a special demiplane.</p>',
  facts: [
    { label: 'Category', value: 'Weapon' },
    { label: 'Quantity', value: '1' },
    { label: 'Weight', value: '2 pounds' },
    { label: 'Cost', value: '2,000 gold pieces' },
    { label: 'Properties', value: 'Finesse, Light, Vex' }
  ],
  equippedSlot: 'MAIN_HAND',
  attuned: true,
  requiresAttunement: true,
  features: [
    {
      id: 'astral-tear-warping-strike',
      label: 'Warping Strike',
      description:
        '<p>While holding the sword, you can expend 1 of its charges as part of making an attack with it. You can teleport to an unoccupied space you can see within 30 feet either before or after the attack. On a hit, the target also takes 4d6 force damage.</p>',
      resourceGrantId: astralTearResourceId,
      resourceCost: 1
    },
    {
      id: 'astral-tear-spells',
      label: 'Spells',
      description:
        '<p>While holding the sword, you can use an action to expend 1 of its charges to cast a 2nd-level or lower spell without expending a spell slot.</p>',
      resourceGrantId: astralTearResourceId,
      resourceCost: 1
    }
  ],
  resources: [
    {
      id: astralTearResourceId,
      target: {
        kind: 'RESOURCE',
        owner: {
          kind: 'ITEM_INSTANCE',
          chargeId: astralTearChargeId,
          itemInstanceId: astralTearItemInstanceId
        }
      },
      label: 'The Astral Tear Awakened charges',
      remaining: 2,
      maximum: 3,
      recoveries: [{ trigger: 'DAWN', amount: { kind: 'ALL' } }]
    }
  ]
} satisfies CharacterSheetPanelDto
