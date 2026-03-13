import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const CLASS_CATEGORY = {
  BASE: 'BASE',
  SUBCLASS: 'SUBCLASS'
} as const

export type ClassCategory = keyof typeof CLASS_CATEGORY

export type ClassCategoryOption = CoreMeta<ClassCategory>

export const CLASS_CATEGORY_REGISTRY: Record<
  ClassCategory,
  ClassCategoryOption
> = {
  BASE: {
    code: CLASS_CATEGORY.BASE,
    label: 'Base Race',
    description:
      'A primary race selection that defines the core attributes of a character.'
  },

  SUBCLASS: {
    code: CLASS_CATEGORY.SUBCLASS,
    label: 'Subclass',
    description:
      'A subdivision of a base race that modifies or extends its attributes.'
  }
} as const

export const CLASS_CATEGORY_OPTIONS = Object.values(
  CLASS_CATEGORY_REGISTRY
) as readonly ClassCategoryOption[]

export const CLASS_ATTRIBUTE = {
  SPELLCASTER: 'SPELLCASTER',
  RESOURCE: 'RESOURCE'
} as const

export type ClassAttribute = keyof typeof CLASS_ATTRIBUTE

export type ClassAttributeOption = CoreMeta<ClassAttribute>

export const CLASS_ATTRIBUTE_REGISTRY: Record<ClassAttribute, ClassAttributeOption> = {
  SPELLCASTER: {
    code: CLASS_ATTRIBUTE.SPELLCASTER,
    label: 'Spellcaster',
    description: 'The class has spellcasting capabilities.',
    tooltip: 'Can cast spells.'
  },

  RESOURCE: {
    code: CLASS_ATTRIBUTE.RESOURCE,
    label: 'Resource',
    description: 'The class has resource-based mechanics.',
    tooltip: 'Resource such as Inspiration Dice or Ki Points.'
  }
} as const

export const CLASS_ATTRIBUTE_OPTIONS = valuesOf(
  CLASS_ATTRIBUTE_REGISTRY
) as readonly ClassAttributeOption[]

export const SUBCLASS_ATTRIBUTE = {
  ...CLASS_ATTRIBUTE,
  SUBTYPE: 'SUBTYPE'
} as const

export type SubclassAttribute = keyof typeof SUBCLASS_ATTRIBUTE

export type SubclassAttributeOption = CoreMeta<SubclassAttribute>

export const SUBCLASS_ATTRIBUTE_REGISTRY: Record<SubclassAttribute, SubclassAttributeOption> = {
  ...CLASS_ATTRIBUTE_REGISTRY,
  SUBTYPE: {
    code: SUBCLASS_ATTRIBUTE.SUBTYPE,
    label: 'Subtype',
    description: 'The subclass has a specific subtype, such as Druid Circle of the Lands terrains or Barbarian Path of the Totem.',
    tooltip: 'Defines a specific type or category within the subclass.'
  }
} as const

export const SUBCLASS_ATTRIBUTE_OPTIONS = Object.values(
  SUBCLASS_ATTRIBUTE_REGISTRY
) as readonly SubclassAttributeOption[]

export const SPELLCASTING_ATTRIBUTE = {
  LIMIT_KNOWN_SPELL_AMOUNT: 'LIMIT_KNOWN_SPELL_AMOUNT',
  PREPARES_SPELLS: 'PREPARES_SPELLS',
  CUSTOM_MAGIC_NAME: 'CUSTOM_MAGIC_NAME',
  USES_SPELLBOOK: 'USES_SPELLBOOK',
  RITUAL_CASTER: 'RITUAL_CASTER'
} as const

export type SpellcastingAttribute = keyof typeof SPELLCASTING_ATTRIBUTE

export type SpellcastingAttributeOption = CoreMeta<SpellcastingAttribute>

export const SPELLCASTING_ATTRIBUTE_REGISTRY: Record<
  SpellcastingAttribute,
  SpellcastingAttributeOption
> = {
  [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT]: {
    code: SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT,
    label: 'Limited Known Spells',
    tooltip: 'Spells known are capped rather than fully prepared.',
    description:
      'This class learns a limited number of spells, which are permanently known and do not require daily preparation.'
  },

  [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS]: {
    code: SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS,
    label: 'Prepares Spells',
    tooltip: 'Spells are prepared from a larger available list.',
    description:
      'This class prepares spells from its available spell list, choosing which spells are usable at a given time.'
  },

  [SPELLCASTING_ATTRIBUTE.CUSTOM_MAGIC_NAME]: {
    code: SPELLCASTING_ATTRIBUTE.CUSTOM_MAGIC_NAME,
    label: 'Custom Magic Name',
    tooltip: 'Uses a custom term instead of “spells.”',
    description:
      'This class uses a custom name for its magical abilities, such as invocations, maneuvers, or techniques.'
  },

  [SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK]: {
    code: SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK,
    label: 'Uses Spellbook',
    tooltip: 'Spells are recorded and learned through a spellbook.',
    description:
      'This class records spells in a spellbook and must reference it to prepare or learn spells.'
  },

  [SPELLCASTING_ATTRIBUTE.RITUAL_CASTER]: {
    code: SPELLCASTING_ATTRIBUTE.RITUAL_CASTER,
    label: 'Ritual Caster',
    tooltip: 'Can cast certain spells as rituals.',
    description:
      'This class can cast eligible spells as rituals, typically without expending spell slots.'
  }
} as const

export const SPELLCASTING_ATTRIBUTE_OPTIONS = Object.values(
  SPELLCASTING_ATTRIBUTE_REGISTRY
) as readonly SpellcastingAttributeOption[]

export const PREPARE_LIMIT_METHOD_KIND = {
  SPELLCASTING_ABILITY: 'SPELLCASTING_ABILITY',
  CLASS_LEVEL: 'CLASS_LEVEL',
  PER_LEVEL: 'PER_LEVEL'
} as const

export type PrepareLimitMethodKind = keyof typeof PREPARE_LIMIT_METHOD_KIND

export type PrepareLimitMethodOption = CoreMeta<PrepareLimitMethodKind>

export const PREPARE_LIMIT_METHOD_REGISTRY: Record<
  PrepareLimitMethodKind,
  PrepareLimitMethodOption
> = {
  [PREPARE_LIMIT_METHOD_KIND.SPELLCASTING_ABILITY]: {
    code: PREPARE_LIMIT_METHOD_KIND.SPELLCASTING_ABILITY,
    label: 'Spellcasting Ability',
    tooltip: 'Preparation limit is based on a spellcasting ability.',
    description:
      'The number of spells that can be prepared is determined using the class\'s spellcasting ability.'
  },

  [PREPARE_LIMIT_METHOD_KIND.CLASS_LEVEL]: {
    code: PREPARE_LIMIT_METHOD_KIND.CLASS_LEVEL,
    label: 'Class Level',
    tooltip: 'Preparation limit is based on class level.',
    description:
      'The number of spells that can be prepared scales with the character\'s level in this class.'
  },

  [PREPARE_LIMIT_METHOD_KIND.PER_LEVEL]: {
    code: PREPARE_LIMIT_METHOD_KIND.PER_LEVEL,
    label: 'Per-Level Table',
    tooltip: 'Preparation limit uses a level-based table.',
    description:
      'The number of spells that can be prepared is defined by an explicit per-level progression table.'
  }
} as const

export const PREPARE_LIMIT_METHOD_OPTIONS = valuesOf(
  PREPARE_LIMIT_METHOD_REGISTRY
) as readonly PrepareLimitMethodOption[]

export type ClassPrepareLimitPathPayloads = {
  methods: { methodKinds: PrepareLimitMethodOption[] }
}
