import type { CoreMeta } from './core.js'

/**
 * Closed, System-neutral rule kinds a System's basic-action catalogue entry may carry (Q11). The
 * entries themselves (names, rules text, cost) are authored System data; only these kinds execute.
 */
export const BASIC_ACTION_MECHANIC_CODE = {
  /** The chosen ally's next attack roll or ability check has advantage, before the actor's next turn. */
  ALLY_ADVANTAGE: 'ALLY_ADVANTAGE',
  /** The chosen dying Character becomes stable when the entry's check reaches its DC. */
  STABILIZE_TARGET: 'STABILIZE_TARGET'
} as const

export type BasicActionMechanicCode = keyof typeof BASIC_ACTION_MECHANIC_CODE

export const BASIC_ACTION_MECHANIC_REGISTRY: Record<
  BasicActionMechanicCode,
  CoreMeta<BasicActionMechanicCode>
> = {
  [BASIC_ACTION_MECHANIC_CODE.ALLY_ADVANTAGE]: {
    code: BASIC_ACTION_MECHANIC_CODE.ALLY_ADVANTAGE,
    label: 'Aid an ally',
    description:
      "The chosen ally's next attack roll or ability check has advantage before the actor's next turn."
  },
  [BASIC_ACTION_MECHANIC_CODE.STABILIZE_TARGET]: {
    code: BASIC_ACTION_MECHANIC_CODE.STABILIZE_TARGET,
    label: 'Stabilize a creature',
    description: "A dying Character becomes stable when the actor's check reaches the entry's DC."
  }
}
