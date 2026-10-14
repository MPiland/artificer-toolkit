import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const CLASS_CATEGORY = {
  BASE: 'BASE',
  SUBCLASS: 'SUBCLASS'
} as const

export type ClassCategory = keyof typeof CLASS_CATEGORY

export type ClassCategoryOption = CoreMeta<ClassCategory>

export const CLASS_CATEGORY_REGISTRY: Record<ClassCategory, ClassCategoryOption> = {
  BASE: {
    code: CLASS_CATEGORY.BASE,
    label: 'Base Class',
    description: 'A primary class selection that defines a character progression path.'
  },

  SUBCLASS: {
    code: CLASS_CATEGORY.SUBCLASS,
    label: 'Subclass',
    description: 'A specialization of a base class that modifies or extends its progression.'
  }
} as const

export const CLASS_CATEGORY_OPTIONS = valuesOf(
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
    description: 'Can cast spells.'
  },

  RESOURCE: {
    code: CLASS_ATTRIBUTE.RESOURCE,
    label: 'Resource',
    description: 'Resource such as Inspiration Dice or Ki Points.'
  }
} as const

export const CLASS_ATTRIBUTE_OPTIONS = valuesOf(
  CLASS_ATTRIBUTE_REGISTRY
) as readonly ClassAttributeOption[]

export const SUBCLASS_ATTRIBUTE = {
  ...CLASS_ATTRIBUTE,
  SPECIALIZATION: 'SPECIALIZATION'
} as const

export type SubclassAttribute = keyof typeof SUBCLASS_ATTRIBUTE

export type SubclassAttributeOption = CoreMeta<SubclassAttribute>

export const SUBCLASS_ATTRIBUTE_REGISTRY: Record<SubclassAttribute, SubclassAttributeOption> = {
  ...CLASS_ATTRIBUTE_REGISTRY,
  SPECIALIZATION: {
    code: SUBCLASS_ATTRIBUTE.SPECIALIZATION,
    label: 'Specialization',
    description: 'Defines a lasting specialization within the subclass.'
  }
} as const

export const SUBCLASS_ATTRIBUTE_OPTIONS = valuesOf(
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
    description: 'Spells known are capped rather than fully prepared.'
  },

  [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS]: {
    code: SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS,
    label: 'Prepares Spells',
    description: 'Spells are prepared from a larger available list.'
  },

  [SPELLCASTING_ATTRIBUTE.CUSTOM_MAGIC_NAME]: {
    code: SPELLCASTING_ATTRIBUTE.CUSTOM_MAGIC_NAME,
    label: 'Custom Magic Name',
    description: 'Uses a custom term instead of "spells".'
  },

  [SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK]: {
    code: SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK,
    label: 'Uses Spellbook',
    description: 'Spells are recorded and learned through a spellbook.'
  },

  [SPELLCASTING_ATTRIBUTE.RITUAL_CASTER]: {
    code: SPELLCASTING_ATTRIBUTE.RITUAL_CASTER,
    label: 'Ritual Caster',
    description: 'Can cast certain spells as rituals.'
  }
} as const

export const SPELLCASTING_ATTRIBUTE_OPTIONS = valuesOf(
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
    description: 'Preparation limit is based on a spellcasting ability.'
  },

  [PREPARE_LIMIT_METHOD_KIND.CLASS_LEVEL]: {
    code: PREPARE_LIMIT_METHOD_KIND.CLASS_LEVEL,
    label: 'Class Level',
    description: 'Preparation limit is based on class level.'
  },

  [PREPARE_LIMIT_METHOD_KIND.PER_LEVEL]: {
    code: PREPARE_LIMIT_METHOD_KIND.PER_LEVEL,
    label: 'Per-Level Table',
    description: 'Preparation limit uses a level-based table.'
  }
} as const

export const PREPARE_LIMIT_METHOD_OPTIONS = valuesOf(
  PREPARE_LIMIT_METHOD_REGISTRY
) as readonly PrepareLimitMethodOption[]

export type ClassPrepareLimitPathPayloads = {
  methods: { methodKinds: PrepareLimitMethodOption[] }
}
