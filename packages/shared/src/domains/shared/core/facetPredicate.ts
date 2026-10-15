import type {
  AbilityCode,
  ChargeLimitKind,
  ChargeResetKind,
  CoreMeta,
  CreatureCategoryCode,
  DurationKind,
  EquipmentCategoryCode,
  EquipmentPropertyCode,
  LengthUnitCode,
  RangeKind,
  ScalingAmountKind,
  SizeCode,
  VehicleCategoryCode
} from '#core'
import { valuesOf, type EmptyObject, type Selectable } from '#utils'
import type { NodeSubjectCode } from './facetSubject.js'

export const OWNER_KIND = {
  EQUIPMENT: 'EQUIPMENT',
  SPELL_GRANT: 'SPELL_GRANT'
} as const

export type OwnerKind = keyof typeof OWNER_KIND

export type PredicatePayloadByCode = {
  SUBCLASS_SPECIALIZATION: Selectable<{ specializationIds: string[] }>
  SPELLCASTING: EmptyObject
  RANGE:
    | Selectable<{ rangeKind: Exclude<RangeKind, 'DISTANCE'>[] }>
    | Selectable<
        { rangeKind: Extract<RangeKind, 'DISTANCE'>[] },
        {
          min: number
          max?: number
          unit: LengthUnitCode
        }
      >
  DURATION:
    | Selectable<{ durationKind: Extract<DurationKind, 'INSTANTANEOUS'>[] }>
    | Selectable<
        { durationKind: Exclude<DurationKind, 'INSTANTANEOUS'>[] },
        {
          min: number
          max?: number
        }
      >
  CONCENTRATION: EmptyObject
  RITUAL: EmptyObject
  SIZE: Selectable<{ sizes: SizeCode[] }>
  FEATURE_OBTAINED: {
    featureIds: string[]
  }
  OPTION_OBTAINED: {
    featureIds?: string[]
    optionIds: string[]
  }
  MAGIC_SCHOOL: Selectable<{ magicSchoolIds: string[] }>
  SPELLCASTING_ABILITY: Selectable<{ abilities: AbilityCode[] }>
  SPELL_LEVEL: {
    min: number
    max?: number
  }
  SAVING_THROW_ABILITY: Selectable<{ abilities: AbilityCode[] }>
  SAVING_THROW_DC: {
    min: number
    max?: number
  }
  EQUIPMENT_CATEGORY: {
    category: EquipmentCategoryCode
  }
  EQUIPMENT_PROPERTY: Selectable<
    { properties: EquipmentPropertyCode[] },
    { category?: EquipmentCategoryCode }
  >
  SOLE_WIELDED_WEAPON: EmptyObject
  ATTACK_ABILITY: {
    ability: AbilityCode
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
    { category?: EquipmentCategoryCode }
  >
  SAVE_ABILITY_PROFICIENCY: Selectable<{ abilities: AbilityCode }, { level: ScalingAmountKind }>
  LANGUAGE_PROFICIENCY: Selectable<{ languageIds: string[] }, { level: ScalingAmountKind }>
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
  DAMAGE_TYPE: Selectable<{ damageTypeIds: string[] }>
  CONDITION_TYPE: Selectable<{ conditionTypeIds: string[] }>
  CHARGE_LIMIT_KIND: Selectable<{ chargeLimitKind: ChargeLimitKind[] }>
  CHARGE_RESET_KIND: Selectable<{ chargeResetKind: ChargeResetKind[] }>
  CAN_CAST_SPELL: EmptyObject
  CAN_ACT: EmptyObject
  SPEED_ABOVE_ZERO: EmptyObject
  FREE_HAND: EmptyObject
  CHARACTER_LEVEL: {
    min: number
    max?: number
  }
  CLASS_LEVEL: {
    classIds: string[]
    min: number
    max?: number
  }
  SPELL_OBTAINED: {
    spellIds: string[]
  }
  FEAT_OBTAINED: {
    featIds: string[]
  }
  HERITAGE: Selectable<{
    heritageIds: string[]
  }>
  SKILL_PROFICIENCY: Selectable<{ skillIds: string[] }, { level: ScalingAmountKind }>
  SKILL_SCORE: Selectable<{ skillIds: string[] }>
  ABILITY_SCORE: Selectable<{ abilities: AbilityCode }, { min: number; max?: number }>
  SAVING_THROW_ABILITY_BONUS: Selectable<{ abilities: AbilityCode }, { min: number; max?: number }>
  WHILE_SOURCE_CARRIED: EmptyObject
  WHILE_SOURCE_EQUIPPED: EmptyObject
  WHILE_SOURCE_ATTUNED: EmptyObject
  CREATURE_CATEGORY: Selectable<{ categories: CreatureCategoryCode[] }>
  CREATURE_TYPE: Selectable<{ creatureTypeIds: string[] }>
  CREATURE_SIZE: Selectable<{ sizes: SizeCode[] }>
  CREATURE_IS_MOUNT: EmptyObject
  CREATURE_IS_COMPANION: EmptyObject
  VEHICLE_CATEGORY: Selectable<{ categories: VehicleCategoryCode[] }>
  VEHICLE_SIZE: Selectable<{ sizes: SizeCode[] }>
}

type SelectablePredicateCode = {
  [C in PredicateCode]: PredicatePayloadByCode[C] extends Selectable<infer _Base, infer _Extra>
    ? C
    : never
}[PredicateCode]

export const SELECTABLE_PREDICATE_CODES = [
  'SUBCLASS_SPECIALIZATION',
  'RANGE',
  'DURATION',
  'SIZE',
  'MAGIC_SCHOOL',
  'SPELLCASTING_ABILITY',
  'SAVING_THROW_ABILITY',
  'EQUIPMENT_PROPERTY',
  'EQUIPMENT_PROFICIENCY',
  'EQUIPMENT_PROPERTY_PROFICIENCY',
  'SAVE_ABILITY_PROFICIENCY',
  'LANGUAGE_PROFICIENCY',
  'EQUIPMENT_EQUIPPED',
  'DAMAGE_TYPE',
  'CONDITION_TYPE',
  'CHARGE_LIMIT_KIND',
  'CHARGE_RESET_KIND',
  'HERITAGE',
  'SKILL_PROFICIENCY',
  'SKILL_SCORE',
  'ABILITY_SCORE',
  'SAVING_THROW_ABILITY_BONUS',
  'CREATURE_CATEGORY',
  'CREATURE_TYPE',
  'CREATURE_SIZE',
  'VEHICLE_CATEGORY',
  'VEHICLE_SIZE'
] as const satisfies readonly SelectablePredicateCode[]

export type PredicateCode = keyof PredicatePayloadByCode

export type PredicateOption<
  C extends PredicateCode = PredicateCode,
  S extends NodeSubjectCode = NodeSubjectCode
> = CoreMeta<C> & {
  subjects: readonly S[]
  owners?: readonly OwnerKind[]
}

export const PREDICATE_REGISTRY = {
  SUBCLASS_SPECIALIZATION: {
    code: 'SUBCLASS_SPECIALIZATION',
    label: 'Subclass Specialization',
    description: 'Narrows selection to subclass-defined specialization choice.',
    subjects: ['SUBCLASS']
  },

  SPELLCASTING: {
    code: 'SPELLCASTING',
    label: 'Spellcasting',
    description: 'Narrows to spellcasting classes.',
    subjects: ['CLASS', 'SUBCLASS']
  },

  RANGE: {
    code: 'RANGE',
    label: 'Range',
    description: 'Narrows selection to range(s).',
    subjects: ['FEATURE', 'FEAT', 'SPELL', 'EQUIPMENT', 'OPTION']
  },

  DURATION: {
    code: 'DURATION',
    label: 'Duration',
    description: 'Narrows selection to duration(s).',
    subjects: ['FEATURE', 'FEAT', 'SPELL', 'EQUIPMENT', 'OPTION']
  },

  CONCENTRATION: {
    code: 'CONCENTRATION',
    label: 'Concentration',
    description: 'Narrows selection to spells with concentration',
    subjects: ['SPELL']
  },

  RITUAL: {
    code: 'RITUAL',
    label: 'Ritual',
    description: 'Narrows selection to ritual spells',
    subjects: ['SPELL']
  },

  SIZE: {
    code: 'SIZE',
    label: 'Size',
    description: 'Narrows selection to creature size(s).',
    subjects: ['RACE', 'CHARACTER']
  },

  MAGIC_SCHOOL: {
    code: 'MAGIC_SCHOOL',
    label: 'Magic School',
    description: 'Narrows selection to spell school.',
    subjects: ['SPELL']
  },

  SPELLCASTING_ABILITY: {
    code: 'SPELLCASTING_ABILITY',
    label: 'Spellcasting ability',
    description: 'Narrows selection to spellcastinga abilities.',
    subjects: ['CLASS', 'SUBCLASS']
  },

  SPELL_LEVEL: {
    code: 'SPELL_LEVEL',
    label: 'Spell Level',
    description: 'Narrows selection to spell level.',
    subjects: ['SPELL']
  },

  SAVING_THROW_ABILITY: {
    code: 'SAVING_THROW_ABILITY',
    label: 'Saving Throw Ability',
    description: 'Narrows selection to saving throw ability.',
    subjects: ['CHARACTER']
  },

  SAVING_THROW_DC: {
    code: 'SAVING_THROW_DC',
    label: 'Saving Throw DC',
    description: 'Narrows selection to saving throw DC.',
    subjects: ['SPELL']
  },

  EQUIPMENT_CATEGORY: {
    code: 'EQUIPMENT_CATEGORY',
    label: 'Category',
    description: 'Narrows selection to category.',
    subjects: ['EQUIPMENT']
  },

  EQUIPMENT_PROPERTY: {
    code: 'EQUIPMENT_PROPERTY',
    label: 'Property',
    description: 'Narrows selection to property.',
    subjects: ['EQUIPMENT']
  },

  SOLE_WIELDED_WEAPON: {
    code: 'SOLE_WIELDED_WEAPON',
    label: 'Only Weapon Wielded',
    description: 'Requires the item to be the only weapon wielded.',
    subjects: ['EQUIPMENT']
  },

  ATTACK_ABILITY: {
    code: 'ATTACK_ABILITY',
    label: 'Attack Ability',
    tooltip: 'Requires the attack to use the ability.',
    description:
      'Narrows to an attack that uses a specific ability for its attack and damage rolls. A finesse weapon uses whichever of Strength or Dexterity gives the higher modifier.',
    subjects: ['EQUIPMENT']
  },

  ARMOR_CLASS: {
    code: 'ARMOR_CLASS',
    label: 'Armor Class',
    description: 'Narrows selection to armor class within a range.',
    subjects: ['EQUIPMENT']
  },

  DAMAGE_TYPE: {
    code: 'DAMAGE_TYPE',
    label: 'Damage Type',
    description: 'Narrows selection to damage type.',
    subjects: ['FEATURE', 'FEAT', 'SPELL', 'EQUIPMENT', 'OPTION']
  },

  CONDITION_TYPE: {
    code: 'CONDITION_TYPE',
    label: 'Condition',
    description: 'Narrows selection to condition type.',
    subjects: ['FEATURE', 'FEAT', 'SPELL', 'EQUIPMENT', 'OPTION']
  },

  CHARGE_LIMIT_KIND: {
    code: 'CHARGE_LIMIT_KIND',
    label: 'Charge Limit',
    description: 'Narrows selection to charge limit kind.',
    subjects: ['FEATURE', 'FEAT', 'EQUIPMENT', 'OPTION', 'RESOURCE']
  },

  CHARGE_RESET_KIND: {
    code: 'CHARGE_RESET_KIND',
    label: 'Charge Reset',
    description: 'Narrows selection to charge reset type.',
    subjects: ['FEATURE', 'FEAT', 'EQUIPMENT', 'OPTION', 'RESOURCE']
  },

  CAN_CAST_SPELL: {
    code: 'CAN_CAST_SPELL',
    label: 'Can Cast Spells',
    description: 'Requires spellcasting.',
    subjects: ['CHARACTER'],
    owners: ['SPELL_GRANT']
  },

  CAN_ACT: {
    code: 'CAN_ACT',
    label: 'Can Act',
    description: 'Requires the holder to be able to take actions.',
    subjects: ['CHARACTER', 'CREATURE']
  },

  SPEED_ABOVE_ZERO: {
    code: 'SPEED_ABOVE_ZERO',
    label: 'Speed Above Zero',
    description: 'Requires the holder to have a speed above 0.',
    subjects: ['CHARACTER', 'CREATURE']
  },

  FREE_HAND: {
    code: 'FREE_HAND',
    label: 'Free Hand',
    description: 'Requires the holder to have a hand free.',
    subjects: ['CHARACTER', 'CREATURE']
  },

  CHARACTER_LEVEL: {
    code: 'CHARACTER_LEVEL',
    label: 'Character Level',
    description: 'Requires a minimum or maximum total character level.',
    subjects: ['CHARACTER']
  },

  CLASS_LEVEL: {
    code: 'CLASS_LEVEL',
    label: 'Class Level',
    description: 'Requires a minimum or maximum class level.',
    subjects: ['CHARACTER']
  },

  SPELL_OBTAINED: {
    code: 'SPELL_OBTAINED',
    label: 'Spell Obtained',
    description: 'Requires access to a specific spell.',
    subjects: ['CHARACTER']
  },

  FEAT_OBTAINED: {
    code: 'FEAT_OBTAINED',
    label: 'Feat Obtained',
    description: 'Requires a feat to already be obtained.',
    subjects: ['CHARACTER']
  },

  HERITAGE: {
    code: 'HERITAGE',
    label: 'Heritage',
    description: 'Requires a character heritage membership.',
    subjects: ['CHARACTER']
  },

  FEATURE_OBTAINED: {
    code: 'FEATURE_OBTAINED',
    label: 'Feature Obtained',
    description: 'Requires a feature to already be obtained.',
    subjects: ['CHARACTER']
  },

  OPTION_OBTAINED: {
    code: 'OPTION_OBTAINED',
    label: 'Feature Option Obtained',
    description: 'Narrows selection to feature option selection.',
    subjects: ['CHARACTER']
  },

  EQUIPMENT_PROFICIENCY: {
    code: 'EQUIPMENT_PROFICIENCY',
    label: 'Equipment Proficiency',
    description: 'Narrows selection to proficiency with specific equipment.',
    subjects: ['CHARACTER', 'CLASS', 'FEAT', 'FEATURE', 'OPTION']
  },

  EQUIPMENT_PROPERTY_PROFICIENCY: {
    code: 'EQUIPMENT_PROPERTY_PROFICIENCY',
    label: 'Equipment Property Proficiency',
    description: 'Narrows selection to proficiency with equipment that has certain properties.',
    subjects: ['CHARACTER', 'CLASS', 'FEAT', 'FEATURE', 'OPTION']
  },

  LANGUAGE_PROFICIENCY: {
    code: 'LANGUAGE_PROFICIENCY',
    label: 'Language Proficiency',
    description: 'Narrows selection to proficiency in one or more languages.',
    subjects: ['CHARACTER', 'FEAT', 'FEATURE', 'OPTION']
  },

  SAVE_ABILITY_PROFICIENCY: {
    code: 'SAVE_ABILITY_PROFICIENCY',
    label: 'Save Ability Proficiency',
    description: 'Narrows selection to proficiency in one or more save abilities.',
    subjects: ['CHARACTER', 'CLASS', 'FEAT', 'FEATURE', 'OPTION']
  },

  SKILL_PROFICIENCY: {
    code: 'SKILL_PROFICIENCY',
    label: 'Skill Proficiency',
    description: 'Narrows selection to proficiency in one or more skills.',
    subjects: ['CHARACTER', 'CLASS', 'FEAT', 'FEATURE', 'OPTION']
  },

  EQUIPMENT_EQUIPPED: {
    code: 'EQUIPMENT_EQUIPPED',
    label: 'Equipment Equipped',
    description: 'Requires specific equipment to be equipped.',
    subjects: ['CHARACTER']
  },

  SKILL_SCORE: {
    code: 'SKILL_SCORE',
    label: 'Skill Score',
    description: 'Requires a minimum or maximum skill bonus.',
    subjects: ['CHARACTER']
  },

  ABILITY_SCORE: {
    code: 'ABILITY_SCORE',
    label: 'Ability Score',
    description: 'Requires a minimum or maximum ability score.',
    subjects: ['CHARACTER']
  },

  SAVING_THROW_ABILITY_BONUS: {
    code: 'SAVING_THROW_ABILITY_BONUS',
    label: 'Saving Throw Ability Bonus',
    description: 'Ability bonus score of the character.',
    subjects: ['CHARACTER']
  },

  WHILE_SOURCE_CARRIED: {
    code: 'WHILE_SOURCE_CARRIED',
    label: 'While Carried',
    description: 'Applies while the item is carried by the character.',
    subjects: ['CHARACTER'],
    owners: ['EQUIPMENT']
  },

  WHILE_SOURCE_EQUIPPED: {
    code: 'WHILE_SOURCE_EQUIPPED',
    label: 'While Equipped',
    description: 'Applies only while the item is equipped.',
    subjects: ['CHARACTER'],
    owners: ['EQUIPMENT']
  },

  WHILE_SOURCE_ATTUNED: {
    code: 'WHILE_SOURCE_ATTUNED',
    label: 'While Attuned',
    description: 'Applies only while the item is attuned.',
    subjects: ['CHARACTER'],
    owners: ['EQUIPMENT']
  },

  CREATURE_CATEGORY: {
    code: 'CREATURE_CATEGORY',
    label: 'Creature Category',
    description: 'Narrows selection to creature categories.',
    subjects: ['CREATURE']
  },

  CREATURE_TYPE: {
    code: 'CREATURE_TYPE',
    label: 'Creature Type',
    description: 'Narrows selection to creature types.',
    subjects: ['CREATURE']
  },

  CREATURE_SIZE: {
    code: 'CREATURE_SIZE',
    label: 'Creature Size',
    description: 'Narrows selection to creature sizes.',
    subjects: ['CREATURE']
  },

  CREATURE_IS_MOUNT: {
    code: 'CREATURE_IS_MOUNT',
    label: 'Is Mount',
    description: 'Requires mount-capable creatures.',
    subjects: ['CREATURE']
  },

  CREATURE_IS_COMPANION: {
    code: 'CREATURE_IS_COMPANION',
    label: 'Is Companion',
    description: 'Requires companion-capable creatures.',
    subjects: ['CREATURE']
  },

  VEHICLE_CATEGORY: {
    code: 'VEHICLE_CATEGORY',
    label: 'Vehicle Category',
    description: 'Narrows selection to vehicle categories.',
    subjects: ['VEHICLE']
  },

  VEHICLE_SIZE: {
    code: 'VEHICLE_SIZE',
    label: 'Vehicle Size',
    description: 'Narrows selection to vehicle sizes.',
    subjects: ['VEHICLE']
  }
} as const satisfies Record<PredicateCode, PredicateOption>

export const PREDICATE_OPTIONS = valuesOf(PREDICATE_REGISTRY)

type PredicateRegistry = typeof PREDICATE_REGISTRY

export type SubjectPredicateCode<S extends NodeSubjectCode> = {
  [K in keyof PredicateRegistry]: Extract<S, PredicateRegistry[K]['subjects'][number]> extends never
    ? never
    : K
}[keyof PredicateRegistry] &
  PredicateCode
function isAllowed<S extends NodeSubjectCode>(
  subject: S,
  owner: OwnerKind | undefined,
  p: PredicateOption
): p is PredicateOption<SubjectPredicateCode<S>> {
  if (!p.subjects.includes(subject)) return false
  if (p.owners) {
    // When owner context is available, owner-scoped predicates are narrowed to it.
    if (!owner) return true
    if (!p.owners.includes(owner)) return false
  }
  return true
}

export function getPredicateOptionsForSubject<S extends NodeSubjectCode>(
  subject: S,
  opts?: { owner?: OwnerKind }
): readonly PredicateOption<SubjectPredicateCode<S>>[] {
  const owner = opts?.owner
  return PREDICATE_OPTIONS.filter((p) => isAllowed(subject, owner, p))
}

type Overlap = Extract<NodeSubjectCode, PredicateCode>
type AssertNever<T extends never> = T
type _NoSubjectPredicateOverlap = AssertNever<Overlap>
