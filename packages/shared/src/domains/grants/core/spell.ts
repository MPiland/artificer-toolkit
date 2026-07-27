import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const SPELL_GRANT_ATTRIBUTE = {
  CONCENTRATION: 'CONCENTRATION',
  RITUAL: 'RITUAL',
  LIMITED_USE: 'LIMITED_USE',
  /** how it’s acquired */
  PREPARED: 'PREPARED',
  KNOWN: 'KNOWN',

  /** casting behavior */
  CAST_AT_WILL: 'CAST_AT_WILL',
  CAST_AT_LEVEL: 'CAST_AT_LEVEL',

  /** authoring structure */
  SELF_ONLY: 'SELF_ONLY'
} as const

export type SpellGrantAttribute = keyof typeof SPELL_GRANT_ATTRIBUTE

export type SpellGrantAttributeOption = CoreMeta<SpellGrantAttribute>

export const SPELL_GRANT_ATTRIBUTE_REGISTRY: Record<
  SpellGrantAttribute,
  SpellGrantAttributeOption
> = {
  LIMITED_USE: {
    code: SPELL_GRANT_ATTRIBUTE.LIMITED_USE,
    label: 'Limited Use',
    tooltip: 'The spell has a limited number of uses.',
    description: 'The spell may only be cast a limited number of times before requiring a reset.'
  },

  CONCENTRATION: {
    code: SPELL_GRANT_ATTRIBUTE.CONCENTRATION,
    label: 'Concentration',
    tooltip:
      'The spell requires concentration to maintain the spell which ends if the caster is incapacitated or dies.',
    description: 'The spell requires concentration.'
  },

  RITUAL: {
    code: SPELL_GRANT_ATTRIBUTE.RITUAL,
    label: 'Ritual',
    tooltip:
      'The spell requires a ritual to cast which requires the character to remain casting for a longer time.',
    description: 'The spell requires a ritual to cast.'
  },

  PREPARED: {
    code: SPELL_GRANT_ATTRIBUTE.PREPARED,
    label: 'Prepared Spell',
    tooltip: 'The spell is prepared.',
    description: 'The spell must be prepared but does not need to be learned separately.'
  },

  KNOWN: {
    code: SPELL_GRANT_ATTRIBUTE.KNOWN,
    label: 'Known Spell',
    tooltip: 'The spell is learned permanently.',
    description: 'The spell is added to the list of known spells.'
  },

  CAST_AT_WILL: {
    code: SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL,
    label: 'Cast at Will',
    tooltip: 'The spell can be cast without expending a spell slot.',
    description: 'The spell may be cast an unlimited number of times without using spell slots.'
  },

  CAST_AT_LEVEL: {
    code: SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL,
    label: 'Cast at Level',
    tooltip: 'The spell is cast using a specific slot level.',
    description: 'The spell is always cast using the specified spell slot level.'
  },

  SELF_ONLY: {
    code: SPELL_GRANT_ATTRIBUTE.SELF_ONLY,
    label: 'Self Only',
    tooltip: 'Spell can only target the caster.',
    description: 'The spell can only target the caster when cast.'
  }
} as const

export const SPELL_GRANT_ATTRIBUTE_OPTIONS = valuesOf(
  SPELL_GRANT_ATTRIBUTE_REGISTRY
) as readonly SpellGrantAttributeOption[]
