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
    description: 'The spell has a limited number of uses.'
  },

  CONCENTRATION: {
    code: SPELL_GRANT_ATTRIBUTE.CONCENTRATION,
    label: 'Concentration',
    description:
      'The spell requires concentration to maintain the spell which ends if the caster is incapacitated or dies.'
  },

  RITUAL: {
    code: SPELL_GRANT_ATTRIBUTE.RITUAL,
    label: 'Ritual',
    description:
      'The spell requires a ritual to cast which requires the character to remain casting for a longer time.'
  },

  PREPARED: {
    code: SPELL_GRANT_ATTRIBUTE.PREPARED,
    label: 'Prepared Spell',
    description: 'The spell is prepared.'
  },

  KNOWN: {
    code: SPELL_GRANT_ATTRIBUTE.KNOWN,
    label: 'Known Spell',
    description: 'The spell is learned permanently.'
  },

  CAST_AT_WILL: {
    code: SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL,
    label: 'Cast at Will',
    description: 'The spell can be cast without expending a spell slot.'
  },

  CAST_AT_LEVEL: {
    code: SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL,
    label: 'Cast at Level',
    description: 'The spell is cast using a specific slot level.'
  },

  SELF_ONLY: {
    code: SPELL_GRANT_ATTRIBUTE.SELF_ONLY,
    label: 'Self Only',
    description: 'Spell can only target the caster.'
  }
} as const

export const SPELL_GRANT_ATTRIBUTE_OPTIONS = valuesOf(
  SPELL_GRANT_ATTRIBUTE_REGISTRY
) as readonly SpellGrantAttributeOption[]

/** What a spell grant gives: the spells to cast, or only a place for them on a class spell list. */
export const SPELL_GRANT_ACCESS = {
  CAST: 'CAST',
  CLASS_LIST_ONLY: 'CLASS_LIST_ONLY'
} as const

export type SpellGrantAccess = keyof typeof SPELL_GRANT_ACCESS

export type SpellGrantAccessOption = CoreMeta<SpellGrantAccess>

export const SPELL_GRANT_ACCESS_REGISTRY: Record<SpellGrantAccess, SpellGrantAccessOption> = {
  CAST: {
    code: SPELL_GRANT_ACCESS.CAST,
    label: 'Cast',
    description: 'The Character may learn, prepare or cast the spells.'
  },
  CLASS_LIST_ONLY: {
    code: SPELL_GRANT_ACCESS.CLASS_LIST_ONLY,
    label: 'Class List Only',
    description:
      'The spells join the chosen class spell lists and are not learned, prepared or cast by this grant.'
  }
} as const

export const SPELL_GRANT_ACCESS_OPTIONS = valuesOf(
  SPELL_GRANT_ACCESS_REGISTRY
) as readonly SpellGrantAccessOption[]
