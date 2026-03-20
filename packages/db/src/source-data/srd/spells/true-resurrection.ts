import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const trueResurrection: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.TRUE_RESURRECTION,
  label: 'True Resurrection',
  description:
    'You restore a creature that has been dead for no longer than 200 years to full life, even recreating its body if necessary, so long as its soul is free and willing.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
  level: 9,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  magicSchoolId: schoolId('NECROMANCY'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.TRUE_RESURRECTION, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.TRUE_RESURRECTION, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch the creature whose life you intend to restore.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.TRUE_RESURRECTION, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'True Resurrection',
          description:
            'The creature returns to life if its soul is free and willing, even if a new body must be recreated.'
        }
      ]
    }
  ],
  materialDescription: 'a sprinkle of holy water and diamonds worth at least 25,000 gp, which the spell consumes',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
