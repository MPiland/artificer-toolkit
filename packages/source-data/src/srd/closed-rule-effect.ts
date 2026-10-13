import { v5 as uuidv5 } from 'uuid'

import {
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  TRIGGER,
  type ClosedRuleKind
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
      return PATH_CODE.PASSIVE
    case TRIGGER.ACTIVATED:
      return PATH_CODE.ON_USE
    case TRIGGER.CHECK:
      return PATH_CODE.ON_CHECK_SUCCESS
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
