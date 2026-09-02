import type { DamageAuthored } from './damage.js'
import type { ConditionAuthored } from './condition.js'
import type { ActivationAuthored } from './effect.js'
import { EFFECT_KIND, type MeasurementUnitCode } from '#core'

export type ActorRelationshipModuleAuthored =
  | { id: string; order: number; kind: 'TARGET_SIZE_MAXIMUM'; sizeCode: string }
  | { id: string; order: number; kind: 'SOURCE_EXCLUSIVE_TARGET'; maximum: 1 }
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
      actionEffectIds: string[]
      influence: 'ADVANTAGE'
    }
  | { id: string; order: number; kind: 'SOURCE_FOLLOWS_TARGET' }
  | {
      id: string
      order: number
      kind: 'SOURCE_RELEASE_MOVEMENT_COST'
      amount: number
      unit: MeasurementUnitCode
    }
  | {
      id: string
      order: number
      kind: 'ESCAPE_CHECK'
      activation: ActivationAuthored
      abilityDefinitionId: string
      fixedDc: number
      actorKinds: Array<'TARGET' | 'CREATURE_WITHIN_REACH'>
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
      whenResolvedAttackD20Mode: 'ADVANTAGE'
      conditionIds: string[]
      capabilityDefinitionIds: string[]
    }

export type ActorRelationshipAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.ACTOR_RELATIONSHIP
  modules: ActorRelationshipModuleAuthored[]
  /** Existing condition documents owned by this target relationship. */
  conditions?: ConditionAuthored[]
  /** A separate target-turn result block, never an immediate hit outcome. */
  recurrence?: { stage: 'START_OF_TURN'; damage: DamageAuthored }
}
