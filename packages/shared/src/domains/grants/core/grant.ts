import type { CoreMeta } from '#core'

export const GRANT_KIND = {
  MODIFIER_GRANT: 'MODIFIER_GRANT',
  PROFICIENCY_GRANT: 'PROFICIENCY_GRANT',
  SENSE_GRANT: 'SENSE_GRANT',
  FEAT_GRANT: 'FEAT_GRANT',
  SPELL_GRANT: 'SPELL_GRANT'
} as const

export type GrantKind = keyof typeof GRANT_KIND

export type GrantKindOption = CoreMeta<GrantKind>

export const GRANT_TYPE_REGISTRY: Record<GrantKind, GrantKindOption> = {
  [GRANT_KIND.MODIFIER_GRANT]: {
    code: GRANT_KIND.MODIFIER_GRANT,
    label: 'Modifier',
    description: 'Applies a numeric or categorical change to a value.'
  },

  [GRANT_KIND.PROFICIENCY_GRANT]: {
    code: GRANT_KIND.PROFICIENCY_GRANT,
    label: 'Proficiency',
    description: 'Grants proficiency in a skill, save, language, or equipment.'
  },

  [GRANT_KIND.SENSE_GRANT]: {
    code: GRANT_KIND.SENSE_GRANT,
    label: 'Sense',
    description: 'Grants a sensory effect.'
  },

  [GRANT_KIND.FEAT_GRANT]: {
    code: GRANT_KIND.FEAT_GRANT,
    label: 'Feat',
    description: 'Grants one or more feats.'
  },

  [GRANT_KIND.SPELL_GRANT]: {
    code: GRANT_KIND.SPELL_GRANT,
    label: 'Spell',
    description: 'Grants access to spells.'
  }
} as const
