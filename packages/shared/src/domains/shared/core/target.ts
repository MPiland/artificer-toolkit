import type { AbilityCode, ChargeLimitKind, ChargeResetKind, CoreMeta, DurationKind, EquipmentCategoryCode, EquipmentPropertyCode, MeasurementUnitCode, RangeKind, ScalingAmountKind } from '#core'
import { type Selectable } from '#util'
import type { EmptyObject } from 'type-fest'

export const SCOPE_KIND = {
  FILTER: 'FILTER',
  RESTRICTION: 'RESTRICTION'
} as const

export type ScopeKind = keyof typeof SCOPE_KIND

export type ScopeKindOption = CoreMeta<ScopeKind>

export const SCOPE_KIND_REGISTRY: Record<ScopeKind, ScopeKindOption> = {
  FILTER: {
    code: SCOPE_KIND.FILTER,
    label: 'Filter',
    tooltip: 'Filters what is applicable.',
    description:
      'Filters out the applicable options or grants that the character receives or chooses.'
  },

  RESTRICTION: {
    code: SCOPE_KIND.RESTRICTION,
    label: 'Restriction',
    tooltip: 'Restricts applicability.',
    description:
      'Narrows selection to specific conditions of the character state.'
  }
}

export const SCOPE_KIND_OPTIONS = Object.values(
  SCOPE_KIND_REGISTRY
) as ScopeKindOption[]

export const SCOPE = {
  ATTRIBUTE: 'ATTRIBUTE',
  EFFECTS: 'EFFECTS',
  SUBCLASS: 'SUBCLASS',
  SUBCLASS_SUBTYPE: 'SUBCLASS_SUBTYPE',
  RESOURCE: 'RESOURCE',
  SPELLCASTING: 'SPELLCASTING',
  SUBRACE: 'SUBRACE',
  RACE_ANCESTRY_OPTION: 'RACE_ANCESTRY_OPTION',
  RANGE: 'RANGE',
  DURATION: 'DURATION',
  CONCENTRATION: 'CONCENTRATION',
  RITUAL: 'RITUAL',
  SIZE: 'SIZE',
  FEATURE: 'FEATURE',
  OPTION: 'OPTION',
  FEATURE_OBTAINED: 'FEATURE_OBTAINED',
  OPTION_OBTAINED: 'OPTION_OBTAINED',
  MAGIC_SCHOOL: 'MAGIC_SCHOOL',
  SPELL_LEVEL: 'SPELL_LEVEL',
  SPELLCASTING_ABILITY: 'SPELLCASTING_ABILITY',
  SAVING_THROW_ABILITY: 'SAVING_THROW_ABILITY',
  SAVING_THROW_DC: 'SAVING_THROW_DC',
  EQUIPMENT_CATEGORY: 'EQUIPMENT_CATEGORY',
  EQUIPMENT_PROPERTY: 'EQUIPMENT_PROPERTY',
  EQUIPMENT_PROFICIENCY: 'EQUIPMENT_PROFICIENCY',
  EQUIPMENT_PROPERTY_PROFICIENCY: 'EQUIPMENT_PROPERTY_PROFICIENCY',
  EQUIPMENT_EQUIPPED: 'EQUIPMENT_EQUIPPED',
  ARMOR_CLASS: 'ARMOR_CLASS',
  DAMAGE_TYPE: 'DAMAGE_TYPE',
  CONDITION_TYPE: 'CONDITION_TYPE',
  LIMITED_USE: 'LIMITED_USE',
  CHARGE_LIMIT_KIND: 'CHARGE_LIMIT_KIND',
  CHARGE_RESET_KIND: 'CHARGE_RESET_KIND',
  CAN_CAST_SPELL: 'CAN_CAST_SPELL',
  CHARACTER_LEVEL: 'CHARACTER_LEVEL',
  CLASS_LEVEL: 'CLASS_LEVEL',
  SPELL_OBTAINED: 'SPELL_OBTAINED',
  FEAT_OBTAINED: 'FEAT_OBTAINED',
  SKILL_PROFICIENCY: 'SKILL_PROFICIENCY',
  SKILL_SCORE: 'SKILL_SCORE',
  ABILITY_SCORE: 'ABILITY_SCORE',
  SAVING_THROW_ABILITY_BONUS: 'SAVING_THROW_ABILITY_BONUS',
  WHILE_SOURCE_CARRIED: 'WHILE_SOURCE_CARRIED',
  WHILE_SOURCE_EQUIPPED: 'WHILE_SOURCE_EQUIPPED',
  WHILE_SOURCE_ATTUNED: 'WHILE_SOURCE_ATTUNED'
} as const

export type ScopeCode = keyof typeof SCOPE

export type ScopeOption = CoreMeta<ScopeCode> & { allowedScopeKinds: ScopeKind[] }

export const SCOPE_REGISTRY: Record<ScopeCode, ScopeOption> = {
  ATTRIBUTE: {
    code: 'ATTRIBUTE',
    label: 'Attribute',
    tooltip: 'Narrows to selection to specific attribute(s)',
    description: 'Narrows to selection to specific attribute(s) such as spellcasting or concentration',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  SUBCLASS: {
    code: 'SUBCLASS',
    label: 'Subclass',
    tooltip: 'Narrows to a subclass.',
    description:
      'Restricts availability to characters who have selected a specific subclass for their class.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  SUBCLASS_SUBTYPE: {
    code: 'SUBCLASS_SUBTYPE',
    label: 'Subclass Subtype',
    tooltip: 'Narrows selection to subclass-defined option choice.',
    description:
      'Used for subclass sub-selections such as Druid Circle of the Land terrain.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  RESOURCE: {
    code: 'RESOURCE',
    label: 'Resource',
    tooltip: 'Narrows to a class resource.',
    description:
      'Narrows applicability to a specific resource of a class such as Ki or Inspiration Dice.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  SPELLCASTING: {
    code: 'SPELLCASTING',
    label: 'Spellcasting',
    tooltip: 'Narrows to spellcasting classes.',
    description:
      'Narrows applicability to classes that have the spellcasting ability.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  SUBRACE: {
    code: 'SUBRACE',
    label: 'Subrace',
    tooltip: 'Narrows to a subrace.',
    description:
      'Narrows selections to a specific subrace within a race.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  RACE_ANCESTRY_OPTION: {
    code: 'RACE_ANCESTRY_OPTION',
    label: 'Ancestry Option',
    tooltip: 'Narrows selection to ancestry option(s).',
    description:
      'Narrows one or more specific options within an ancestry, such as Red or Blue for Draconic Ancestry.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  RANGE: {
    code: 'RANGE',
    label: 'Range',
    tooltip: 'Narrows selection to range(s).',
    description:
      'Narrows the selection path to a specific range or ranges.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  EFFECTS: {
    code: 'EFFECTS',
    label: 'Effects',
    tooltip: 'Narrows selection to effect properties.',
    description:
      'Narrows the selection path  to effect properties such as damage type, condition type, range, and duration.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  DURATION: {
    code: 'DURATION',
    label: 'Duration',
    tooltip: 'Narrows selection to duration(s).',
    description:
      'Narrows the selection path to a specific duration or durations.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  CONCENTRATION: {
    code: 'CONCENTRATION',
    label: 'Concentration',
    tooltip: 'Narrows selection to spells with concentration',
    description: 'Narrows selections to spells that require the character to concentrate while casting.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  RITUAL: {
    code: 'RITUAL',
    label: 'Ritual',
    tooltip: 'Narrows selection to ritual spells',
    description: 'Narrows selections to spells that can be cast as rituals.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  SIZE: {
    code: 'SIZE',
    label: 'Size',
    tooltip: 'Narrows selection to creature size(s).',
    description: 'Such as Small, Medium, or Large.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  FEATURE: {
    code: 'FEATURE',
    label: 'Feature',
    tooltip: 'Narrows selection to feature(s).',
    description:
      'Narrows selection to one or more specific features. This can be used to target class features, racial attributes, feat features, or other authored features.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  OPTION: {
    code: 'OPTION',
    label: 'Feature Option',
    tooltip: 'Narrows selection to feature option.',
    description:
      'Narrows selection to one or more specific feature options, such as Fighting Style selections, invocation choices, or other option-based feature branches.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  MAGIC_SCHOOL: {
    code: 'MAGIC_SCHOOL',
    label: 'Magic School',
    tooltip: 'Narrows selection to spell school.',
    description:
      'Narrows selection to spells belonging to a specific magic school, such as Evocation, Illusion, or Necromancy.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  SPELLCASTING_ABILITY: {
    code: 'SPELLCASTING_ABILITY',
    label: 'Spellcasting ability',
    tooltip: 'Narrows selection to spellcastinga abilities.',
    description:
      'Narrows selection to classes that can cast spells based on their spellcasting ability.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  SPELL_LEVEL: {
    code: 'SPELL_LEVEL',
    label: 'Spell Level',
    tooltip: 'Narrows selection to spell level.',
    description:
      'Narrows selection to spells of a specific level (0–9), such as only cantrips or only 3rd-level spells.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  SAVING_THROW_ABILITY: {
    code: 'SAVING_THROW_ABILITY',
    label: 'Saving Throw Ability',
    tooltip: 'Narrows selection to saving throw ability.',
    description:
      'Narrows selection to spells or effects that require a saving throw using specific abilities, such as Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  SAVING_THROW_DC: {
    code: 'SAVING_THROW_DC',
    label: 'Saving Throw DC',
    tooltip: 'Narrows selection to saving throw DC.',
    description:
      'Narrows selection to spells or effects that require a saving throw with a specific DC.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  EQUIPMENT_CATEGORY: {
    code: 'EQUIPMENT_CATEGORY',
    label: 'Category',
    tooltip: 'Narrows selection to category.',
    description:
      'Narrows selection to items of a specific category, such as Weapon, Armor, Tool, Shield, or Adventuring Gear.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  EQUIPMENT_PROPERTY: {
    code: 'EQUIPMENT_PROPERTY',
    label: 'Property',
    tooltip: 'Narrows selection to property.',
    description:
      'Narrows selection to entities with specific properties, such as weapon properties (Finesse, Heavy, Light) or item-specific attributes.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  ARMOR_CLASS: {
    code: 'ARMOR_CLASS',
    label: 'Armor Class',
    tooltip: 'Narrows selection to armor class within a range.',
    description: 'Narrows selection to equipment that falls within a value range.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  DAMAGE_TYPE: {
    code: 'DAMAGE_TYPE',
    label: 'Damage Type',
    tooltip: 'Narrows selection to damage type.',
    description:
      'Narrows selection to entities that deal or reference a specific damage type, such as Fire, Cold, Slashing, or Radiant.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  CONDITION_TYPE: {
    code: 'CONDITION_TYPE',
    label: 'Condition',
    tooltip: 'Narrows selection to condition type.',
    description:
      'Narrows selection to effects, spells, or features that apply or reference one or more specific conditions, such as Blinded, Charmed, Frightened, or Poisoned.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  CHARGE_LIMIT_KIND: {
    code: 'CHARGE_LIMIT_KIND',
    label: 'Charge Limit',
    tooltip: 'Narrows selection to charge limit kind.',
    description:
      'Narrows selection to a specific charge limit kind, such as Ki, Rage, Channel Divinity, or a feature-specific resource.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  LIMITED_USE: {
    code: 'LIMITED_USE',
    label: 'Limited Use',
    tooltip: 'Narrows selection to targets that have a limited use.',
    description:
      'Narrows selection to targets that have a limited use.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  CHARGE_RESET_KIND: {
    code: 'CHARGE_RESET_KIND',
    label: 'Charge Reset',
    tooltip: 'Narrows selection to charge reset type.',
    description:
      'Narrows selection to charge pools that reset on a specific condition, such as Short Rest, Long Rest, Dawn, or Custom resets.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  CAN_CAST_SPELL: {
    code: 'CAN_CAST_SPELL',
    label: 'Can Cast Spells',
    tooltip: 'Requires spellcasting capability.',
    description: 'Does not imply knowing any specific spell.',
    allowedScopeKinds: ['RESTRICTION']
  },

  CHARACTER_LEVEL: {
    code: 'CHARACTER_LEVEL',
    label: 'Character Level',
    tooltip: 'Requires a minimum or maximum total character level.',
    description: 'Counts all class levels combined.',
    allowedScopeKinds: ['RESTRICTION']
  },

  CLASS_LEVEL: {
    code: 'CLASS_LEVEL',
    label: 'Class Level',
    tooltip: 'Requires a minimum or maximum class level.',
    description: 'Counts all class levels combined.',
    allowedScopeKinds: ['RESTRICTION']
  },

  SPELL_OBTAINED: {
    code: 'SPELL_OBTAINED',
    label: 'Spell Obtained',
    tooltip: 'Requires access to a specific spell.',
    description: 'Used for spell synergies or upgrades.',
    allowedScopeKinds: ['RESTRICTION']
  },

  FEAT_OBTAINED: {
    code: 'FEAT_OBTAINED',
    label: 'Feat Obtained',
    tooltip: 'Requires a feat to already be obtained.',
    description: 'Used for dependent or upgraded feats.',
    allowedScopeKinds: ['RESTRICTION']
  },

  FEATURE_OBTAINED: {
    code: 'FEATURE_OBTAINED',
    label: 'Feature Obtained',
    tooltip: 'Requires a feature to already be obtained.',
    description: 'Used for dependent or upgraded features.',
    allowedScopeKinds: ['RESTRICTION']
  },

  OPTION_OBTAINED: {
    code: 'OPTION_OBTAINED',
    label: 'Feature Option Obtained',
    tooltip: 'Narrows selection to feature option selection.',
    description: 'Used for branching feature paths.',
    allowedScopeKinds: ['RESTRICTION']
  },

  EQUIPMENT_PROFICIENCY: {
    code: 'EQUIPMENT_PROFICIENCY',
    label: 'Equipment Proficiency',
    tooltip: 'Requires proficiency with specific equipment.',
    description: 'Checks proficiency against one or more equipment IDs.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  EQUIPMENT_PROPERTY_PROFICIENCY: {
    code: 'EQUIPMENT_PROPERTY_PROFICIENCY',
    label: 'Equipment Property Proficiency',
    tooltip: 'Requires proficiency with equipment that has certain properties.',
    description:
      'For example: must be proficient with Heavy weapons or Martial weapons.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  EQUIPMENT_EQUIPPED: {
    code: 'EQUIPMENT_EQUIPPED',
    label: 'Equipment Equipped',
    tooltip: 'Requires specific equipment to be equipped.',
    description: 'Evaluated dynamically at runtime.',
    allowedScopeKinds: ['RESTRICTION']
  },

  SKILL_PROFICIENCY: {
    code: 'SKILL_PROFICIENCY',
    label: 'Skill Proficiency',
    tooltip: 'Requires proficiency in one or more skills.',
    description: 'Does not require expertise unless specified.',
    allowedScopeKinds: ['FILTER', 'RESTRICTION']
  },

  SKILL_SCORE: {
    code: 'SKILL_SCORE',
    label: 'Skill Score',
    tooltip: 'Requires a minimum or maximum skill bonus.',
    description: 'Includes proficiency and other modifiers.',
    allowedScopeKinds: ['RESTRICTION']
  },

  ABILITY_SCORE: {
    code: 'ABILITY_SCORE',
    label: 'Ability Score',
    tooltip: 'Requires a minimum or maximum ability score.',
    description: 'For example: Strength 13 or higher.',
    allowedScopeKinds: ['RESTRICTION']
  },

  SAVING_THROW_ABILITY_BONUS: {
    code: 'SAVING_THROW_ABILITY_BONUS',
    label: 'Saving Throw Ability Bonus',
    tooltip: 'Ability bonus score of the character.',
    description: 'Limits the targeting to the character\'s ability bonus score.',
    allowedScopeKinds: ['RESTRICTION']
  },

  WHILE_SOURCE_CARRIED: {
    code: 'WHILE_SOURCE_CARRIED',
    label: 'While Carried',
    tooltip: 'Applies while the item is carried by the character.',
    description:
      'The modifier applies as long as the item is in the character\'s possession, even if it is not equipped or attuned.',
    allowedScopeKinds: ['RESTRICTION']
  },

  WHILE_SOURCE_EQUIPPED: {
    code: 'WHILE_SOURCE_EQUIPPED',
    label: 'While Equipped',
    tooltip: 'Applies only while the item is equipped.',
    description:
      'The modifier applies only when the item is actively equipped or worn. This is the default behavior for most equipment.',
    allowedScopeKinds: ['RESTRICTION']
  },

  WHILE_SOURCE_ATTUNED: {
    code: 'WHILE_SOURCE_ATTUNED',
    label: 'While Attuned',
    tooltip: 'Applies only while the item is attuned.',
    description:
      'The modifier applies only when the character is attuned to the item. Attunement is required in addition to equipping the item.',
    allowedScopeKinds: ['RESTRICTION']
  }
} as const

export const SCOPE_OPTIONS = Object.values(SCOPE_REGISTRY) as ScopeOption[]

export type SubjectPayload = {
  CLASS: Selectable<{ classIds: string[] }>
  RACE: Selectable<{ raceIds: string[] }>
  EQUIPMENT: Selectable<{ equipmentIds: string[] }>
  SPELL: Selectable<{ sellIds: string[] }>
  BACKGROUND: Selectable<{ backgroundIds: string[] }>
  FEAT: Selectable<{ featIds: string[] }>
  CHARACTER: EmptyObject
}

export type ScopePayload = {
  ATTRIBUTE: EmptyObject

  EFFECTS: EmptyObject

  SUBCLASS: Selectable<
    { subclassIds: string[] },
    { classIds?: string[] }
  >

  SUBCLASS_SUBTYPE: Selectable<
    { subtypeIds: string[] }
  >

  RESOURCE: Selectable<
    { resourceIds: string[] }
  >

  SPELLCASTING: EmptyObject

  SUBRACE: Selectable<
    { subraceIds: string[] }
  >

  RACE_ANCESTRY_OPTION: Selectable<
    { ancestryOptionIds: string[] }
  >

  RANGE:
    | Selectable<{ rangeKind: Exclude<RangeKind, 'DISTANCE'> }>
    | Selectable<
      { rangeKind: Extract<RangeKind, 'DISTANCE'> },
      {
        min: number
        max?: number
        unit: MeasurementUnitCode
      }
    >

  DURATION:
    | {
      durationKind: Extract<DurationKind, 'INSTANTANEOUS'>
    }
    | {
      durationKind: Exclude<DurationKind, 'INSTANTANEOUS'>
      min: number
      max?: number
    }

  CONCENTRATION: EmptyObject

  RITUAL: EmptyObject

  SIZE: Selectable<
    { sizeIds: string[] }
  >

  FEATURE: Selectable<
    { featureIds: string[] }
  >

  OPTION: Selectable<
    { optionIds: string[] }
  >

  FEATURE_OBTAINED: {
    featureIds: string[]
  }

  OPTION_OBTAINED: Selectable<{
    optionIds: string[]
  }>

  MAGIC_SCHOOL: {
    magicSchoolIds: string[]
  }

  SPELLCASTING_ABILITY: Selectable<
    { abilities: AbilityCode }
  >

  SPELL_LEVEL: {
    min: number
    max?: number
  }

  SAVING_THROW_ABILITY: Selectable<
    { abilities: AbilityCode }
  >

  SAVING_THROW_DC: {
    min: number
    max?: number
  }

  EQUIPMENT_CATEGORY: {
    category: EquipmentCategoryCode
  }

  EQUIPMENT_PROPERTY: {
    category?: EquipmentCategoryCode
    properties: EquipmentPropertyCode[]
  }

  EQUIPMENT_PROFICIENCY: Selectable<
    { equipmentIds: string[] },
    {
      category?: EquipmentCategoryCode
      properties?: EquipmentPropertyCode[]
      level: ScalingAmountKind
    }
  >

  EQUIPMENT_PROPERTY_PROFICIENCY: Selectable<
    { properties: EquipmentPropertyCode[] },
    {
      category?: EquipmentCategoryCode
    }
  >

  EQUIPMENT_EQUIPPED: Selectable<
    { equipmentIds: string[] },
    {
      category?: EquipmentCategoryCode
      properties?: EquipmentPropertyCode[]
    }
  >

  ARMOR_CLASS: {
    min: number
    max?: number
  }

  DAMAGE_TYPE: Selectable<
    { damageTypeIds: string[] }
  >

  CONDITION_TYPE: Selectable<
    { conditionTypeIds: string[] }
  >

  LIMITED_USE: EmptyObject

  CHARGE_LIMIT_KIND: Selectable<
    { chargeLimitKind: ChargeLimitKind }
  >

  CHARGE_RESET_KIND: Selectable<
    { chargeResetKind: ChargeResetKind }
  >

  CAN_CAST_SPELL: EmptyObject

  CHARACTER_LEVEL: {
    min: number
    max?: number
  }

  CLASS_LEVEL: {
    min: number
    max?: number
  }

  SPELL_OBTAINED: {
    spellIds: string[]
  }

  FEAT_OBTAINED: {
    featIds: string[]
  }

  SKILL_PROFICIENCY: Selectable<
    { skillIds: string[] },
    { level: ScalingAmountKind }
  >

  SKILL_SCORE: Selectable<
    { skillIds: string[] }
  >

  ABILITY_SCORE: Selectable<
    { abilities: AbilityCode }
  >

  SAVING_THROW_ABILITY_BONUS: Selectable<
    { abilities: AbilityCode },
    { min: number, max?: number }
  >

  WHILE_SOURCE_CARRIED: EmptyObject

  WHILE_SOURCE_EQUIPPED: EmptyObject

  WHILE_SOURCE_ATTUNED: EmptyObject
}

export type ScopeDependencyMap = {
  ATTRIBUTE:
    | 'CLASS'
    | 'SPELL'
    | 'EQUIPMENT'
    | 'FEATURE'
    | 'FEAT'
    | 'OPTION'

  EFFECTS:
    | 'FEATURE'
    | 'EQUIPMENT'
    | 'FEAT'
    | 'OPTION'
    | 'SPELL'

  SUBCLASS: 'CLASS'

  SUBCLASS_SUBTYPE: 'SUBCLASS'

  RESOURCE: 'ATTRIBUTE'

  SPELLCASTING: 'ATTRIBUTE'

  SUBRACE: 'RACE'

  RACE_ANCESTRY_OPTION: 'RACE'

  RANGE: 'EFFECTS'

  DURATION: 'EFFECTS'

  CONCENTRATION: 'ATTRIBUTE'

  RITUAL: 'ATTRIBUTE'

  SIZE: 'RACE'

  FEATURE:
    | 'CLASS'
    | 'SUBCLASS'
    | 'RACE'
    | 'SUBRACE'
    | 'RACE_ANCESTRY_OPTION'

  OPTION: 'FEATURE'

  FEATURE_OBTAINED: 'CHARACTER'

  OPTION_OBTAINED: 'CHARACTER'

  MAGIC_SCHOOL: 'SPELL'

  SPELLCASTING_ABILITY: 'CLASS'

  SPELL_LEVEL: 'SPELL'

  SAVING_THROW_ABILITY: 'CHARACTER'

  SAVING_THROW_DC: 'SPELL'

  EQUIPMENT_CATEGORY: 'EQUIPMENT'

  EQUIPMENT_PROPERTY: 'EQUIPMENT'

  EQUIPMENT_PROFICIENCY:
    | 'CLASS'
    | 'BACKGROUND'
    | 'CHARACTER'
    | 'RACE'

  EQUIPMENT_PROPERTY_PROFICIENCY:
    | 'CLASS'
    | 'BACKGROUND'
    | 'CHARACTER'
    | 'RACE'

  EQUIPMENT_EQUIPPED: 'CHARACTER'

  ARMOR_CLASS: 'EQUIPMENT'

  DAMAGE_TYPE: 'EFFECTS'

  CONDITION_TYPE: 'EFFECTS'

  LIMITED_USE: 'ATTRIBUTE'

  CHARGE_LIMIT_KIND: 'LIMITED_USE'

  CHARGE_RESET_KIND: 'LIMITED_USE'

  CAN_CAST_SPELL: 'CHARACTER'

  CHARACTER_LEVEL: 'CHARACTER'

  CLASS_LEVEL: 'CLASS'

  SPELL_OBTAINED: 'SPELL'

  FEAT_OBTAINED: 'CHARACTER'

  SKILL_PROFICIENCY: 'CHARACTER'

  SKILL_SCORE: 'CHARACTER'

  ABILITY_SCORE: 'CHARACTER'

  SAVING_THROW_ABILITY_BONUS: 'CHARACTER'

  WHILE_SOURCE_CARRIED: 'CHARACTER'

  WHILE_SOURCE_EQUIPPED: 'CHARACTER'

  WHILE_SOURCE_ATTUNED: 'CHARACTER'
}

export type SubjectAllowedScopes = {
  CHARACTER: readonly ScopeCode[]
  CLASS: readonly ScopeCode[]
  SPELL: readonly ScopeCode[]
  EQUIPMENT: readonly ScopeCode[]
  FEAT: readonly ScopeCode[]
  BACKGROUND: readonly ScopeCode[]
  RACE: readonly ScopeCode[]
}

export const SUBJECT_ALLOWED_SCOPES: SubjectAllowedScopes = {
  CHARACTER: [
    'CHARACTER_LEVEL',
    'SPELL_OBTAINED',
    'FEAT_OBTAINED',
    'FEATURE_OBTAINED',
    'EQUIPMENT_PROFICIENCY',
    'EQUIPMENT_PROPERTY_PROFICIENCY',
    'SKILL_PROFICIENCY',
    'SKILL_SCORE',
    'ABILITY_SCORE',
    'WHILE_SOURCE_CARRIED',
    'WHILE_SOURCE_EQUIPPED',
    'WHILE_SOURCE_ATTUNED',
    'CAN_CAST_SPELL'
  ],

  CLASS: [
    'ATTRIBUTE',
    'CLASS_LEVEL',
    'SUBCLASS',
    'FEATURE',
    'SKILL_PROFICIENCY',
    'EQUIPMENT_PROFICIENCY',
    'EQUIPMENT_PROPERTY_PROFICIENCY'
  ],

  SPELL: [
    'ATTRIBUTE',
    'SPELL_LEVEL',
    'MAGIC_SCHOOL',
    'SAVING_THROW_ABILITY',
    'SAVING_THROW_DC',
    'EFFECTS'
  ],

  EQUIPMENT: [
    'ATTRIBUTE',
    'EQUIPMENT_CATEGORY',
    'EQUIPMENT_PROPERTY',
    'ARMOR_CLASS',
    'SAVING_THROW_DC',
    'FEATURE',
    'EFFECTS'
  ],

  FEAT: [
    'ATTRIBUTE',
    'EFFECTS',
    'LIMITED_USE',
    'SKILL_PROFICIENCY',
    'EQUIPMENT_PROFICIENCY',
    'EQUIPMENT_PROPERTY_PROFICIENCY',
    'FEATURE'
  ],

  BACKGROUND: [
    'FEATURE',
    'EQUIPMENT_PROFICIENCY',
    'SKILL_PROFICIENCY',
    'EQUIPMENT_PROPERTY_PROFICIENCY'
  ],

  RACE: [
    'FEATURE',
    'EQUIPMENT_PROFICIENCY',
    'SKILL_PROFICIENCY',
    'EQUIPMENT_PROPERTY_PROFICIENCY',
    'SUBRACE',
    'RACE_ANCESTRY_OPTION'
  ]
} as const
