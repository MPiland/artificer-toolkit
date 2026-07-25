import type { CharacterSheetPanelDto } from '#app/lib/api'

const characterId = '00000000-0000-4000-8000-000000000101'
const systemId = '00000000-0000-4000-8000-000000000102'
const adjustmentId = '00000000-0000-4000-8000-000000000103'
const skillId = '00000000-0000-4000-8000-000000000104'
const passiveSkillId = '00000000-0000-4000-8000-000000000105'
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
      sourceLabel: 'Downtime training',
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
  validation: { integer: true },
  sourceCategory: 'MANUAL' as const
}

export const abilityPanelFixture = {
  kind: 'ABILITY',
  panelId: 'ability:STRENGTH',
  characterId,
  target: { kind: 'ABILITY', ability: 'STRENGTH' },
  title: 'Strength',
  description:
    'Strength measures physical power, bodily force, and the ability to exert muscle.',
  state: 'DEFAULT',
  editable: true,
  allowedCommands: [
    'UPSERT_ADJUSTMENT',
    'REMOVE_ADJUSTMENT',
    'RESET_ADJUSTMENTS'
  ],
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
      sourceLabel: 'Downtime training',
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
      sourceLabel: 'Table ruling',
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
      sourceLabel: 'Table ruling',
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
  allowedCommands: [
    'UPSERT_ADJUSTMENT',
    'REMOVE_ADJUSTMENT',
    'RESET_ADJUSTMENTS'
  ],
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
      value: null,
      sourceCategory: 'MAGIC'
    },
    {
      ...numberEditorDefaults,
      field: 'MISC_BONUS',
      label: 'Miscellaneous bonus',
      value: null,
      sourceCategory: 'MISCELLANEOUS'
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
    commitIntent: 'IMMEDIATE',
    sourceCategory: 'MANUAL'
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
  allowedCommands: [
    'UPSERT_ADJUSTMENT',
    'REMOVE_ADJUSTMENT',
    'RESET_ADJUSTMENTS'
  ],
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
        sourceLabel: 'Library access',
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
          sourceCategory: 'MAGIC',
          sourceLabel: 'Library access'
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
    commitIntent: 'IMMEDIATE',
    sourceCategory: 'MANUAL'
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
  allowedCommands: [
    'UPSERT_ADJUSTMENT',
    'REMOVE_ADJUSTMENT',
    'RESET_ADJUSTMENTS'
  ],
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
  allowedCommands: [
    'UPSERT_ADJUSTMENT',
    'REMOVE_ADJUSTMENT',
    'RESET_ADJUSTMENTS'
  ],
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
  allowedCommands: [
    'UPSERT_ADJUSTMENT',
    'REMOVE_ADJUSTMENT',
    'RESET_ADJUSTMENTS'
  ],
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
