import { MAX_ACTIVE_EFFECT_TURNS } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import type { CompiledDuration, CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ATTEMPT_GATE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_TRIGGERS_ONLY_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_CONDITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  UUID
} from './effectActionContracts.js'

export type FollowUpSaveOutcome = Extract<
  Extract<CompiledEffectGroup['entries'][number], { outcome: unknown }>['outcome'],
  { effectKind: 'FOLLOW_UP_SAVE' }
>

const TURNS_PER_DURATION_UNIT: Partial<Record<CompiledDuration['durationKind'], number>> = {
  TURN: 1,
  ROUND: 1,
  MINUTE: 10,
  HOUR: 600,
  DAY: 14_400
}

/**
 * A condition's duration in the target's turns: "1 minute" ends after 10 of them (SRD 5.1). Null
 * for a duration the active-effect lifecycle cannot count (scaled, too long, or not timed).
 */
export function conditionDurationTurns(duration: CompiledDuration): number | null {
  const perUnit = TURNS_PER_DURATION_UNIT[duration.durationKind]
  if (
    perUnit === undefined ||
    !('amount' in duration) ||
    duration.scaling ||
    !Number.isSafeInteger(duration.amount) ||
    duration.amount < 1
  )
    return null
  const turns = duration.amount * perUnit
  return turns <= MAX_ACTIVE_EFFECT_TURNS ? turns : null
}

/**
 * The D&D facts an active effect's repeated save reads, wherever the authored save sits (the
 * action's own recurring save, a failed save's or a cast's follow-up, or a hit's nested save): the
 * ability, the pinned DC, the request node, and the held and escalating conditions plus the
 * perception rules the repeat honours. An exact fixed DC is stored in the plan, while the caster's
 * save DC is only known once the action is cast and is stored then, under the same fact. Null for
 * a save with no UUID ability or another way of setting its DC.
 */
export function dnd5eRepeatSave(input: {
  abilityDefinitionId: string | null | undefined
  savingThrow: { dcMethod: string; baseDc?: number } | undefined
  requestNodeId: string
  heldConditionIds?: readonly string[]
  escalationConditionId?: string
  repeatRollInfluence?: FollowUpSaveOutcome['repeatRollInfluence']
  repeatAttemptGate?: FollowUpSaveOutcome['repeatAttemptGate']
  /** The save is made only when a repeat trigger fires; the turn tick rolls none. */
  triggersOnly?: boolean
}): Pick<CharacterRuleActionActiveEffectPlan, 'adapterFacts' | 'castSaveDcFactKey'> | null {
  const { abilityDefinitionId, savingThrow, heldConditionIds = [] } = input
  const { repeatRollInfluence, repeatAttemptGate, escalationConditionId, triggersOnly } = input
  const casterDc = savingThrow?.dcMethod === 'SOURCE_SAVE_DC'
  const baseDc = savingThrow?.baseDc
  const fixedDc =
    savingThrow?.dcMethod === 'FIXED_DC' &&
    typeof baseDc === 'number' &&
    Number.isSafeInteger(baseDc)
  if ((!casterDc && !fixedDc) || !abilityDefinitionId || !UUID.test(abilityDefinitionId))
    return null
  return {
    adapterFacts: {
      [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: abilityDefinitionId,
      ...(fixedDc && { [DND5E_SAVE_DC_FACT_KEY]: baseDc }),
      [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: input.requestNodeId,
      ...(heldConditionIds.length > 0 && {
        [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_CONDITION_FACT_KEY]: heldConditionIds.join(',')
      }),
      ...(escalationConditionId !== undefined && {
        [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY]: escalationConditionId
      }),
      ...(repeatRollInfluence && {
        [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY]: repeatRollInfluence.influence,
        [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY]:
          repeatRollInfluence.when.requirement
      }),
      ...(triggersOnly && { [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_TRIGGERS_ONLY_FACT_KEY]: true }),
      ...(repeatAttemptGate && {
        [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ATTEMPT_GATE_FACT_KEY]: repeatAttemptGate.allow,
        [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY]:
          repeatAttemptGate.when.requirement
      })
    },
    castSaveDcFactKey: casterDc ? DND5E_SAVE_DC_FACT_KEY : null
  }
}
