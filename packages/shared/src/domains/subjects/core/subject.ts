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
  CREATURE: 'CREATURE',
  VEHICLE: 'VEHICLE',
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
    description: 'A spell that can be cast.'
  },

  EQUIPMENT: {
    code: SUBJECT.EQUIPMENT,
    label: 'Equipment',
    description: 'An item the character can carry or equip.'
  },

  RACE: {
    code: SUBJECT.RACE,
    label: 'Race',
    description: "A character's race or ancestry."
  },

  FEAT: {
    code: SUBJECT.FEAT,
    label: 'Feat',
    description: 'A feat chosen by the character.'
  },

  CLASS: {
    code: SUBJECT.CLASS,
    label: 'Class',
    description: 'A character class.'
  },

  CREATURE: {
    code: SUBJECT.CREATURE,
    label: 'Creature',
    description: 'A creature or companion record.'
  },

  VEHICLE: {
    code: SUBJECT.VEHICLE,
    label: 'Vehicle',
    description: 'A vehicle record.'
  },

  CHARACTER: {
    code: SUBJECT.CHARACTER,
    label: 'Character',
    description: 'The player character.'
  },

  BACKGROUND: {
    code: SUBJECT.BACKGROUND,
    label: 'Background',
    description: 'A character background.'
  }
} as const

export const SUBJECT_OPTIONS = valuesOf(SUBJECT_REGISTRY) as SubjectOptions[]
