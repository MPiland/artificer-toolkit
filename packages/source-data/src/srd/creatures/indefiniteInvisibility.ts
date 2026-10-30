import { conditionTypeId } from '../equipment/shared.js'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '../concentration.js'
import * as S from './shared.js'

/**
 * A creature trait that turns the creature invisible with no duration: it ends when the creature
 * attacks or casts a spell (its `END` lifecycle triggers) or when its Concentration ends (the maintained state).
 * Built only from core options.
 */
export function indefiniteInvisibilityEffect(input: {
  effectId: string
  rangeId: string
  pathId: string
  endTriggers: readonly {
    event: 'LIFECYCLE'
    timing: 'END'
    code: 'ON_ATTACK_ROLL' | 'ON_CAST_SPELL'
  }[]
}) {
  return {
    id: input.effectId,
    order: 1,
    invocation: {
      kind: 'ACTION' as const,
      triggerCode: S.TRIGGER.ACTIVATED,
      activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: input.rangeId, rangeKind: S.RANGE_KIND.SELF },
      targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
    },
    paths: [
      {
        id: input.pathId,
        order: 1,
        pathCode: S.PATH_CODE.ON_USE,
        groupType: S.PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: input.pathId + '__result',
          resultKind: 'SINGLE' as const,
          maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
          lifecycle: { endTriggers: [...input.endTriggers] },
          outcomes: [
            {
              id: input.pathId,
              effectKind: S.EFFECT_KIND.CONDITION,
              conditionId: conditionTypeId('INVISIBLE')
            }
          ]
        }
      }
    ]
  }
}
