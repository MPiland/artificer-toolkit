import {
  ACTIVATION_CODE,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SCALING,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type ActorRelationshipAuthored,
  type FeatureAuthored
} from '@artificer-toolkit/shared'
import type { SizeCode } from '../sizes.js'
import { damageTypeId, grappledOutcome } from './shared.js'

/**
 * A swallow: the held creature is blinded and restrained, moves with the source, and takes
 * `diceConfig` `damageType` damage at the start of each of the SOURCE's turns (the holder-turn
 * phase). It layers on the source's own grapple, so it reuses that grapple's escape DC and omits
 * Grappled. It takes `grappledOutcome`'s IDs and `damageOutcomeId` for the damage.
 */
export function swallowedOutcome(
  creatureIndex: number,
  input: {
    localIndex: number
    damageOutcomeId: string
    escapeDc: number
    heldAtOnce: number
    largestTarget: SizeCode
    damageType: string
    diceConfig: string
  }
): ActorRelationshipAuthored {
  return grappledOutcome(creatureIndex, {
    localIndex: input.localIndex,
    escapeDc: input.escapeDc,
    heldAtOnce: input.heldAtOnce,
    largestTarget: input.largestTarget,
    omitGrappled: true,
    untilEnds: ['BLINDED', 'RESTRAINED'],
    recurrence: {
      turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' },
      outcome: {
        id: input.damageOutcomeId,
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: damageTypeId(input.damageType),
        valueKind: DAMAGE_VALUE_KIND.DICE,
        scalingKind: SCALING.NONE,
        diceConfig: input.diceConfig
      }
    }
  })
}

/**
 * An action that holds a creature the source already holds ("engulfs a creature grappled by it"):
 * no roll, a 5-foot reach and a `heldBySource` target, its `outcome` applied as soon as it is used.
 */
export function heldByUseEffect(input: {
  effectId: string
  rangeId: string
  pathId: string
  outcome: ActorRelationshipAuthored
}): NonNullable<FeatureAuthored['effects']>[number] {
  return {
    id: input.effectId,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: {
        id: input.rangeId,
        rangeKind: RANGE_KIND.DISTANCE,
        amount: 5,
        unit: MEASUREMENT_UNIT_CODE.FEET
      },
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.ANY,
        heldBySource: true
      }
    },
    paths: [
      {
        id: input.pathId,
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${input.pathId}__result`,
          resultKind: 'SINGLE',
          outcomes: [input.outcome]
        }
      }
    ]
  }
}
