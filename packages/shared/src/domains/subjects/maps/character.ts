import type { ProficiencyScaling } from '#authored'
import {
  ABILITY_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_PROPERTY_OPTIONS,
  SUBJECT,
  type AbilityCode,
  type EquipmentCategoryCode,
  type EquipmentPropertyCode
} from '#core'
import { type NodeMap } from '#util'

export type CharacterNodePayloads = {
  featObtained: { featIds: string[] }
  spellObtained: { spellIds: string[] }
  classLevel: { classIds: string[], min: number, max?: number }
  skillProficiency: { skillIds: string[], level: ProficiencyScaling }
  skillScore: { skillIds: string[], min: number, max?: number }
  abilityScore: { abilities: AbilityCode[], min: number, max?: number }
  savingThrowBonus: { abilities: AbilityCode[], min: number, max?: number }
  level: { min: number, max?: number }
  featureObtained: { featureIds: string[] }
  optionObtained: { featureIds?: string[], optionIds: string[] }
  equipmentPropertyProficiency: {
    category?: EquipmentCategoryCode
    properties: EquipmentPropertyCode[]
    level: ProficiencyScaling
  }
  equipmentProficiency: {
    category?: EquipmentCategoryCode
    equipmentIds: string[]
    level: ProficiencyScaling
  }
  equipmentEquipped: { equipmentIds: string[], quantity: number }
}

export const CHARACTER_NODE_MAP: NodeMap<CharacterNodePayloads> = {
  featObtained: {
    kind: 'BRANCH',
    meta: {
      label: 'Feats Obtained',
      code: 'FEATS_OBTAINED',
      tooltip: 'Feats obtained by the character.'
    },
    payload: 'featObtained',
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'feats'
        },
        selection: 'MULTI_REQUIRED',
        order: 0
      }
    ]
  },
  spellObtained: {
    kind: 'BRANCH',
    meta: {
      label: 'Spells Obtained',
      code: 'SPELLS_OBTAINED',
      tooltip: 'Spells obtained by the character.'
    },
    payload: 'spellObtained',
    options: [
      {
        kind: 'DATA',
        selection: 'MULTI_REQUIRED',
        relationship: {
          kind: 'ROOT',
          table: 'spells'
        },
        order: 0
      }
    ]
  },
  featureObtained: {
    kind: 'BRANCH',
    meta: {
      label: 'Feature Obtained',
      code: 'FEATURES_OBTAINED',
      tooltip: 'Features obtained by the character.'
    },
    payload: 'featureObtained',
    options: [
      {
        kind: 'DATA',
        selection: 'MULTI_REQUIRED',
        relationship: {
          kind: 'ROOT',
          table: 'features'
        },
        order: 0
      }
    ]
  },
  optionObtained: {
    kind: 'BRANCH',
    meta: {
      label: 'Option Obtained',
      code: 'OPTIONS_OBTAINED',
      tooltip: 'Options obtained by the character.'
    },
    payload: 'optionObtained',
    options: [
      {
        kind: 'DATA',
        selection: 'MULTI_REQUIRED',
        relationship: {
          kind: 'ROOT',
          table: 'features'
        },
        order: 0
      },
      {
        kind: 'DATA',
        selection: 'MULTI_REQUIRED',
        relationship: {
          kind: 'ROOT',
          table: 'options'
        },
        order: 1
      }
    ]
  },
  classLevel: {
    kind: 'LEAF',
    meta: {
      label: 'Class Level',
      code: 'CLASS_LEVEL',
      tooltip: 'Class level of the character.'
    },
    payload: 'classLevel',
    options: [
      {
        kind: 'DATA',
        selection: 'MULTI_REQUIRED',
        relationship: {
          kind: 'ROOT',
          table: 'classes'
        },
        order: 0
      }
    ]
  },
  skillProficiency: {
    kind: 'LEAF',
    meta: {
      label: 'Skill Proficiency',
      code: 'SKILL_PROFICIENCY',
      tooltip: 'Skill proficiency of the character.'
    },
    payload: 'skillProficiency',
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'skills'
        },
        order: 0
      }
    ]
  },
  skillScore: {
    kind: 'LEAF',
    meta: {
      label: 'Skill Score',
      code: 'SKILL_SCORE',
      tooltip: 'Skill score of the character.'
    },
    payload: 'skillScore',
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'skills'
        },
        order: 0
      }
    ]
  },
  abilityScore: {
    kind: 'LEAF',
    meta: {
      label: 'Ability Score',
      code: 'ABILITY_SCORE',
      tooltip: 'Ability score of the character.'
    },
    payload: 'abilityScore',
    options: [
      {
        kind: 'INLINE',
        selection: 'MULTI_REQUIRED',
        options: ABILITY_OPTIONS,
        order: 0
      }
    ]
  },
  savingThrowBonus: {
    kind: 'LEAF',
    meta: {
      label: 'Saving Throw Bonus',
      code: 'SAVING_THROW_BONUS',
      tooltip: 'Saving throw bonus of the character.'
    },
    payload: 'savingThrowBonus',
    options: [
      {
        kind: 'INLINE',
        selection: 'MULTI_REQUIRED',
        options: ABILITY_OPTIONS,
        order: 0
      }
    ]
  },
  level: {
    kind: 'LEAF',
    meta: {
      label: 'Level',
      code: 'LEVEL',
      tooltip: 'The character level.'
    },
    payload: 'level'
  },
  equipmentPropertyProficiency: {
    kind: 'LEAF',
    meta: {
      label: 'Equipment Property Proficiency',
      code: 'EQUIPMENT_PROPERTY_PROFICIENCY',
      tooltip: 'Equipment property proficiency of the character.'
    },
    payload: 'equipmentPropertyProficiency',
    options: [
      {
        kind: 'INLINE',
        selection: 'SINGLE_OPTIONAL',
        options: EQUIPMENT_CATEGORY_OPTIONS,
        order: 0
      },
      {
        kind: 'INLINE',
        selection: 'MULTI_REQUIRED',
        options: EQUIPMENT_PROPERTY_OPTIONS,
        order: 1
      }
    ]
  },
  equipmentProficiency: {
    kind: 'LEAF',
    meta: {
      label: 'Equipment Proficiency',
      code: 'EQUIPMENT_PROFICIENCY',
      tooltip: 'Equipment proficiency of the character.'
    },
    payload: 'equipmentProficiency',
    options: [
      {
        kind: 'INLINE',
        selection: 'SINGLE_OPTIONAL',
        options: EQUIPMENT_CATEGORY_OPTIONS,
        order: 0
      },
      {
        kind: 'DATA',
        selection: 'MULTI_REQUIRED',
        relationship: {
          kind: 'ROOT',
          table: 'equipment'
        },
        order: 1
      }
    ]
  },
  equipmentEquipped: {
    kind: 'LEAF',
    meta: {
      label: 'Equipment Equipped',
      code: 'EQUIPMENT_EQUIPPED',
      tooltip: 'Equipment equipped by the character.'
    },
    payload: 'equipmentEquipped',
    options: [
      {
        kind: 'INLINE',
        selection: 'SINGLE_OPTIONAL',
        options: EQUIPMENT_CATEGORY_OPTIONS,
        order: 0
      },
      {
        kind: 'DATA',
        selection: 'MULTI_REQUIRED',
        relationship: {
          kind: 'ROOT',
          table: 'equipment'
        },
        order: 1
      }
    ]
  },
  whileSourceCarried: {
    kind: 'KNOT',
    availableFor: [SUBJECT.EQUIPMENT],
    meta: {
      label: 'While Source Carried',
      code: 'WHILE_SOURCE_CARRIED',
      tooltip: 'While the source is carried.'
    }
  },
  whileSourceEquipped: {
    kind: 'KNOT',
    availableFor: [SUBJECT.EQUIPMENT],
    meta: {
      label: 'While Source Equipped',
      code: 'WHILE_SOURCE_EQUIPPED',
      tooltip: 'While the source is equipped.'
    }
  },
  whileSourceAttuned: {
    kind: 'KNOT',
    availableFor: [SUBJECT.EQUIPMENT],
    meta: {
      label: 'While Source Attuned',
      code: 'WHILE_SOURCE_ATTUNED',
      tooltip: 'While the source is attuned.'
    }
  }
}
