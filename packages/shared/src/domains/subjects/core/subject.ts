import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

/* ──────────────────────────────────────────────
 * Subject Codes
 * ────────────────────────────────────────────── */
export const SUBJECT = {
  SPELL: 'SPELL',
  EQUIPMENT: 'EQUIPMENT',
  RACE: 'RACE',
  FEAT: 'FEAT',
  CLASS: 'CLASS',
  CHARACTER: 'CHARACTER',
  BACKGROUND: 'BACKGROUND'
} as const

export type Subject = keyof typeof SUBJECT

/* ──────────────────────────────────────────────
 * Subject Options (authoring contracts)
 * ────────────────────────────────────────────── */
export type SubjectOptions = CoreMeta<Subject>

/* ──────────────────────────────────────────────
 * Subject Registry (single source of truth)
 * ────────────────────────────────────────────── */
type SubjectRegistry = { [K in Subject]: CoreMeta<K> }

export const SUBJECT_REGISTRY: SubjectRegistry = {
  SPELL: {
    code: SUBJECT.SPELL,
    label: 'Spell',
    tooltip: 'A spell that can be cast.',
    description: 'Represents spell properties and behaviors.'
  },

  EQUIPMENT: {
    code: SUBJECT.EQUIPMENT,
    label: 'Equipment',
    tooltip: 'An item the character can carry or equip.',
    description: 'Represents weapons, armor, and other gear.'
  },

  RACE: {
    code: SUBJECT.RACE,
    label: 'Race',
    tooltip: 'A character\'s race or ancestry.',
    description: 'Represents racial attributes and features.'
  },

  FEAT: {
    code: SUBJECT.FEAT,
    label: 'Feat',
    tooltip: 'A feat chosen by the character.',
    description: 'Represents a feat and its granted benefits.'
  },

  CLASS: {
    code: SUBJECT.CLASS,
    label: 'Class',
    tooltip: 'A character class.',
    description: 'Represents class-level features and resources.'
  },

  CHARACTER: {
    code: SUBJECT.CHARACTER,
    label: 'Character',
    tooltip: 'The player character.',
    description: 'Represents the core character state and attributes.'
  },

  BACKGROUND: {
    code: SUBJECT.BACKGROUND,
    label: 'Background',
    tooltip: 'A character background.',
    description: 'Represents backgrounds feature.'
  }
} as const

export const SUBJECT_OPTIONS = valuesOf(SUBJECT_REGISTRY) as SubjectOptions[]
