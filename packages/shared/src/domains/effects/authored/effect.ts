import type {
  CheckAuthored,
  OutcomeAuthored,
  SavingThrowAuthored,
  EffectPathAuthored,
  RangeAuthored,
  ShapeAuthored,
  TargetingAuthored
} from '#authored'
import type { ACTIVATION_CODE, AbilityModifierReference, ActivationCode, Trigger } from '#core'
import type { PathCode } from '../core/path.js'

export const EFFECT_INVOCATION_KIND = {
  ACTION: 'ACTION',
  PASSIVE: 'PASSIVE'
} as const

export type EffectInvocationKind = keyof typeof EFFECT_INVOCATION_KIND

export type ActivationAuthored =
  | {
      code: typeof ACTIVATION_CODE.FREE
    }
  | {
      code: Exclude<ActivationCode, typeof ACTIVATION_CODE.FREE>
      amount: number
    }

export type ResourceUseAuthored = {
  chargeId: string
  cost: number
}

/**
 * Makes a passive on-hit rider the attacker's choice: after a hit the player may pay this cost to
 * add the rider's damage to it. A spell slot lets the player pick the slot level, which keys the
 * rider's `SPELL_CAST_LEVEL` rows (D118, D123).
 */
export type OptionalOnHitAuthored = { kind: 'SPELL_SLOT' }

export type ReactionMovementTriggerBindingAuthored = {
  kind: 'MOVEMENT'
  stage: 'BEFORE_LEAVE_REACH' | 'ENTER_REACH'
  perceptionRequirement: 'DETECT' | 'LOCATE' | 'PRECISE' | 'SEE' | null
  eligibilityDefinitionId: string
  movementInterruption?: null | { kind: 'STOP'; whenResultPath: PathCode }
}

/** The reactor is the target of an attack that hit; the reaction pauses the attack's outcome. */
export type ReactionAttackedSelfTriggerBindingAuthored = { kind: 'ATTACKED_SELF' }

/**
 * A cast of a spell level above the reaction's own cast level takes effect unless the reactor's
 * ability check beats a DC of `baseDc` plus the triggering cast's level; a cast at or below the
 * reaction's own level needs no check. The check is the reactor's, made with `ability` as its modifier.
 */
export type ReactionHigherLevelCheckAuthored = {
  ability: AbilityModifierReference
  baseDc: number // int
}

/**
 * A creature within the reaction's range begins casting a spell; the reaction pauses the cast before
 * it takes effect. Without `higherLevelCheck` it counters a cast of any level.
 */
export type ReactionSpellCastTriggerBindingAuthored = {
  kind: 'SPELL_CAST'
  higherLevelCheck?: ReactionHigherLevelCheckAuthored
}

/**
 * The reactor takes damage of one of the named damage types from an attack that hit; the reaction
 * pauses the attack's outcome so what it grants applies to that damage.
 */
export type ReactionDamageTakenTriggerBindingAuthored = {
  kind: 'DAMAGE_TAKEN'
  damageTypeIds: string[]
}

export type ReactionTriggerBindingAuthored =
  | ReactionMovementTriggerBindingAuthored
  | ReactionAttackedSelfTriggerBindingAuthored
  | ReactionSpellCastTriggerBindingAuthored
  | ReactionDamageTakenTriggerBindingAuthored

type ReactionActivationAuthored = {
  code: typeof ACTIVATION_CODE.REACTION
  amount: number
}

type ActionReactionTriggerBindingAuthored =
  | { reactionTrigger?: never }
  | {
      activation: ReactionActivationAuthored
      reactionTrigger: ReactionTriggerBindingAuthored
    }

export type ActionEffectInvocationAuthored<TTrigger extends Trigger = Trigger> =
  | ((
      | {
          kind?: typeof EFFECT_INVOCATION_KIND.ACTION
          triggerCode: Extract<TTrigger, 'SAVING_THROW'>
          savingThrow: SavingThrowAuthored
          activation: ActivationAuthored
          resourceUse?: ResourceUseAuthored
          range: RangeAuthored
          shape?: ShapeAuthored
          targeting?: TargetingAuthored
        }
      | {
          kind?: typeof EFFECT_INVOCATION_KIND.ACTION
          triggerCode: Exclude<TTrigger, 'SAVING_THROW' | 'CHECK'>
          activation: ActivationAuthored
          resourceUse?: ResourceUseAuthored
          range: RangeAuthored
          shape?: ShapeAuthored
          targeting?: TargetingAuthored
        }
    ) &
      ActionReactionTriggerBindingAuthored)
  | {
      kind?: typeof EFFECT_INVOCATION_KIND.ACTION
      triggerCode: Extract<TTrigger, 'CHECK'>
      check: CheckAuthored
      activation: ActivationAuthored
      resourceUse?: ResourceUseAuthored
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
      reactionTrigger?: never
    }

export type PassiveEffectInvocationAuthored<TTrigger extends Trigger = Trigger> =
  | {
      kind: typeof EFFECT_INVOCATION_KIND.PASSIVE
      triggerCode: Extract<TTrigger, 'SAVING_THROW'>
      savingThrow: SavingThrowAuthored
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
    }
  | {
      kind: typeof EFFECT_INVOCATION_KIND.PASSIVE
      triggerCode: Exclude<TTrigger, 'SAVING_THROW' | 'CHECK'>
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
      optionalOnHit?: OptionalOnHitAuthored
    }

export type EffectInvocationAuthored<TTrigger extends Trigger = Trigger> =
  | ActionEffectInvocationAuthored<TTrigger>
  | PassiveEffectInvocationAuthored<TTrigger>

export type EffectAuthored<
  TTrigger extends Trigger = Trigger,
  TOutcome extends OutcomeAuthored = OutcomeAuthored
> = {
  id: string
  order: number // int
  invocation: EffectInvocationAuthored<TTrigger>
  paths: EffectPathAuthored<TTrigger, TOutcome>[]
}
