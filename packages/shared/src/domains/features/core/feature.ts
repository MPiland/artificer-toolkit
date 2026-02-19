import type { CoreMeta } from '#core'

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

export const FEATURE_ATTRIBUTE_OPTIONS = Object.values(
  FEATURE_ATTRIBUTE_REGISTRY
) as readonly FeatureAttributeOption[]
