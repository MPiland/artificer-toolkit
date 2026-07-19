import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const FEATURE_CATEGORY = {
  FEATURE: 'FEATURE',
  OPTION: 'OPTION'
} as const

export type FeatureCategory = keyof typeof FEATURE_CATEGORY

export type FeatureCategoryOption = CoreMeta<FeatureCategory>

export const FEATURE_CATEGORY_REGISTRY: Record<
  FeatureCategory,
  FeatureCategoryOption
> = {
  FEATURE: {
    code: FEATURE_CATEGORY.FEATURE,
    label: 'Feature',
    description:
      'A feature that adds effects, modifiers, or other grants to a character.',
    tooltip: 'Feature to add grants.'
  },

  OPTION: {
    code: FEATURE_CATEGORY.OPTION,
    label: 'Option',
    description: 'An optional feature that can be selected by the character.',
    tooltip: 'Option granted by a feature.'
  }
} as const

export const FEATURE_ATTRIBUTE = {
  LIMITED_USE: 'LIMITED_USE',
  HIDDEN_ON_SHEET: 'HIDDEN_ON_SHEET'
} as const

export type FeatureAttribute = keyof typeof FEATURE_ATTRIBUTE

export type FeatureAttributeOption = CoreMeta<FeatureAttribute>

export const FEATURE_ATTRIBUTE_REGISTRY: Record<
  FeatureAttribute,
  FeatureAttributeOption
> = {
  LIMITED_USE: {
    code: FEATURE_ATTRIBUTE.LIMITED_USE,
    label: 'Limited Use',
    description: 'A feature that can only be used a limited number of times.',
    tooltip: 'Feature that can only be used a limited number of times.'
  },

  HIDDEN_ON_SHEET: {
    code: FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET,
    label: 'Hide On Sheet',
    description: 'A feature that is hidden on the character sheet.',
    tooltip: 'Feature that is hidden on the character sheet.'
  }
} as const

export const FEATURE_ATTRIBUTE_OPTIONS = valuesOf(
  FEATURE_ATTRIBUTE_REGISTRY
) as readonly FeatureAttributeOption[]

export const FEATURE_SECTION = {
  TRAIT: 'TRAIT',
  ACTION: 'ACTION',
  BONUS_ACTION: 'BONUS_ACTION',
  REACTION: 'REACTION',
  LEGENDARY_ACTION: 'LEGENDARY_ACTION',
  LAIR_ACTION: 'LAIR_ACTION',
  REGIONAL_EFFECT: 'REGIONAL_EFFECT',
  OTHER: 'OTHER'
} as const

export type FeatureSection = keyof typeof FEATURE_SECTION

export type FeatureSectionOption = CoreMeta<FeatureSection>

export const FEATURE_SECTION_REGISTRY: Record<
  FeatureSection,
  FeatureSectionOption
> = {
  TRAIT: { code: FEATURE_SECTION.TRAIT, label: 'Trait' },
  ACTION: { code: FEATURE_SECTION.ACTION, label: 'Action' },
  BONUS_ACTION: { code: FEATURE_SECTION.BONUS_ACTION, label: 'Bonus Action' },
  REACTION: { code: FEATURE_SECTION.REACTION, label: 'Reaction' },
  LEGENDARY_ACTION: {
    code: FEATURE_SECTION.LEGENDARY_ACTION,
    label: 'Legendary Action'
  },
  LAIR_ACTION: { code: FEATURE_SECTION.LAIR_ACTION, label: 'Lair Action' },
  REGIONAL_EFFECT: {
    code: FEATURE_SECTION.REGIONAL_EFFECT,
    label: 'Regional Effect'
  },
  OTHER: { code: FEATURE_SECTION.OTHER, label: 'Other' }
} as const

export const FEATURE_SECTION_OPTIONS = valuesOf(
  FEATURE_SECTION_REGISTRY
) as readonly FeatureSectionOption[]
