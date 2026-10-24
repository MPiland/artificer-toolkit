import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'

const REVERT = 'The creature reverts to its true form if it dies.'

/**
 * Change Shape and Shapechanger ship as GM rulings (D156, D187a): a form swap replaces the whole
 * Creature including its hit points, while these keep the creature's own statistics. The stat-overlay
 * form is a future enhancement.
 */
export const CHANGE_SHAPE_RULING = {
  /** Replaces AC, speeds and the physical scores of a humanoid or beast of equal or lower challenge rating. */
  CR_CAPPED_FORM: {
    label: 'Change Shape',
    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
    instructions: `The creature polymorphs into a humanoid or beast of a challenge rating no higher than its own, or back into its true form. The GM applies the form's AC, movement modes, Strength, Dexterity and senses, keeps the creature's own hit points and other statistics, and adds the form's other capabilities except class features, legendary actions and lair actions. Equipment is absorbed or borne by the form (the creature's choice). ${REVERT}`
  },
  /** Statistics stay the same; only the speeds change. */
  BEAST_SPEED_FORM: {
    label: 'Shapechanger',
    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
    instructions: `The creature polymorphs into one of the beast forms its trait lists, or back into its true form. Its statistics are the same in each form except for the speeds the trait notes. Equipment is not transformed. ${REVERT}`
  },
  /** Statistics stay the same; size (and, for a succubus or incubus without wings, flying speed) changes. */
  SIZED_FORM: {
    label: 'Change Shape',
    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
    instructions: `The creature polymorphs into the form its trait lists, or back into its true form. Its statistics are the same in each form except for the size and speed changes the trait notes. Equipment is not transformed, except as the trait says. ${REVERT}`
  },
  /** An object form. */
  OBJECT_FORM: {
    label: 'Shapechanger',
    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
    instructions: `The mimic polymorphs into an object or back into its true, amorphous form. Its statistics are the same in each form. Equipment is not transformed. ${REVERT}`
  }
} as const
