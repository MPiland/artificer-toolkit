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

export const reincarnate: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.REINCARNATE,
  label: 'Reincarnate',
  description:
    'You touch a dead humanoid and form a new adult body for it, calling the soul back to life in a randomly determined new race if the soul is free and willing.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.DRUID],
  magicSchoolId: schoolId('TRANSMUTATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.REINCARNATE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.REINCARNATE, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch the dead humanoid whose soul will be called back.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.REINCARNATE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Reincarnate',
          description:
            'The soul returns to life in a new adult body with a randomly determined race, provided the soul is free and willing.'
        }
      ]
    }
  ],
  materialDescription: 'rare oils and unguents worth at least 1,000 gp, which the spell consumes',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
