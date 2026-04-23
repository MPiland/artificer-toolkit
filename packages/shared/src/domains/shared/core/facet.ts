import { SUBJECT_REGISTRY,
  type AbilityCode,
  type ChargeLimitKind,
  type ChargeResetKind,
  type CoreMeta,
  type CreatureCategoryCode,
  type CreatureRecordKindCode,
  type DurationKind,
  type EquipmentCategoryCode,
  type EquipmentPropertyCode,
  type MeasurementUnitCode,
  type ProficiencyKind,
  type RangeKind,
  type ScalingAmountKind,
  type SizeCode,
  type VehicleCategoryCode
} from '#core'
import { valuesOf, type Selectable, type EmptyObject } from '#utils'

export type SubjectPayloadByCode = {
  CLASS: { classIds: string[] }
  FEATURE: { featureIds: string[] }
  SPELL: { spellIds: string[] }
  EQUIPMENT: { equipmentIds: string[] }
  FEAT: { featIds: string[] }
  RACE: { raceIds: string[] }
  BACKGROUND: { backgroundIds: string[] }
  CREATURE: { creatureIds: string[] }
  VEHICLE: { vehicleIds: string[] }
  PROFICIENCY_GRANT: { proficiencyKind: ProficiencyKind }

  OPTION: { optionIds: string[] }
  SUBRACE: { subraceIds: string[] }
  SUBCLASS: { subclassIds: string[] }
  RESOURCE: { resourceIds: string[] }
  RACE_ANCESTRY_OPTION: { ancestryOptionIds: string[] }

  // If a node subject cannot be selected directly, use EmptyObject
  CHARACTER: EmptyObject
}

export type NodeSubjectCode = keyof SubjectPayloadByCode

export type NodeSubjectOption<C extends NodeSubjectCode = NodeSubjectCode> = CoreMeta<C>

type NodeSubjectRegistry = { [C in NodeSubjectCode]: NodeSubjectOption<C> }

export const NODE_SUBJECT: NodeSubjectRegistry = {
  ...SUBJECT_REGISTRY,

  FEATURE: {
    code: 'FEATURE',
    label: 'Feature',
    tooltip: 'Narrows selection to feature(s).',
    description:
      'Narrows selection to one or more specific features. This can be used to target class features, racial attributes, feat features, or other authored features.'
  },

  OPTION: {
    code: 'OPTION',
    label: 'Feature Option',
    tooltip: 'Narrows selection to feature option.',
    description:
      'Narrows selection to one or more specific feature options, such as Fighting Style selections, invocation choices, or other option-based feature paths.'
  },

  SUBCLASS: {
    code: 'SUBCLASS',
    label: 'Subclass',
    tooltip: 'Narrows to a subclass.',
    description:
      'Narrows selection to a specific subclass for their class.'
  },

  RESOURCE: {
    code: 'RESOURCE',
    label: 'Resource',
    tooltip: 'Narrows to a class resource.',
    description:
      'Narrows applicability to a specific resource of a class such as Ki or Inspiration Dice.'
  },

  SUBRACE: {
    code: 'SUBRACE',
    label: 'Subrace',
    tooltip: 'Narrows to a subrace.',
    description:
      'Narrows selections to a specific subrace within a race.'
  },

  RACE_ANCESTRY_OPTION: {
    code: 'RACE_ANCESTRY_OPTION',
    label: 'Ancestry Option',
    tooltip: 'Narrows selection to ancestry option(s).',
    description:
      'Narrows one or more specific options within an ancestry, such as Red or Blue for Draconic Ancestry.'
  },

  PROFICIENCY_GRANT: {
    code: 'PROFICIENCY_GRANT',
    label: 'Proficiency Grant',
    tooltip: 'Narrows select to proficiency grants',
    description:
      'Narrows one or more proficiency kinds, such as ability, equipment, etc'

  }

} as const

export const NODE_SUBJECT_OPTIONS = valuesOf(NODE_SUBJECT)

export type SubjectSelectionPayload<S extends NodeSubjectCode>
  = SubjectPayloadByCode[S]

export const RELATIONS = {
  CLASS: {
    FEATURE: { to: 'FEATURE' },
    SUBCLASS: { to: 'SUBCLASS' },
    RESOURCE: { to: 'RESOURCE' },
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  SUBCLASS: {
    FEATURE: { to: 'FEATURE' },
    RESOURCE: { to: 'RESOURCE' },
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  FEATURE: {
    OPTION: { to: 'OPTION' },
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  FEAT: {
    FEATURE: { to: 'FEATURE' },
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  EQUIPMENT: {
    FEATURE: { to: 'FEATURE' }
  },
  OPTION: {
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  BACKGROUND: {
    FEATURE: { to: 'FEATURE' },
    PROFICIENCY_GRANT: { to: 'PROFICIENCY_GRANT' }
  },
  CHARACTER: {
    CREATURE: { to: 'CREATURE' },
    VEHICLE: { to: 'VEHICLE' }
  },
  RACE: {
    FEATURE: { to: 'FEATURE' },
    SUBRACE: { to: 'SUBRACE' },
    RACE_ANCESTRY_OPTION: { to: 'RACE_ANCESTRY_OPTION' }
  },
  SUBRACE: {
    FEATURE: { to: 'FEATURE' },
    RACE_ANCESTRY_OPTION: { to: 'RACE_ANCESTRY_OPTION' }
  },
  RACE_ANCESTRY_OPTION: {
    FEATURE: { to: 'FEATURE' }
  }
} as const satisfies Partial<Record<NodeSubjectCode, Record<string, { to: NodeSubjectCode }>>>

export const RELATION_SUBJECTS = Object.keys(RELATIONS) as SubjectWithRelations[]

export const RELATION_CODES = Array.from(
  new Set(
    valuesOf(RELATIONS).flatMap((m) => Object.keys(m))
  )
) as RelationCode<SubjectWithRelations>[]

type RelationsMap = typeof RELATIONS

/** Subjects that have relations */
export type SubjectWithRelations = keyof RelationsMap

/** Relation codes for a given subject */
export type RelationCode<S extends NodeSubjectCode>
  = S extends SubjectWithRelations
    ? (keyof RelationsMap[S] & string)
    : never

export type RelatedSubjectCodes<S extends NodeSubjectCode>
  = S extends SubjectWithRelations
    ? RelationSpec<S>['to'] & NodeSubjectCode
    : never

/** Correlated { relationCode, to } union for a given subject S */
type RelationSpec<S extends SubjectWithRelations> = {
  [R in keyof RelationsMap[S] & string]: {
    relationCode: R
    to: RelationsMap[S][R] extends { to: infer T } ? T : never
  }
}[keyof RelationsMap[S] & string]

/** Maps (S, R) → child subject, preserving correlation */
export type RelationTargetSubject<
  S extends NodeSubjectCode,
  R extends RelationCode<S>
>
  = S extends SubjectWithRelations
    ? Extract<RelationSpec<S>, { relationCode: R }>['to'] & NodeSubjectCode
    : never

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
        unit: MeasurementUnitCode
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
  SIZE: Selectable<
    { sizes: SizeCode[] }
  >
  FEATURE_OBTAINED: {
    featureIds: string[]
  }
  OPTION_OBTAINED: {
    featureIds?: string[]
    optionIds: string[]
  }
  MAGIC_SCHOOL: Selectable<
    { magicSchoolIds: string[] }
  >
  SPELLCASTING_ABILITY: Selectable<
    { abilities: AbilityCode[] }
  >
  SPELL_LEVEL: {
    min: number
    max?: number
  }
  SAVING_THROW_ABILITY: Selectable<
    { abilities: AbilityCode[] }
  >
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
  SAVE_ABILITY_PROFICIENCY: Selectable<
    { abilities: AbilityCode },
    { level: ScalingAmountKind }
  >
  LANGUAGE_PROFICIENCY: Selectable<
    { languageIds: string[] },
    { level: ScalingAmountKind }
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
  CHARGE_LIMIT_KIND: Selectable<
    { chargeLimitKind: ChargeLimitKind[] }
  >
  CHARGE_RESET_KIND: Selectable<
    { chargeResetKind: ChargeResetKind[] }
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
  HERITAGE: Selectable<{
    heritageIds: string[]
  }>
  SKILL_PROFICIENCY: Selectable<
    { skillIds: string[] },
    { level: ScalingAmountKind }
  >
  SKILL_SCORE: Selectable<
    { skillIds: string[] }
  >
  ABILITY_SCORE: Selectable<
    { abilities: AbilityCode },
    { min: number, max?: number }
  >
  SAVING_THROW_ABILITY_BONUS: Selectable<
    { abilities: AbilityCode },
    { min: number, max?: number }
  >
  WHILE_SOURCE_CARRIED: EmptyObject
  WHILE_SOURCE_EQUIPPED: EmptyObject
  WHILE_SOURCE_ATTUNED: EmptyObject
  CREATURE_RECORD_KIND: Selectable<
    { recordKinds: CreatureRecordKindCode[] }
  >
  CREATURE_CATEGORY: Selectable<
    { categories: CreatureCategoryCode[] }
  >
  CREATURE_TYPE: Selectable<
    { creatureTypeIds: string[] }
  >
  CREATURE_SIZE: Selectable<
    { sizes: SizeCode[] }
  >
  CREATURE_IS_MOUNT: EmptyObject
  CREATURE_IS_COMPANION: EmptyObject
  VEHICLE_CATEGORY: Selectable<
    { categories: VehicleCategoryCode[] }
  >
  VEHICLE_SIZE: Selectable<
    { sizes: SizeCode[] }
  >
}

type SelectablePredicateCode = {
  [C in PredicateCode]:
  PredicatePayloadByCode[C] extends Selectable<infer _Base, infer _Extra>
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
  'CREATURE_RECORD_KIND',
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
    tooltip: 'Narrows selection to subclass-defined specialization choice.',
    description:
          'Used for subclass specialization identities such as Druid Circle of the Land terrain.',
    subjects: ['SUBCLASS']
  },

  SPELLCASTING: {
    code: 'SPELLCASTING',
    label: 'Spellcasting',
    tooltip: 'Narrows to spellcasting classes.',
    description:
          'Narrows applicability to classes that have the spellcasting ability.',
    subjects: ['CLASS', 'SUBCLASS']
  },

  RANGE: {
    code: 'RANGE',
    label: 'Range',
    tooltip: 'Narrows selection to range(s).',
    description:
          'Narrows the selection path to a specific range or ranges.',
    subjects: [
      'FEATURE', 'FEAT', 'SPELL', 'EQUIPMENT', 'OPTION'
    ]
  },

  DURATION: {
    code: 'DURATION',
    label: 'Duration',
    tooltip: 'Narrows selection to duration(s).',
    description:
          'Narrows the selection path to a specific duration or durations.',
    subjects: [
      'FEATURE', 'FEAT', 'SPELL', 'EQUIPMENT', 'OPTION'
    ]
  },

  CONCENTRATION: {
    code: 'CONCENTRATION',
    label: 'Concentration',
    tooltip: 'Narrows selection to spells with concentration',
    description: 'Narrows selections to spells that require the character to concentrate while casting.',
    subjects: ['SPELL']
  },

  RITUAL: {
    code: 'RITUAL',
    label: 'Ritual',
    tooltip: 'Narrows selection to ritual spells',
    description: 'Narrows selections to spells that can be cast as rituals.',
    subjects: ['SPELL']
  },

  SIZE: {
    code: 'SIZE',
    label: 'Size',
    tooltip: 'Narrows selection to creature size(s).',
    description: 'Such as Small, Medium, or Large.',
    subjects: ['RACE', 'CHARACTER']
  },

  MAGIC_SCHOOL: {
    code: 'MAGIC_SCHOOL',
    label: 'Magic School',
    tooltip: 'Narrows selection to spell school.',
    description:
          'Narrows selection to spells belonging to a specific magic school, such as Evocation, Illusion, or Necromancy.',
    subjects: ['SPELL']
  },

  SPELLCASTING_ABILITY: {
    code: 'SPELLCASTING_ABILITY',
    label: 'Spellcasting ability',
    tooltip: 'Narrows selection to spellcastinga abilities.',
    description:
          'Narrows selection to classes that can cast spells based on their spellcasting ability.',
    subjects: ['CLASS', 'SUBCLASS']
  },

  SPELL_LEVEL: {
    code: 'SPELL_LEVEL',
    label: 'Spell Level',
    tooltip: 'Narrows selection to spell level.',
    description:
          'Narrows selection to spells of a specific level (0–9), such as only cantrips or only 3rd-level spells.',
    subjects: ['SPELL']
  },

  SAVING_THROW_ABILITY: {
    code: 'SAVING_THROW_ABILITY',
    label: 'Saving Throw Ability',
    tooltip: 'Narrows selection to saving throw ability.',
    description:
          'Narrows selection to spells or effects that require a saving throw using specific abilities, such as Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma.',
    subjects: ['CHARACTER']
  },

  SAVING_THROW_DC: {
    code: 'SAVING_THROW_DC',
    label: 'Saving Throw DC',
    tooltip: 'Narrows selection to saving throw DC.',
    description:
          'Narrows selection to spells or effects that require a saving throw with a specific DC.',
    subjects: ['SPELL']
  },

  EQUIPMENT_CATEGORY: {
    code: 'EQUIPMENT_CATEGORY',
    label: 'Category',
    tooltip: 'Narrows selection to category.',
    description:
          'Narrows selection to items of a specific category, such as Weapon, Armor, Tool, Shield, or Adventuring Gear.',
    subjects: ['EQUIPMENT']
  },

  EQUIPMENT_PROPERTY: {
    code: 'EQUIPMENT_PROPERTY',
    label: 'Property',
    tooltip: 'Narrows selection to property.',
    description:
          'Narrows selection to entities with specific properties, such as weapon properties (Finesse, Heavy, Light) or item-specific attributes.',
    subjects: ['EQUIPMENT']
  },

  ARMOR_CLASS: {
    code: 'ARMOR_CLASS',
    label: 'Armor Class',
    tooltip: 'Narrows selection to armor class within a range.',
    description: 'Narrows selection to equipment that falls within a value range.',
    subjects: ['EQUIPMENT']
  },

  DAMAGE_TYPE: {
    code: 'DAMAGE_TYPE',
    label: 'Damage Type',
    tooltip: 'Narrows selection to damage type.',
    description:
          'Narrows selection to entities that deal or reference a specific damage type, such as Fire, Cold, Slashing, or Radiant.',
    subjects: [
      'FEATURE', 'FEAT', 'SPELL', 'EQUIPMENT', 'OPTION'
    ]
  },

  CONDITION_TYPE: {
    code: 'CONDITION_TYPE',
    label: 'Condition',
    tooltip: 'Narrows selection to condition type.',
    description:
          'Narrows selection to effects, spells, or features that apply or reference one or more specific conditions, such as Blinded, Charmed, Frightened, or Poisoned.',
    subjects: [
      'FEATURE', 'FEAT', 'SPELL', 'EQUIPMENT', 'OPTION'
    ]
  },

  CHARGE_LIMIT_KIND: {
    code: 'CHARGE_LIMIT_KIND',
    label: 'Charge Limit',
    tooltip: 'Narrows selection to charge limit kind.',
    description:
          'Narrows selection to a specific charge limit kind, such as Ki, Rage, Channel Divinity, or a feature-specific resource.',
    subjects: [
      'FEATURE', 'FEAT', 'EQUIPMENT', 'OPTION', 'RESOURCE'
    ]
  },

  CHARGE_RESET_KIND: {
    code: 'CHARGE_RESET_KIND',
    label: 'Charge Reset',
    tooltip: 'Narrows selection to charge reset type.',
    description:
          'Narrows selection to charge pools that reset on a specific condition, such as Short Rest, Long Rest, Dawn, or Custom resets.',
    subjects: [
      'FEATURE', 'FEAT', 'EQUIPMENT', 'OPTION', 'RESOURCE'
    ]
  },

  CAN_CAST_SPELL: {
    code: 'CAN_CAST_SPELL',
    label: 'Can Cast Spells',
    tooltip: 'Requires spellcasting.',
    description: 'Does not imply knowing any specific spell.',
    subjects: ['CHARACTER'],
    owners: ['SPELL_GRANT']
  },

  CHARACTER_LEVEL: {
    code: 'CHARACTER_LEVEL',
    label: 'Character Level',
    tooltip: 'Requires a minimum or maximum total character level.',
    description: 'Counts all class levels combined.',
    subjects: ['CHARACTER']
  },

  CLASS_LEVEL: {
    code: 'CLASS_LEVEL',
    label: 'Class Level',
    tooltip: 'Requires a minimum or maximum class level.',
    description: 'Counts all class levels combined.',
    subjects: ['CHARACTER']
  },

  SPELL_OBTAINED: {
    code: 'SPELL_OBTAINED',
    label: 'Spell Obtained',
    tooltip: 'Requires access to a specific spell.',
    description: 'Used for spell synergies or upgrades.',
    subjects: ['CHARACTER']
  },

  FEAT_OBTAINED: {
    code: 'FEAT_OBTAINED',
    label: 'Feat Obtained',
    tooltip: 'Requires a feat to already be obtained.',
    description: 'Used for dependent or upgraded feats.',
    subjects: ['CHARACTER']
  },

  HERITAGE: {
    code: 'HERITAGE',
    label: 'Heritage',
    tooltip: 'Requires a character heritage membership.',
    description: 'Requires the character to belong to one or more specific heritages such as Elven or Dwarven.',
    subjects: ['CHARACTER']
  },

  FEATURE_OBTAINED: {
    code: 'FEATURE_OBTAINED',
    label: 'Feature Obtained',
    tooltip: 'Requires a feature to already be obtained.',
    description: 'Used for dependent or upgraded features.',
    subjects: ['CHARACTER']
  },

  OPTION_OBTAINED: {
    code: 'OPTION_OBTAINED',
    label: 'Feature Option Obtained',
    tooltip: 'Narrows selection to feature option selection.',
    description: 'Used for feature path branching.',
    subjects: ['CHARACTER']
  },

  EQUIPMENT_PROFICIENCY: {
    code: 'EQUIPMENT_PROFICIENCY',
    label: 'Equipment Proficiency',
    tooltip: 'Narrows selection to proficiency with specific equipment.',
    description: 'Narrows selection to proficiency with specific equipment and optionally the level.',
    subjects: [
      'CHARACTER', 'CLASS', 'FEAT', 'FEATURE', 'OPTION'
    ]
  },

  EQUIPMENT_PROPERTY_PROFICIENCY: {
    code: 'EQUIPMENT_PROPERTY_PROFICIENCY',
    label: 'Equipment Property Proficiency',
    tooltip: 'Narrows selection to proficiency with equipment that has certain properties.',
    description:
          'Narrows selection to proficiency with equipment that has certain properties and optionally the level.',
    subjects: [
      'CHARACTER', 'CLASS', 'FEAT', 'FEATURE', 'OPTION'
    ]
  },

  LANGUAGE_PROFICIENCY: {
    code: 'LANGUAGE_PROFICIENCY',
    label: 'Language Proficiency',
    tooltip: 'Narrows selection to proficiency in one or more languages.',
    description:
          'Narrows selection to proficiency in one or more languages and optionally the level.',
    subjects: [
      'CHARACTER', 'FEAT', 'FEATURE', 'OPTION'
    ]
  },

  SAVE_ABILITY_PROFICIENCY: {
    code: 'SAVE_ABILITY_PROFICIENCY',
    label: 'Save Ability Proficiency',
    tooltip: 'Narrows selection to proficiency in one or more save abilities.',
    description: 'Narrows selection to proficiency in one or more save abilities and optionally the level.',
    subjects: [
      'CHARACTER', 'CLASS', 'FEAT', 'FEATURE', 'OPTION'
    ]
  },

  SKILL_PROFICIENCY: {
    code: 'SKILL_PROFICIENCY',
    label: 'Skill Proficiency',
    tooltip: 'Narrows selection to proficiency in one or more skills.',
    description: 'Narrows selection to proficiency in one or more skills and optionally the level.',
    subjects: [
      'CHARACTER', 'CLASS', 'FEAT', 'FEATURE', 'OPTION'
    ]
  },

  EQUIPMENT_EQUIPPED: {
    code: 'EQUIPMENT_EQUIPPED',
    label: 'Equipment Equipped',
    tooltip: 'Requires specific equipment to be equipped.',
    description: 'Evaluated dynamically at runtime.',
    subjects: ['CHARACTER']
  },

  SKILL_SCORE: {
    code: 'SKILL_SCORE',
    label: 'Skill Score',
    tooltip: 'Requires a minimum or maximum skill bonus.',
    description: 'Includes proficiency and other modifiers.',
    subjects: ['CHARACTER']
  },

  ABILITY_SCORE: {
    code: 'ABILITY_SCORE',
    label: 'Ability Score',
    tooltip: 'Requires a minimum or maximum ability score.',
    description: 'For example: Strength 13 or higher.',
    subjects: ['CHARACTER']
  },

  SAVING_THROW_ABILITY_BONUS: {
    code: 'SAVING_THROW_ABILITY_BONUS',
    label: 'Saving Throw Ability Bonus',
    tooltip: 'Ability bonus score of the character.',
    description: 'Limits the targeting to the character\'s ability bonus score.',
    subjects: ['CHARACTER']
  },

  WHILE_SOURCE_CARRIED: {
    code: 'WHILE_SOURCE_CARRIED',
    label: 'While Carried',
    tooltip: 'Applies while the item is carried by the character.',
    description:
          'The modifier applies as long as the item is in the character\'s possession, even if it is not equipped or attuned.',
    subjects: ['CHARACTER'],
    owners: ['EQUIPMENT']
  },

  WHILE_SOURCE_EQUIPPED: {
    code: 'WHILE_SOURCE_EQUIPPED',
    label: 'While Equipped',
    tooltip: 'Applies only while the item is equipped.',
    description:
          'The modifier applies only when the item is actively equipped or worn. This is the default behavior for most equipment.',
    subjects: ['CHARACTER'],
    owners: ['EQUIPMENT']
  },

  WHILE_SOURCE_ATTUNED: {
    code: 'WHILE_SOURCE_ATTUNED',
    label: 'While Attuned',
    tooltip: 'Applies only while the item is attuned.',
    description:
          'The modifier applies only when the character is attuned to the item. Attunement is required in addition to equipping the item.',
    subjects: ['CHARACTER'],
    owners: ['EQUIPMENT']
  },

  CREATURE_RECORD_KIND: {
    code: 'CREATURE_RECORD_KIND',
    label: 'Creature Record Kind',
    tooltip: 'Narrows selection to creature record kinds.',
    description: 'Narrows creature applicability to stat-block or logistics creature records.',
    subjects: ['CREATURE']
  },

  CREATURE_CATEGORY: {
    code: 'CREATURE_CATEGORY',
    label: 'Creature Category',
    tooltip: 'Narrows selection to creature categories.',
    description: 'Narrows creature applicability to categories such as monster, beast, companion, or summon.',
    subjects: ['CREATURE']
  },

  CREATURE_TYPE: {
    code: 'CREATURE_TYPE',
    label: 'Creature Type',
    tooltip: 'Narrows selection to creature types.',
    description: 'Narrows creature applicability to one or more master creature types such as beast, humanoid, or undead.',
    subjects: ['CREATURE']
  },

  CREATURE_SIZE: {
    code: 'CREATURE_SIZE',
    label: 'Creature Size',
    tooltip: 'Narrows selection to creature sizes.',
    description: 'Narrows creature applicability to one or more creature sizes.',
    subjects: ['CREATURE']
  },

  CREATURE_IS_MOUNT: {
    code: 'CREATURE_IS_MOUNT',
    label: 'Is Mount',
    tooltip: 'Requires mount-capable creatures.',
    description: 'Narrows creature applicability to creatures that can be treated as mounts.',
    subjects: ['CREATURE']
  },

  CREATURE_IS_COMPANION: {
    code: 'CREATURE_IS_COMPANION',
    label: 'Is Companion',
    tooltip: 'Requires companion-capable creatures.',
    description: 'Narrows creature applicability to creatures that can be treated as companions.',
    subjects: ['CREATURE']
  },

  VEHICLE_CATEGORY: {
    code: 'VEHICLE_CATEGORY',
    label: 'Vehicle Category',
    tooltip: 'Narrows selection to vehicle categories.',
    description: 'Narrows vehicle applicability to land, water, air, or similar vehicle categories.',
    subjects: ['VEHICLE']
  },

  VEHICLE_SIZE: {
    code: 'VEHICLE_SIZE',
    label: 'Vehicle Size',
    tooltip: 'Narrows selection to vehicle sizes.',
    description: 'Narrows vehicle applicability to one or more vehicle sizes.',
    subjects: ['VEHICLE']
  }
} as const satisfies Record<PredicateCode, PredicateOption>

export const PREDICATE_OPTIONS = valuesOf(PREDICATE_REGISTRY)

type PredicateRegistry = typeof PREDICATE_REGISTRY

export type SubjectPredicateCode<S extends NodeSubjectCode> = {
  [K in keyof PredicateRegistry]:
  Extract<S, PredicateRegistry[K]['subjects'][number]> extends never
    ? never
    : K
}[keyof PredicateRegistry] & PredicateCode

function isAllowed<S extends NodeSubjectCode>(
  subject: S,
  owner: OwnerKind | undefined,
  p: PredicateOption
): p is PredicateOption<SubjectPredicateCode<S>> {
  if (!p.subjects.includes(subject)) return false
  if (p.owners) {
    // owners present => must have an owner and it must match
    if (!owner) return false
    if (!p.owners.includes(owner)) return false
  }
  return true
}

export function getRelatedSubjectOptions<S extends NodeSubjectCode>(
  subject: S
): readonly NodeSubjectOption<RelatedSubjectCodes<S>>[] {
  const rel = RELATIONS[subject as SubjectWithRelations]
  if (!rel) return []

  const relationValues = valuesOf(rel) as unknown as ReadonlyArray<{ to: RelatedSubjectCodes<S> }>
  const codes = Array.from(new Set(relationValues.map((x) => x.to))) as RelatedSubjectCodes<S>[]
  return codes.map((c) => NODE_SUBJECT[c]) as readonly NodeSubjectOption<RelatedSubjectCodes<S>>[]
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
