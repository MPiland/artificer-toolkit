import type { CoreMeta } from './core.js'

/**
 * Closed, System-neutral rule kinds a System's basic-action catalogue entry may carry (Q11). The
 * entries themselves (names, rules text, cost) are authored System data; only these kinds execute.
 */
export const BASIC_ACTION_MECHANIC_CODE = {
  /** Adds the actor's speed to its movement budget for the current turn. */
  SPEED_MOVEMENT_BONUS: 'SPEED_MOVEMENT_BONUS',
  /** The actor's movement provokes no opportunity attacks for the rest of the turn. */
  NO_OPPORTUNITY_ATTACKS: 'NO_OPPORTUNITY_ATTACKS',
  /** Attack rolls against the actor have disadvantage until the start of its next turn. */
  DISADVANTAGE_ON_ATTACKS_AGAINST: 'DISADVANTAGE_ON_ATTACKS_AGAINST',
  /** The chosen ally's next attack roll or ability check has advantage, before the actor's next turn. */
  ALLY_ADVANTAGE: 'ALLY_ADVANTAGE',
  /** The actor's saving throws of the entry's abilities have advantage until its next turn. */
  SAVE_ADVANTAGE: 'SAVE_ADVANTAGE',
  /** The chosen dying Character becomes stable when the entry's check reaches its DC. */
  STABILIZE_TARGET: 'STABILIZE_TARGET'
} as const

export type BasicActionMechanicCode = keyof typeof BASIC_ACTION_MECHANIC_CODE

export const BASIC_ACTION_MECHANIC_REGISTRY: Record<
  BasicActionMechanicCode,
  CoreMeta<BasicActionMechanicCode>
> = {
  [BASIC_ACTION_MECHANIC_CODE.SPEED_MOVEMENT_BONUS]: {
    code: BASIC_ACTION_MECHANIC_CODE.SPEED_MOVEMENT_BONUS,
    label: 'Extra movement',
    description: "Adds the actor's speed to its movement this turn."
  },
  [BASIC_ACTION_MECHANIC_CODE.NO_OPPORTUNITY_ATTACKS]: {
    code: BASIC_ACTION_MECHANIC_CODE.NO_OPPORTUNITY_ATTACKS,
    label: 'No opportunity attacks',
    description: "The actor's movement provokes no opportunity attacks for the rest of the turn."
  },
  [BASIC_ACTION_MECHANIC_CODE.DISADVANTAGE_ON_ATTACKS_AGAINST]: {
    code: BASIC_ACTION_MECHANIC_CODE.DISADVANTAGE_ON_ATTACKS_AGAINST,
    label: 'Harder to hit',
    description: 'Attack rolls against the actor have disadvantage until its next turn.'
  },
  [BASIC_ACTION_MECHANIC_CODE.ALLY_ADVANTAGE]: {
    code: BASIC_ACTION_MECHANIC_CODE.ALLY_ADVANTAGE,
    label: 'Aid an ally',
    description:
      "The chosen ally's next attack roll or ability check has advantage before the actor's next turn."
  },
  [BASIC_ACTION_MECHANIC_CODE.SAVE_ADVANTAGE]: {
    code: BASIC_ACTION_MECHANIC_CODE.SAVE_ADVANTAGE,
    label: 'Save advantage',
    description:
      "The actor's saving throws of the chosen abilities have advantage until its next turn."
  },
  [BASIC_ACTION_MECHANIC_CODE.STABILIZE_TARGET]: {
    code: BASIC_ACTION_MECHANIC_CODE.STABILIZE_TARGET,
    label: 'Stabilize a creature',
    description: "A dying Character becomes stable when the actor's check reaches the entry's DC."
  }
}
