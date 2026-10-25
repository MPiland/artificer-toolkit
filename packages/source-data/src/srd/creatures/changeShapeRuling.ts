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
  },
  /** Lycanthrope hybrid and animal forms; statistics stay the same except size and AC (wererat and weretiger: size only; werewolf: AC only). */
  LYCANTHROPE_FORM: {
    label: 'Shapechanger',
    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
    instructions: `The lycanthrope polymorphs into its animal-humanoid hybrid form or its animal form, or back into its true humanoid form. Its statistics are the same in each form except for the size and Armor Class changes the trait notes. Equipment is not transformed. ${REVERT}`
  },
  /** Bat and mist forms, barred in sunlight or running water. */
  VAMPIRE_FORM: {
    label: 'Shapechanger',
    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
    instructions: `While not in sunlight or running water, the vampire polymorphs into a Tiny bat or a Medium cloud of mist, or back into its true form. Bat form: it cannot speak, its walking speed is 5 feet and it has a flying speed of 30 feet. Mist form: it cannot take actions, speak or manipulate objects; it is weightless with a flying speed of 20 feet, can hover, can enter a hostile creature's space and stop there, can pass through any gap air can pass (not water), has advantage on Strength, Dexterity and Constitution saving throws, and is immune to all nonmagical damage except sunlight. Its other statistics are unchanged. Anything it wears transforms with it; nothing it carries does. ${REVERT}`
  },
  /** Drop to 0 hit points outside the resting place. */
  MISTY_ESCAPE: {
    label: 'Misty Escape',
    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
    instructions:
      'When the vampire drops to 0 hit points outside its resting place and is not in sunlight or running water, it becomes a cloud of mist (as in its Shapechanger trait) instead of falling unconscious; if it cannot transform, it is destroyed. At 0 hit points in mist form it cannot revert and must reach its resting place within 2 hours or be destroyed. In its resting place it reverts to vampire form, paralyzed until it regains at least 1 hit point, and regains 1 hit point after 1 hour there.'
  }
} as const
