import { v5 as uuidv5 } from 'uuid'

import {
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  TRIGGER,
  type ClosedRuleKind,
  type ManualAdjudicationReason
} from '@artificer-toolkit/shared/core'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'

const SRD_MECHANIC_NAMESPACE = '34679767-1f66-4d2e-a4f5-b585488fa835'

type ClosedRuleEffectConfig = {
  id: string
  invocation: EffectAuthored['invocation']
  order?: number
  pathCode?: NonNullable<EffectAuthored['paths']>[number]['pathCode']
  ruleKind: ClosedRuleKind
}

function mechanicId(effectId: string, kind: 'OUTCOME' | 'PATH' | 'RESULT'): string {
  return uuidv5(`${effectId}:${kind}`, SRD_MECHANIC_NAMESPACE)
}

function defaultPathCode(triggerCode: EffectAuthored['invocation']['triggerCode']) {
  switch (triggerCode) {
    case TRIGGER.MELEE_WEAPON_ATTACK:
    case TRIGGER.UNARMED_ATTACK:
    case TRIGGER.RANGED_WEAPON_ATTACK:
    case TRIGGER.MELEE_SPELL_ATTACK:
    case TRIGGER.RANGED_SPELL_ATTACK:
      return PATH_CODE.ON_HIT
    case TRIGGER.SAVING_THROW:
      return PATH_CODE.ON_SAVE_FAIL
    case TRIGGER.INCOMING_SAVING_THROW:
    case TRIGGER.ENTER_AREA:
    case TRIGGER.INCOMING_DAMAGE:
    case TRIGGER.HP_ZERO:
    case TRIGGER.INCOMING_WEAPON_HIT:
    case TRIGGER.ROLL_INITIATIVE:
    case TRIGGER.START_OF_TURN:
      return PATH_CODE.PASSIVE
    case TRIGGER.ACTIVATED:
      return PATH_CODE.ON_USE
    case TRIGGER.CHECK:
      return PATH_CODE.ON_CHECK_SUCCESS
  }
}

type ManualAdjudicationEffectConfig = Pick<ClosedRuleEffectConfig, 'id' | 'invocation'> & {
  label: string
  reasonCode: ManualAdjudicationReason
  instructions: string
}

/** A rider with no automated equivalent, shown to the GM as a ruling (D187a). */
export function manualAdjudicationEffect({
  id,
  invocation,
  label,
  reasonCode,
  instructions
}: ManualAdjudicationEffectConfig): EffectAuthored {
  return {
    id,
    order: 1,
    invocation,
    paths: [
      {
        id: mechanicId(id, 'PATH'),
        order: 1,
        pathCode: defaultPathCode(invocation.triggerCode),
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: mechanicId(id, 'RESULT'),
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: mechanicId(id, 'OUTCOME'),
              effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
              label,
              reasonCode,
              instructions
            }
          ]
        }
      }
    ]
  }
}

type GrantedActionOffers = NonNullable<
  NonNullable<
    NonNullable<EffectAuthored['paths']>[number]['resultBlock']['lifecycle']
  >['grantedActions']
>

/**
 * A passive trait that offers basic actions on every turn: a grant with no duration, so the offer
 * stands for as long as the creature has the trait (D160, standing granted actions).
 */
export function standingGrantedActionsEffect({
  id,
  invocation,
  grantedActions
}: Pick<ClosedRuleEffectConfig, 'id' | 'invocation'> & {
  grantedActions: GrantedActionOffers
}): EffectAuthored {
  return {
    id,
    order: 1,
    invocation,
    paths: [
      {
        id: mechanicId(id, 'PATH'),
        order: 1,
        pathCode: PATH_CODE.PASSIVE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: mechanicId(id, 'RESULT'),
          resultKind: 'SINGLE',
          lifecycle: { grantedActions },
          outcomes: [
            { id: mechanicId(id, 'OUTCOME'), effectKind: EFFECT_KIND.APPLY_GRANT, grants: {} }
          ]
        }
      }
    ]
  }
}

export function closedRuleEffect({
  id,
  invocation,
  order = 1,
  pathCode,
  ruleKind
}: ClosedRuleEffectConfig): EffectAuthored {
  return {
    id,
    order,
    invocation,
    paths: [
      {
        id: mechanicId(id, 'PATH'),
        order: 1,
        pathCode: pathCode ?? defaultPathCode(invocation.triggerCode),
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: mechanicId(id, 'RESULT'),
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: mechanicId(id, 'OUTCOME'),
              effectKind: EFFECT_KIND.CLOSED_RULE,
              ruleKind
            }
          ]
        }
      }
    ]
  }
}
