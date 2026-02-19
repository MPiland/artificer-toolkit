import {
  SUBJECT,
  type AbilityCode,
  type EquipmentPropertyCode,
  type ScalingAmountKind,
  type SizeCode,
  type Subject
} from '#types/core'
import type { EngineOption } from '../core.js'

export const RESTRICTION_CODE = {
  /* Levels */
  CHARACTER_LEVEL: 'CHARACTER_LEVEL',
  CLASS_LEVEL: 'CLASS_LEVEL',
  SPELL_LEVEL: 'SPELL_LEVEL',
  SPELL_OBTAINED: 'SPELL_OBTAINED',
  CAN_CAST_SPELL: 'CAN_CAST_SPELL',
  FEATURE_OBTAINED: 'FEATURE_OBTAINED',
  FEAT_OBTAINED: 'FEAT_OBTAINED',
  OPTION_OBTAINED: 'OPTION_OBTAINED',
  EQUIPMENT_PROFICIENCY: 'EQUIPMENT_PROFICIENCY',
  EQUIPMENT_PROPERTY_PROFICIENCY: 'EQUIPMENT_PROPERTY_PROFICIENCY',
  EQUIPMENT_EQUIPPED: 'EQUIPMENT_EQUIPPED',
  SKILL_PROFICIENCY: 'SKILL_PROFICIENCY',
  SKILL_SCORE: 'SKILL_SCORE',
  ABILITY_SCORE: 'ABILITY_SCORE',
  SIZE: 'SIZE',
  BACKGROUND: 'BACKGROUND',
  RACE: 'RACE',
  CLASS: 'CLASS',

  /* Applicability */
  WHILE_SOURCE_CARRIED: 'WHILE_SOURCE_CARRIED',
  WHILE_SOURCE_EQUIPPED: 'WHILE_SOURCE_EQUIPPED',
  WHILE_SOURCE_ATTUNED: 'WHILE_SOURCE_ATTUNED'
} as const

export type RestrictionCode = keyof typeof RESTRICTION_CODE

export type RestrictionStateOption = EngineOption<keyof typeof RESTRICTION_CODE>

export const RESTRICTION_CODE_REGISTRY: Record<
  keyof typeof RESTRICTION_CODE,
  RestrictionStateOption
> = {
  CHARACTER_LEVEL: {
    code: RESTRICTION_CODE.CHARACTER_LEVEL,
    label: 'Character Level',
    tooltip: 'Requires a minimum or maximum total character level.',
    description: 'Counts all class levels combined.'
  },

  FEATURE_OBTAINED: {
    code: RESTRICTION_CODE.FEATURE_OBTAINED,
    label: 'Feature Obtained',
    tooltip: 'Requires a feature to already be obtained.',
    description: 'Used for dependent or upgraded features.'
  },

  OPTION_OBTAINED: {
    code: RESTRICTION_CODE.OPTION_OBTAINED,
    label: 'Option Obtained',
    tooltip: 'Requires a specific option selection.',
    description: 'Used for branching feature paths.'
  },

  SPELL_OBTAINED: {
    code: RESTRICTION_CODE.SPELL_OBTAINED,
    label: 'Spell Obtained',
    tooltip: 'Requires access to a specific spell.',
    description: 'Used for spell synergies or upgrades.'
  },

  CAN_CAST_SPELL: {
    code: RESTRICTION_CODE.CAN_CAST_SPELL,
    label: 'Can Cast Spells',
    tooltip: 'Requires spellcasting capability.',
    description: 'Does not imply knowing any specific spell.'
  },

  SKILL_PROFICIENCY: {
    code: RESTRICTION_CODE.SKILL_PROFICIENCY,
    label: 'Skill Proficiency',
    tooltip: 'Requires proficiency in one or more skills.',
    description: 'Does not require expertise unless specified.'
  },

  SKILL_SCORE: {
    code: RESTRICTION_CODE.SKILL_SCORE,
    label: 'Skill Score',
    tooltip: 'Requires a minimum or maximum skill bonus.',
    description: 'Includes proficiency and other modifiers.'
  },

  ABILITY_SCORE: {
    code: RESTRICTION_CODE.ABILITY_SCORE,
    label: 'Ability Score',
    tooltip: 'Requires a minimum or maximum ability score.',
    description: 'For example: Strength 13 or higher.'
  },

  EQUIPMENT_PROFICIENCY: {
    code: RESTRICTION_CODE.EQUIPMENT_PROFICIENCY,
    label: 'Equipment Proficiency',
    tooltip: 'Requires proficiency with specific equipment.',
    description: 'Checks proficiency against one or more equipment IDs.'
  },

  EQUIPMENT_PROPERTY_PROFICIENCY: {
    code: RESTRICTION_CODE.EQUIPMENT_PROPERTY_PROFICIENCY,
    label: 'Equipment Property Proficiency',
    tooltip: 'Requires proficiency with equipment that has certain properties.',
    description:
      'For example: must be proficient with Heavy weapons or Martial weapons.'
  },

  EQUIPMENT_EQUIPPED: {
    code: RESTRICTION_CODE.EQUIPMENT_EQUIPPED,
    label: 'Equipment Equipped',
    tooltip: 'Requires specific equipment to be equipped.',
    description: 'Evaluated dynamically at runtime.'
  },

  WHILE_SOURCE_CARRIED: {
    code: RESTRICTION_CODE.WHILE_SOURCE_CARRIED,
    label: 'While Carried',
    tooltip: 'Applies while the item is carried by the character.',
    description:
      'The modifier applies as long as the item is in the character\'s possession, even if it is not equipped or attuned.'
  },

  WHILE_SOURCE_EQUIPPED: {
    code: RESTRICTION_CODE.WHILE_SOURCE_EQUIPPED,
    label: 'While Equipped',
    tooltip: 'Applies only while the item is equipped.',
    description:
      'The modifier applies only when the item is actively equipped or worn. This is the default behavior for most equipment.'
  },

  WHILE_SOURCE_ATTUNED: {
    code: RESTRICTION_CODE.WHILE_SOURCE_ATTUNED,
    label: 'While Attuned',
    tooltip: 'Applies only while the item is attuned.',
    description:
      'The modifier applies only when the character is attuned to the item. Attunement is required in addition to equipping the item.'
  },

  SIZE: {
    code: RESTRICTION_CODE.SIZE,
    label: 'Size',
    tooltip: 'Requires a specific size.',
    description: 'Used for size-based restrictions.'
  },

  CLASS_LEVEL: {
    code: RESTRICTION_CODE.CLASS_LEVEL,
    label: 'Class Level',
    tooltip: 'Requires a minimum or maximum class level.',
    description: 'Counts all class levels combined.'
  },

  SPELL_LEVEL: {
    code: RESTRICTION_CODE.SPELL_LEVEL,
    label: 'Spell Level',
    tooltip: 'Requires a minimum or maximum spell level.',
    description: 'Counts all spell levels combined.'
  },

  FEAT_OBTAINED: {
    code: RESTRICTION_CODE.FEAT_OBTAINED,
    label: 'Feat Obtained',
    tooltip: 'Requires a feat to already be obtained.',
    description: 'Used for dependent or upgraded feats.'
  },

  BACKGROUND: {
    code: RESTRICTION_CODE.BACKGROUND,
    label: 'Background',
    tooltip: 'Background selected by character.',
    description: 'Used for dependent or upgraded backgrounds.'
  },

  CLASS: {
    code: RESTRICTION_CODE.CLASS,
    label: 'Class',
    tooltip: 'Requires a class to already be obtained.',
    description: 'Used for dependent or upgraded classes.'
  },

  RACE: {
    code: RESTRICTION_CODE.RACE,
    label: 'Race',
    tooltip: 'Requires a race to already be obtained.',
    description: 'Used for dependent or upgraded races.'
  }
} as const

export type RestrictionPayloadByCode = {
  CHARACTER_LEVEL: {
    min: number
    max?: number
  }
  CLASS_LEVEL: {
    classIds: string[]
    min: number
    max?: number
  }
  ABILITY_SCORE: {
    abilities: AbilityCode[]
    min: number
    max?: number
  }
  SKILL_SCORE: {
    skillIds: string[]
    min: number
    max?: number
  }
  SKILL_PROFICIENCY: {
    skillIds: string[]
    proficiencyLevel: ScalingAmountKind
  }
  FEATURE_OBTAINED: {
    featureIds: string[]
  }
  OPTION_OBTAINED: {
    optionIds: string[]
  }
  SPELL_OBTAINED: {
    spellIds: string[]
  }
  EQUIPMENT_PROFICIENCY: {
    equipmentIds: string[]
    proficiencyLevel: ScalingAmountKind
  }
  EQUIPMENT_PROPERTY_PROFICIENCY: {
    properties: EquipmentPropertyCode
    proficiencyLevel: ScalingAmountKind
  }
  SIZE: {
    sizes: SizeCode[]
  }
  RACE: {
    raceIds: string[]
  }
  BACKGROUND: {
    backgroundIds: string[]
  }
  CLASS: {
    classIds: string[]
  }
  FEAT_OBTAINED: {
    featIds: string[]
  }
  SPELL_LEVEL: {
    spellIds: string[]
    min: number
    max?: number
  }
  EQUIPMENT_EQUIPPED: { equipmentIds: string[] }
  WHILE_SOURCE_EQUIPPED: never
  WHILE_SOURCE_ATTUNED: never
  WHILE_SOURCE_CARRIED: never
  CAN_CAST_SPELL: never
}

export type RestrictionPayload<R extends RestrictionCode> = RestrictionPayloadByCode[R]

export const RESTRICTION_META: Record<RestrictionCode, { allowedSubjects?: Subject[] }> = {
  CHARACTER_LEVEL: {},
  CLASS_LEVEL: {},
  RACE: {},
  CLASS: {},
  FEAT_OBTAINED: {},
  BACKGROUND: {},
  ABILITY_SCORE: {},
  SKILL_SCORE: {},
  SKILL_PROFICIENCY: {},
  FEATURE_OBTAINED: {},
  OPTION_OBTAINED: {},
  SPELL_OBTAINED: {},
  EQUIPMENT_PROFICIENCY: {},
  EQUIPMENT_PROPERTY_PROFICIENCY: {},
  SIZE: {},
  EQUIPMENT_EQUIPPED: {},
  CAN_CAST_SPELL: {},
  SPELL_LEVEL: {},

  WHILE_SOURCE_EQUIPPED: {
    allowedSubjects: [SUBJECT.EQUIPMENT]
  },
  WHILE_SOURCE_ATTUNED: {
    allowedSubjects: [SUBJECT.EQUIPMENT]
  },
  WHILE_SOURCE_CARRIED: {
    allowedSubjects: [SUBJECT.EQUIPMENT]
  }
}
