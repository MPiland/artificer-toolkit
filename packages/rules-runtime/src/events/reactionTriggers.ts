import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'

import type { EncounterEvent } from './encounterEventTable.js'

export type ReactionTriggerKind = NonNullable<
  CharacterActionCandidate['mechanicFacts']['invocation']['reactionTrigger']
>['kind']

/**
 * How the interrupted pipeline resumes once the reaction has run as an ordinary action: it is
 * cancelled, its test is bound again (the reaction changed a fact the test reads), its roll is
 * adjusted, or it carries on untouched. A cancel or a roll adjustment is the work of one outcome of
 * the reaction, which `outcome` names: the trigger is the only one that outcome may answer.
 */
type ReactionResume =
  | { kind: 'CANCEL'; outcome: 'CANCEL_TRIGGERING_EVENT' }
  | {
      kind: 'ADJUST_ROLL'
      outcome: 'SUBTRACT_FROM_TRIGGERING_ROLL' | 'IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL'
    }
  | { kind: 'REBIND_TEST' | 'NOTHING' }

type ReactionTriggerRow = {
  /** The Encounter event that announces the trigger's moment; null while no pipeline raises one. */
  moment: EncounterEvent['kind'] | null
  resume: ReactionResume
}

/**
 * The one registry of reaction triggers (one reaction pipeline, user ruling 2026-11-10): a row per
 * authored `reactionTrigger` kind. A trigger with a row compiles; the event its row names offers it.
 * Transitional: `ATTACK_ON_OTHER` and `ATTACK_RESOLVED_ON_SELF` compile, and no event announces their
 * moment until the shared offer and the reaction child action land; `MOVEMENT` is still announced
 * and interrupted by the movement host, not by an Encounter event.
 */
export const REACTION_TRIGGERS = {
  ATTACKED_SELF: { moment: 'HIT_BY_ATTACK', resume: { kind: 'REBIND_TEST' } },
  DAMAGE_TAKEN: { moment: 'HIT_BY_ATTACK', resume: { kind: 'REBIND_TEST' } },
  TARGETED_SELF: { moment: 'TARGETED_BY_CAST', resume: { kind: 'REBIND_TEST' } },
  SPELL_CAST: {
    moment: 'SPELL_CAST_BY_OTHER',
    resume: { kind: 'CANCEL', outcome: 'CANCEL_TRIGGERING_EVENT' }
  },
  ATTACK_ROLL_BY_OTHER: {
    moment: 'ATTACK_ROLLED_BY_OTHER',
    resume: { kind: 'ADJUST_ROLL', outcome: 'SUBTRACT_FROM_TRIGGERING_ROLL' }
  },
  ATTACK_ON_OTHER: {
    moment: null,
    resume: { kind: 'ADJUST_ROLL', outcome: 'IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL' }
  },
  ATTACK_RESOLVED_ON_SELF: { moment: null, resume: { kind: 'NOTHING' } },
  MOVEMENT: { moment: null, resume: { kind: 'NOTHING' } }
} as const satisfies Record<ReactionTriggerKind, ReactionTriggerRow>

/** The registry row of the reaction trigger an invocation authors; null when it authors none. */
export function reactionTriggerRow(invocation: object | null): ReactionTriggerRow | null {
  const trigger =
    invocation && 'reactionTrigger' in invocation ? invocation.reactionTrigger : undefined
  return typeof trigger === 'object' &&
    trigger !== null &&
    'kind' in trigger &&
    typeof trigger.kind === 'string' &&
    Object.hasOwn(REACTION_TRIGGERS, trigger.kind)
    ? REACTION_TRIGGERS[trigger.kind as ReactionTriggerKind]
    : null
}
