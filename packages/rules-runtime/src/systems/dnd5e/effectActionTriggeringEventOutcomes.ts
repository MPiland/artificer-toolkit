import { unsupported } from './effectActionContracts.js'

// A list runs the action's one graph on each chosen creature, so it carries any outcome that lands
// on its target. An outcome that acts on the actor (a Dash, a self teleport, a concealment) or on the
// event a reaction answered has no creature to repeat on; an outcome no cast can run keeps the reason
// a single target gets, so the list is refused only once it is read.
export function offList<Plan extends { kind: string }>(
  plan: Plan,
  input: { onList: boolean }
): Plan {
  if (input.onList)
    unsupported(
      'D&D chosen-creature action outcome must land on each chosen creature, not on the actor or a triggering event.'
    )
  return plan
}

/** Reactions that act on the event they answered: nothing is stored on their target, the event's actor. */
export const DND5E_TRIGGERING_EVENT_OUTCOMES = {
  CANCEL_TRIGGERING_EVENT: (_outcome: unknown, input: { onList: boolean }) =>
    offList({ kind: 'CANCEL_TRIGGERING_EVENT' as const }, input),
  SUBTRACT_FROM_TRIGGERING_ROLL: (_outcome: unknown, input: { onList: boolean }) =>
    offList({ kind: 'SUBTRACT_FROM_TRIGGERING_ROLL' as const }, input),
  IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL: (_outcome: unknown, input: { onList: boolean }) =>
    offList({ kind: 'IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL' as const }, input)
}
