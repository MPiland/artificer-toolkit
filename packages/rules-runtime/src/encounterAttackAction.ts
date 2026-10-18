import type {
  EncounterAttackActionStateDto,
  EncounterAttackActionTransitionDto
} from '@artificer-toolkit/schema/projections/encounterAttackAction'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { activeCapValueGrantMinimum } from './character/activeEffectGrantTotals.js'
import { actionEconomyCapabilityRegistry } from './actionEconomyCapabilityRegistry.default.js'
import {
  encounterAttackActionState,
  withEncounterAttackActionState
} from './encounterActorState.js'
import {
  evaluateEncounterActionEconomy,
  isActionEconomySuppressed,
  type ActionEconomyInput
} from './encounterActionEconomy.js'

/** The attack the actor makes: the action it chose and the actor it targets. */
type EncounterAttackMade = EncounterAttackActionStateDto['attacks'][number]

/**
 * Where an attack stands in its actor's Attack action. In Assisted mode the first attack of a turn
 * spends the Action and opens the Attack action; the next attacks of the same kind fill it, up to the
 * actor's attacks per Attack action, without spending another Action or warning that it is spent. An
 * attack that does not fit spends a new Action (warning when none is left) and opens a new Attack
 * action. Manual mode and every other action track nothing.
 */
type EncounterAttackActionEvaluation = {
  /** The Action this attack spends; null when it fills an open Attack action or tracks nothing. */
  economy: Awaited<ReturnType<typeof evaluateEncounterActionEconomy>>
  /** The Attack action this attack joins; null when the action is not tracked. */
  attackAction: {
    /** The state stored on the actor now, even a stale or complete one; undo restores it. */
    before: EncounterAttackActionStateDto | null
    turnSequence: number
    total: number
    /** The attacks of this Attack action made before this one. */
    attacksMade: EncounterAttackMade[]
  } | null
  /**
   * A filler attack by an actor whose Action capability is suppressed (Incapacitated, an effect).
   * It spends nothing, but the caller warns that the actor can't act, as for any suppressed Action.
   */
  suppressed: boolean
  /** The attack ("2 of 3") this action would make; null when it would break the Action rule. */
  slot: { number: number; total: number } | null
}

export async function evaluateEncounterAttackAction(
  input: ActionEconomyInput & {
    triggerCode: string
    /** The action takes the place of one attack of the Attack action (D152). */
    replacesAttack?: boolean
  }
): Promise<EncounterAttackActionEvaluation> {
  const { actor, state } = input
  const tracked =
    state.automationMode !== 'MANUAL' &&
    actionEconomyCapabilityRegistry.isAttackActionAttack({
      gameSystemId: state.gameSystemId,
      activationKind: input.activation.code,
      activationAmount: input.activation.amount,
      triggerCode: input.triggerCode,
      replacesAttack: input.replacesAttack ?? false
    })
  if (!tracked)
    return {
      economy: await evaluateEncounterActionEconomy(input),
      attackAction: null,
      suppressed: false,
      slot: null
    }
  const before = encounterAttackActionState(actor)
  const target = input.target ?? (await input.loadTarget())
  // An active cap (Slowing Breath) lowers what the Attack action allows, even one already open.
  const cap = target
    ? activeCapValueGrantMinimum(target.activeEffects, 'ATTACKS_PER_ATTACK_ACTION')
    : null
  const capped = (total: number) => (cap === null ? total : Math.min(total, cap))
  if (
    before &&
    before.turnSequence === state.turnSequence &&
    before.attacks.length < capped(before.total)
  ) {
    const suppressed = await isActionEconomySuppressed(input)
    const total = capped(before.total)
    return {
      economy: null,
      attackAction: {
        before,
        turnSequence: before.turnSequence,
        total,
        attacksMade: before.attacks
      },
      suppressed,
      slot: suppressed ? null : { number: before.attacks.length + 1, total }
    }
  }
  const economy = await evaluateEncounterActionEconomy({ ...input, target })
  const total = capped(target?.effectiveRulePolicyOutput?.attacksPerAttackAction ?? 1)
  return {
    economy,
    attackAction: {
      before,
      turnSequence: state.turnSequence,
      total,
      attacksMade: []
    },
    suppressed: false,
    slot: economy?.available ? { number: 1, total } : null
  }
}

/** The change one attack makes to its actor's Attack action. */
export function encounterAttackActionTransition(
  attackAction: NonNullable<EncounterAttackActionEvaluation['attackAction']>,
  attack: EncounterAttackMade
): EncounterAttackActionTransitionDto {
  return {
    before: attackAction.before,
    after: {
      kind: 'ATTACK_ACTION',
      turnSequence: attackAction.turnSequence,
      total: attackAction.total,
      attacks: [...attackAction.attacksMade, attack]
    }
  }
}

function sameAttackAction(
  left: EncounterAttackActionStateDto | null,
  right: EncounterAttackActionStateDto | null
) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

/** Writes the Attack action an attack settled; the actor must still hold the state it was planned on. */
export function applyEncounterAttackActionTransition(
  actor: EncounterRunActorState,
  transition: EncounterAttackActionTransitionDto
): EncounterRunActorState {
  if (!sameAttackAction(encounterAttackActionState(actor), transition.before))
    throw new Error("The actor's Attack action changed before settlement.")
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterAttackActionState(actor, transition.after)
  })
}

/** Restores the Attack action an undone attack changed; null when a later attack has changed it again. */
export function revertEncounterAttackActionTransition(
  actor: EncounterRunActorState,
  transition: EncounterAttackActionTransitionDto
): EncounterRunActorState | null {
  if (!sameAttackAction(encounterAttackActionState(actor), transition.after)) return null
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterAttackActionState(actor, transition.before)
  })
}
