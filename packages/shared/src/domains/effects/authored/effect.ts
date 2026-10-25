import type {
  CheckAuthored,
  OutcomeAuthored,
  SavingThrowAuthored,
  EffectPathAuthored,
  RangeAuthored,
  ShapeAuthored,
  TargetingAuthored
} from '#authored'
import type { ACTIVATION_CODE, ActivationCode, Trigger } from '#core'
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
 * rider's `SPELL_CAST_LEVEL` rows (D118, D123). A resource pool charge spends `cost` of the charge
 * `chargeId` names, as an action's `resourceUse` does.
 */
export type OptionalOnHitAuthored =
  | { kind: 'SPELL_SLOT' }
  | ({ kind: 'RESOURCE_POOL' } & ResourceUseAuthored)

export type ReactionMovementTriggerBindingAuthored = {
  kind: 'MOVEMENT'
  stage: 'BEFORE_LEAVE_REACH' | 'ENTER_REACH'
  perceptionRequirement: 'DETECT' | 'LOCATE' | 'PRECISE' | 'SEE' | null
  eligibilityDefinitionId: string
  movementInterruption?: null | { kind: 'STOP'; whenResultPath: PathCode }
}

/**
 * The reactor is the target of an attack that hit; the reaction pauses the attack's outcome. With
 * `attackRange: 'MELEE'` it answers only a melee attack, and with `requiresSight` only an attacker the
 * reactor sees (Parry).
 */
export type ReactionAttackedSelfTriggerBindingAuthored = {
  kind: 'ATTACKED_SELF'
  attackRange?: 'MELEE'
  requiresSight?: boolean
}

/**
 * A cast of a spell level above the reaction's own cast level takes effect unless the reactor's
 * ability check beats a DC of `baseDc` plus the triggering cast's level; a cast at or below the
 * reaction's own level needs no check. The check is the reactor's, made with `ability` as its modifier.
 */
export type ReactionHigherLevelCheckAuthored = {
  ability: string
  baseDc: number // int
}

/**
 * A creature within the reaction's range begins casting a spell; the reaction pauses the cast before
 * it takes effect. Without `higherLevelCheck` it counters a cast only at or below the level it is cast at.
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

/**
 * The reactor is a chosen target of an action cast on chosen creatures or an area, before that action
 * resolves. `sourceEffectIds` narrows it to actions owned by the named authored content (a Spell,
 * Feature, Option, Feat or equipment id); empty or absent means any such action.
 */
export type ReactionTargetedSelfTriggerBindingAuthored = {
  kind: 'TARGETED_SELF'
  sourceEffectIds?: string[]
}

export type ReactionTriggerBindingAuthored =
  | ReactionMovementTriggerBindingAuthored
  | ReactionAttackedSelfTriggerBindingAuthored
  | ReactionSpellCastTriggerBindingAuthored
  | ReactionDamageTakenTriggerBindingAuthored
  | ReactionTargetedSelfTriggerBindingAuthored

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
          triggerCode: Exclude<
            TTrigger,
            | 'SAVING_THROW'
            | 'CHECK'
            | 'INCOMING_DAMAGE'
            | 'HP_ZERO'
            | 'INCOMING_WEAPON_HIT'
            | 'ROLL_INITIATIVE'
            | 'START_OF_TURN'
          >
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
      triggerCode: Extract<TTrigger, 'SAVING_THROW' | 'HP_ZERO'>
      savingThrow: SavingThrowAuthored
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
    }
  | {
      kind: typeof EFFECT_INVOCATION_KIND.PASSIVE
      triggerCode: Exclude<TTrigger, 'SAVING_THROW' | 'CHECK' | 'INCOMING_DAMAGE' | 'HP_ZERO'>
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
      optionalOnHit?: OptionalOnHitAuthored
      /** The sibling Feature whose attacks alone this rider rides; absent, it rides every attack its trigger names. */
      ridesFeatureId?: string
    }
  /**
   * The holder takes damage of one of the named damage types; the passive's PASSIVE path then
   * answers on the holder (a timed grant on itself), once per damaging event.
   */
  | {
      kind: typeof EFFECT_INVOCATION_KIND.PASSIVE
      triggerCode: Extract<TTrigger, 'INCOMING_DAMAGE'>
      damageTypeIds: string[]
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
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
