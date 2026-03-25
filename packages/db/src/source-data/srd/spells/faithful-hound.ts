import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const faithfulHound: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FAITHFUL_HOUND,
  label: 'Faithful Hound',
  description:
    'You conjure a phantom guardian in an unoccupied space you choose within range. The hound remains on guard and reacts to intruders while the spell lasts.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('CONJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 8
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.CREATURE,
          detail:
            'Creates a phantom guardian that watches the area, sounds an alarm to warn you of intruders, and reacts to unwanted creatures.',
          capabilities: [
            {
              id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x214, 1),
              order: 1,
              invocation: {
                triggerCode: TRIGGER.ENTER_AREA,
                activation: {
                  code: ACTIVATION_CODE.FREE
                },
                range: {
                  id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x215, 1),
                  rangeKind: RANGE_KIND.SPECIAL
                },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
                }
              },
              branches: [
                {
                  id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x216, 1),
                  branch: BRANCH.PASSIVE,
                  groupType: BRANCH_GROUP_TYPE.SINGLE,
                  resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
                  effectKind: EFFECT_KIND.RULE,
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
