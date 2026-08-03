import {
  ACTIVATION_CODE,
  AUTHORING_CONSTRAINT,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  type ClosedRuleKind,
  type EffectAuthored,
  type FeatAuthored
} from '@artificer-toolkit/shared'
import { FEAT_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

// Domain 0050 — format: 00000000-0000-0000-0050-NNNN00000000
function featId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0050-${hex}00000000`
}

function grapplerRuleEffect(
  bucket: number,
  ruleKind: ClosedRuleKind,
  action = false
): EffectAuthored {
  return {
    id: featId(bucket),
    order: 1,
    invocation: action
      ? {
          kind: 'ACTION',
          triggerCode: TRIGGER.ACTIVATED,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: featId(bucket + 1), rangeKind: RANGE_KIND.TOUCH },
          targeting: {
            selectionKind: 'SINGLE_TARGET',
            dispositionKind: TARGET_DISPOSITION_KIND.ANY
          }
        }
      : {
          kind: 'PASSIVE',
          triggerCode: TRIGGER.ACTIVATED,
          range: { id: featId(bucket + 1), rangeKind: RANGE_KIND.SELF }
        },
    paths: [
      {
        id: featId(bucket + 2),
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${featId(bucket + 2)}__result`,
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: featId(bucket + 3),
              effectKind: EFFECT_KIND.CLOSED_RULE,
              ruleKind
            }
          ]
        }
      }
    ]
  }
}

export const grappler: FeatAuthored = {
  id: FEAT_IDS.GRAPPLER,
  label: 'Grappler',
  description:
    "You've developed the skills necessary to hold your own in close-quarters grappling. You gain the following benefits:",
  prerequisites: {
    id: featId(0x11f0),
    groups: [
      {
        id: featId(0x11f1),
        order: 0,
        contexts: [
          {
            id: featId(0x11f2),
            order: 0,
            subject: 'CHARACTER',
            conditions: [
              {
                id: featId(0x11f3),
                order: 0,
                kind: 'PREDICATE',
                constraint: AUTHORING_CONSTRAINT.INCLUDE,
                predicateCode: 'ABILITY_SCORE',
                authoringModeKind: 'SELECTED',
                abilities: 'STRENGTH',
                min: 13
              }
            ]
          }
        ]
      }
    ]
  },
  features: [
    {
      id: featId(0x1101),
      label: 'Advantage on Grappled Target',
      description: 'You have advantage on attack rolls against a creature you are grappling.',
      effects: [grapplerRuleEffect(0x1200, 'GRAPPLER_ADVANTAGE_ON_GRAPPLED_TARGET')],
      order: 0
    },
    {
      id: featId(0x1102),
      label: 'Pin',
      description:
        'You can use your action to try to pin a creature grappled by you. To do so, make another grapple check. If you succeed, you and the creature are both restrained until the grapple ends.',
      effects: [grapplerRuleEffect(0x1210, 'GRAPPLER_PIN', true)],
      order: 1
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
