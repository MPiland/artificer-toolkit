import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const purifyFoodAndDrink: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PURIFY_FOOD_AND_DRINK,
  label: 'Purify Food and Drink',
  description:
    'All nonmagical food and drink within a 5-foot-radius sphere centered on a point of your choice within range is purified and rendered free of poison and disease.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.PALADIN],
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.PURIFY_FOOD_AND_DRINK, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PURIFY_FOOD_AND_DRINK, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 10,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose a point within range; nonmagical food and drink in the 5-foot-radius sphere are purified.'
        },
        shape: {
          id: spellChildId(SPELL_IDS.PURIFY_FOOD_AND_DRINK, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 5,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.PURIFY_FOOD_AND_DRINK, 0x213, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Purify Food and Drink',
          description:
            'Purifies nonmagical food and drink in the area, removing poison and disease under the spell’s full SRD rules.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
