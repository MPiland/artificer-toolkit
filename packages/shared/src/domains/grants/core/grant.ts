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
    tooltip: 'Applies a numeric or categorical change to a value.',
    description: 'Modifiers alter values such as attack rolls, damage, armor class, charges, or other domains.'
  },

  [GRANT_KIND.PROFICIENCY_GRANT]: {
    code: GRANT_KIND.PROFICIENCY_GRANT,
    label: 'Proficiency',
    tooltip: 'Grants proficiency in a skill, save, language, or equipment.',
    description: 'Used to grant proficiencies, optionally Targeted or selectable.'
  },

  [GRANT_KIND.SENSE_GRANT]: {
    code: GRANT_KIND.SENSE_GRANT,
    label: 'Sense',
    tooltip: 'Grants a sensory capability.',
    description: 'Examples include Darkvision, Tremorsense, or Blindsight.'
  },

  [GRANT_KIND.FEAT_GRANT]: {
    code: GRANT_KIND.FEAT_GRANT,
    label: 'Feat',
    tooltip: 'Grants one or more feats.',
    description: 'May grant feats directly or allow the player to choose feats.'
  },

  [GRANT_KIND.SPELL_GRANT]: {
    code: GRANT_KIND.SPELL_GRANT,
    label: 'Spell',
    tooltip: 'Grants access to spells.',
    description: 'Used for expanded spell lists or direct spell grants.'
  }
} as const
