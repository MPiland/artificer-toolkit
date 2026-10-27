import type { DamageAuthored } from './damage.js'
import type { ConditionAuthored } from './condition.js'
import type { ActivationAuthored } from './effect.js'
import type { CheckChoiceAuthored, EscapeDcAuthored } from './check.js'
import type { ForcedMovementAuthored } from './forcedMovement.js'
import type { PathLifecycleTurnAnchorAuthored } from './path.js'
import type { AttackSlotCondition, SavingThrowAuthored } from '#authored'
import { EFFECT_KIND, type LengthUnitCode } from '#core'

export type ActorRelationshipModuleAuthored =
  | { id: string; order: number; kind: 'TARGET_SIZE_MAXIMUM'; sizeCode: string }
  | {
      id: string
      order: number
      kind: 'SOURCE_ACTION_TARGET_RESTRICTION'
      actionEffectIds: string[]
    }
  | {
      id: string
      order: number
      kind: 'SOURCE_ATTACK_ROLL_INFLUENCE'
      /** The attack action effects it influences; an empty list influences every attack against the target. */
      actionEffectIds: string[]
      /** A code from the System's roll-influence vocabulary. */
      influence: string
    }
  | { id: string; order: number; kind: 'SOURCE_FOLLOWS_TARGET' }
  | { id: string; order: number; kind: 'SOURCE_OCCUPIES_HAND' }
  | { id: string; order: number; kind: 'SOURCE_INDEPENDENT_HOLD' }
  | { id: string; order: number; kind: 'TARGET_DRAGGED' }
  | {
      id: string
      order: number
      kind: 'SOURCE_RELEASE_MOVEMENT_COST'
      amount: number
      unit: LengthUnitCode
    }
  | {
      id: string
      order: number
      kind: 'ESCAPE_CHECK'
      activation: ActivationAuthored
      checks: CheckChoiceAuthored
      dc: EscapeDcAuthored
      actorKinds: Array<'TARGET' | 'CREATURE_WITHIN_REACH'>
      /** Where a won escape moves the hold's source, pushed by the escaper. */
      holderForcedMovement?: ForcedMovementAuthored
    }
  | {
      id: string
      order: number
      kind: 'TARGET_CAPABILITY_SUPPRESSION'
      capabilityDefinitionIds: string[]
    }
  | {
      id: string
      order: number
      kind: 'CONDITIONAL_TARGET_STATE'
      /** A code from the System's roll-mode vocabulary. */
      whenResolvedAttackD20Mode: string
      conditionIds: string[]
      capabilityDefinitionIds: string[]
    }

export type ActorRelationshipAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.ACTOR_RELATIONSHIP
  /** The most creatures this outcome holds at once, counted per outcome (D105). */
  heldAtOnce: number
  /** The hold applies only while this predicate holds over the open Attack action; absent, always. */
  appliesWhen?: AttackSlotCondition
  modules: ActorRelationshipModuleAuthored[]
  /** Existing condition documents owned by this target relationship. */
  conditions?: ConditionAuthored[]
  /**
   * The outcome the held creature suffers at each counted turn boundary while the hold stands, never
   * an immediate hit outcome: damage, or hit points lost directly (no damage type). With a saving
   * throw, only when it fails that save. The hold stands either way.
   */
  recurrence?: {
    turnAnchor: PathLifecycleTurnAnchorAuthored
    savingThrow?: SavingThrowAuthored
    outcome: DamageAuthored | { id: string; effectKind: 'HIT_POINT_LOSS'; diceConfig: string }
  }
}
