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
import { actionEconomyCapabilityRegistry } from './platformPolicyModules.js'
import {
  encounterAttackActionState,
  snapshotFeatureDefinitions,
  withEncounterAttackActionState
} from './encounterActorState.js'
import {
  attackSlotTotal,
  evaluateAttackSlots,
  isAttackSlotFiller,
  type AttackSlotAttack
} from './encounterAttackSlots.js'
import {
  evaluateEncounterActionEconomy,
  isActionEconomySuppressed,
  type ActionEconomyInput
} from './encounterActionEconomy.js'

/** The attack the actor makes: the action it chose and the actor it targets. */
type EncounterAttackMade = EncounterAttackActionStateDto['attacks'][number]

/**
 * Where an attack stands in its actor's Attack action. In Assisted mode the first attack of a turn
 * spends the Action and opens the Attack action with its slots: one alternative of attacks per Attack
 * action, plus the alternatives of the actor's Multiattack Features (D93). The next attacks fill a
 * slot of a still-fitting alternative without spending another Action or warning that it is spent. An
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
    alternatives: EncounterAttackActionStateDto['alternatives']
    /** The attacks of this Attack action made before this one. */
    attacksMade: EncounterAttackMade[]
    /** Whether the action is an Attack-action attack rather than a Feature that only fills a slot. */
    attack: boolean
  } | null
  /**
   * A filler attack by an actor whose Action capability is suppressed (Incapacitated, an effect).
   * It spends nothing, but the caller warns that the actor can't act, as for any suppressed Action.
   */
  suppressed: boolean
  /** The attack ("2 of 3") this action would make; null when it would break the Action rule. */
  slot: { number: number; total: number } | null
  /**
   * An open Attack action still has a slot to fill and this action fills none of them: the drawer
   * does not offer it (D93).
   */
  blocked: boolean
}

/** The slot alternatives a Creature's Multiattack Features author. */
export function creatureAttackSlotAlternatives(
  actor: Parameters<typeof snapshotFeatureDefinitions>[0]
) {
  return snapshotFeatureDefinitions(actor).flatMap(
    (feature) => feature.attackSlots?.alternatives ?? []
  )
}

function slotAttack(attack: EncounterAttackMade): AttackSlotAttack {
  return {
    featureId: attack.featureId ?? null,
    attack: attack.attack,
    targetIds: attack.targetIds,
    hit: attack.hit ?? null,
    targetSize: attack.targetSize ?? null
  }
}

export async function evaluateEncounterAttackAction(
  input: ActionEconomyInput & {
    triggerCode: string
    /** The action takes the place of one attack of the Attack action (D152). */
    replacesAttack?: boolean
    /** The Creature Feature the action runs. */
    featureId?: string
    /** The creatures the action targets and their size, when known: a slot's predicates read them. */
    targetIds?: readonly string[]
    targetSize?: string | null
  }
): Promise<EncounterAttackActionEvaluation> {
  const { actor, state } = input
  const creatureAlternatives = creatureAttackSlotAlternatives(actor)
  const economyPolicy = actionEconomyCapabilityRegistry.require(state.gameSystemId)
  const attack = economyPolicy.isAttackActionAttack({
    activationKind: input.activation.code,
    activationAmount: input.activation.amount,
    triggerCode: input.triggerCode,
    replacesAttack: input.replacesAttack ?? false
  })
  const tracked =
    state.automationMode !== 'MANUAL' &&
    (attack ||
      (input.featureId !== undefined &&
        isAttackSlotFiller(creatureAlternatives, input.featureId) &&
        economyPolicy.spendsAttackAction({
          activationKind: input.activation.code,
          activationAmount: input.activation.amount
        })))
  if (!tracked)
    return {
      economy: await evaluateEncounterActionEconomy(input),
      attackAction: null,
      suppressed: false,
      slot: null,
      blocked: false
    }
  const before = encounterAttackActionState(actor)
  const target = input.target ?? (await input.loadTarget())
  const cap = target
    ? activeCapValueGrantMinimum(target.activeEffects, 'ATTACKS_PER_ATTACK_ACTION')
    : null
  const candidate: AttackSlotAttack = {
    featureId: input.featureId ?? null,
    attack,
    targetIds: input.targetIds ?? [],
    hit: null,
    targetSize: input.targetSize ?? null
  }
  const totalOf = (alternatives: EncounterAttackActionStateDto['alternatives']) => {
    const total = attackSlotTotal(alternatives)
    return cap === null ? total : Math.min(total, cap)
  }
  if (
    before &&
    before.turnSequence === state.turnSequence &&
    encounterAttackActionFits(state.gameSystemId, before, candidate, cap)
  ) {
    const suppressed = await isActionEconomySuppressed(input)
    return {
      economy: null,
      attackAction: {
        before,
        turnSequence: before.turnSequence,
        alternatives: before.alternatives,
        attacksMade: before.attacks,
        attack
      },
      suppressed,
      slot: suppressed
        ? null
        : { number: before.attacks.length + 1, total: totalOf(before.alternatives) },
      blocked: false
    }
  }
  const blocked =
    before !== null &&
    before.turnSequence === state.turnSequence &&
    encounterAttackActionStanding(state.gameSystemId, before).incomplete
  const alternatives = [
    {
      slots: [
        {
          count: target?.effectiveRulePolicyOutput?.attacksPerAttackAction ?? 1,
          fillers: [{ kind: 'ANY_ATTACK' as const }]
        }
      ]
    },
    ...creatureAlternatives
  ]
  // A Feature that only fills slots opens an Attack action only when a slot of its own takes it first.
  if (!encounterAttackActionFits(state.gameSystemId, { alternatives, attacks: [] }, candidate, cap))
    return {
      economy: await evaluateEncounterActionEconomy(input),
      attackAction: null,
      suppressed: false,
      slot: null,
      blocked
    }
  const economy = await evaluateEncounterActionEconomy({ ...input, target })
  return {
    economy,
    attackAction: {
      before,
      turnSequence: state.turnSequence,
      alternatives,
      attacksMade: [],
      attack
    },
    suppressed: false,
    slot: economy?.available ? { number: 1, total: totalOf(alternatives) } : null,
    blocked
  }
}

/** Where the open Attack action stands after the attacks made so far (D93). */
export function encounterAttackActionStanding(
  gameSystemId: string,
  state: Pick<EncounterAttackActionStateDto, 'alternatives' | 'attacks'>
) {
  return evaluateAttackSlots(gameSystemId, state.alternatives, state.attacks.map(slotAttack))
}

/**
 * Whether the next attack still fills a slot of the Attack action. An active cap on attacks per
 * Attack action (Slowing Breath) limits the attacks even of one already open.
 */
export function encounterAttackActionFits(
  gameSystemId: string,
  state: Pick<EncounterAttackActionStateDto, 'alternatives' | 'attacks'>,
  next: AttackSlotAttack,
  cap: number | null
) {
  return (
    (cap === null || state.attacks.length < cap) &&
    evaluateAttackSlots(gameSystemId, state.alternatives, [...state.attacks.map(slotAttack), next])
      .fits
  )
}

/**
 * The attacks made before the one a transition adds, and that attack, as a predicate over the open
 * Attack action reads them (a hold gated by `appliesWhen`, D93).
 */
export function encounterAttackActionAttacks(transition: EncounterAttackActionTransitionDto) {
  const made = transition.after.attacks
  const current = made[made.length - 1]
  return current
    ? { earlier: made.slice(0, -1).map(slotAttack), current: slotAttack(current) }
    : null
}

/** Records the outcome of the attack roll on the attack a transition adds. */
export function settleEncounterAttackActionHit(
  transition: EncounterAttackActionTransitionDto,
  hit: boolean | null
): EncounterAttackActionTransitionDto {
  if (hit === null) return transition
  const { attacks } = transition.after
  return {
    ...transition,
    after: {
      ...transition.after,
      attacks: attacks.map((made, index) =>
        index === attacks.length - 1 ? { ...made, hit } : made
      )
    }
  }
}

/** The change one attack makes to its actor's Attack action. */
export function encounterAttackActionTransition(
  attackAction: NonNullable<EncounterAttackActionEvaluation['attackAction']>,
  made: Omit<EncounterAttackMade, 'attack' | 'hit'>
): EncounterAttackActionTransitionDto {
  return {
    before: attackAction.before,
    after: {
      kind: 'ATTACK_ACTION',
      turnSequence: attackAction.turnSequence,
      alternatives: attackAction.alternatives,
      attacks: [...attackAction.attacksMade, { ...made, attack: attackAction.attack }]
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
