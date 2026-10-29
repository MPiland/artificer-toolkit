import {
  DURATION_KIND,
  FOLLOW_UP_SAVE_TIMING,
  MANIFEST_KIND,
  SHAPE_KIND
} from '@artificer-toolkit/shared'
import type { EffectAuthored, FollowUpSaveAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'

import * as S from './shared.js'

type TurnAuraDuration =
  /** "Until the start of its next turn." */
  | { kind: 'UNTIL_NEXT_TURN_START' }
  /** "For 1 minute", repeating the save at the end of each of its turns. */
  | { kind: 'MINUTE'; repeatRollInfluence?: FollowUpSaveAuthored['repeatRollInfluence'] }

/**
 * A creature's start-of-turn save aura ("any creature that starts its turn within N feet of the
 * creature must make a DC save or ... ; on a success it is immune for 24 hours"): a passive zone on
 * the creature's token whose one component catches an occupant at the start of its turn, the way
 * the Balor's Fire Aura does. Who the aura spares, and any rider of the printed trait that the zone
 * does not model, stay in the Feature's description. It takes the IDs
 * `actionId(creatureIndex, localIndex + 0..20)`.
 */
export function startOfTurnSaveAuraEffect(
  creatureIndex: number,
  input: {
    localIndex: number
    label: string
    componentLabel: string
    radiusFeet: number
    abilityDefinitionId: string
    dc: number
    condition: 'FRIGHTENED' | 'POISONED'
    duration: TurnAuraDuration
    requiredSight?: ('OCCUPANT_SEES_SOURCE' | 'SOURCE_SEES_OCCUPANT')[]
  }
): EffectAuthored {
  const id = (offset: number) => S.actionId(creatureIndex, input.localIndex + offset)
  const savingThrow = (offset: number) => ({
    id: id(offset),
    dcMethod: 'FIXED_DC' as const,
    abilityDefinitionId: input.abilityDefinitionId,
    baseDc: input.dc
  })
  const shape = (offset: number) => ({
    id: id(offset),
    shapeKind: SHAPE_KIND.SPHERE,
    radius: { amount: input.radiusFeet, unit: S.MEASUREMENT_UNIT_CODE.FEET }
  })
  const condition = {
    id: id(12),
    effectKind: S.EFFECT_KIND.CONDITION,
    conditionId: conditionTypeId(input.condition),
    recordsSource: true
  } as const
  const failResult =
    input.duration.kind === 'UNTIL_NEXT_TURN_START'
      ? {
          id: `${id(9)}__result`,
          resultKind: 'SINGLE' as const,
          duration: { id: id(11), durationKind: DURATION_KIND.ROUND, amount: 1 },
          lifecycle: { turnAnchor: { actor: 'TARGET', boundary: 'START_OF_TURN' } } as const,
          outcomes: [condition]
        }
      : {
          id: `${id(9)}__result`,
          resultKind: 'SEQUENCE' as const,
          duration: { id: id(11), durationKind: DURATION_KIND.MINUTE, amount: 1 },
          outcomes: [
            condition,
            {
              id: id(13),
              effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
              timing: FOLLOW_UP_SAVE_TIMING.TARGET_TURN_END,
              savingThrow: savingThrow(14),
              attempts: { kind: 'ONCE', repeatOnFailure: true },
              ...(input.duration.repeatRollInfluence && {
                repeatRollInfluence: input.duration.repeatRollInfluence
              }),
              onSuccess: { kind: 'END' },
              onFailure: { kind: 'CONTINUE' }
            } satisfies FollowUpSaveAuthored
          ]
        }
  return {
    id: id(0),
    order: 1,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: S.TRIGGER.ACTIVATED,
      range: { id: id(1), rangeKind: S.RANGE_KIND.SELF },
      targeting: {
        selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
        dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
      },
      shape: shape(2)
    },
    paths: [
      {
        id: id(3),
        order: 1,
        pathCode: S.PATH_CODE.ON_USE,
        groupType: S.PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${id(3)}__result`,
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: id(4),
              effectKind: S.EFFECT_KIND.MANIFEST,
              manifestKind: MANIFEST_KIND.ZONE,
              attachmentKind: 'SOURCE',
              label: input.label,
              shape: shape(5),
              components: [
                {
                  id: id(6),
                  order: 1,
                  label: input.componentLabel,
                  interactionKinds: ['START_TURN_IN_SPACE'],
                  ...(input.requiredSight && { requiredSight: input.requiredSight }),
                  behaviors: [
                    {
                      id: id(7),
                      order: 1,
                      invocation: {
                        kind: 'PASSIVE',
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: savingThrow(8),
                        range: { id: id(10), rangeKind: S.RANGE_KIND.SELF }
                      },
                      paths: [
                        {
                          id: id(9),
                          order: 1,
                          pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                          groupType: S.PATH_GROUP_TYPE.SINGLE,
                          originKind: 'SOURCE',
                          selectionKind: 'FIXED',
                          resultBlock: failResult
                        },
                        S.saveImmunityPath(creatureIndex, input.localIndex + 15)
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    ]
  }
}
