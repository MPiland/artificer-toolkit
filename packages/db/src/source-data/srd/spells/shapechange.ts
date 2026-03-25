import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const shapechange: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SHAPECHANGE,
  label: 'Shapechange',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    'You assume the form of another creature for the duration and can adopt other eligible forms with your action while keeping your mental ability scores and certain class features.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 9,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  materialDescription: 'a jade circlet worth at least 1,500 gp, which you must place on your head before you cast the spell',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.SHAPECHANGE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SHAPECHANGE, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.SHAPECHANGE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.SHAPECHANGE, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
