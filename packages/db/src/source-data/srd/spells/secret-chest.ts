import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  DURATION_KIND,
  MANIFEST_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const secretChest: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SECRET_CHEST,
  label: 'Secret Chest',
  description:
    'You hide a chest, and all its contents, on the Ethereal Plane. You must touch the chest and the miniature replica that serves as a material component for the spell.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.SECRET_CHEST, 0x201, 1),
    rangeKind: RANGE_KIND.TOUCH
  },
  duration: {
    id: spellChildId(SPELL_IDS.SECRET_CHEST, 0x202, 1),
    durationKind: DURATION_KIND.INSTANTANEOUS
  },
  level: 4,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('CONJURATION'),
  materialDescription:
    'an exquisite chest worth at least 5,000 gp and a Tiny replica made from the same materials worth at least 50 gp',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.SECRET_CHEST, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SECRET_CHEST, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch the chest and its miniature replica.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.SECRET_CHEST, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.OBJECT,
          label: 'Secret Chest',
          detail:
            'Hides the chest and its contents on the Ethereal Plane until the spell is reversed.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
