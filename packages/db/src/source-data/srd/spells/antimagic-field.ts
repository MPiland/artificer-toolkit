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
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const antimagicField: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ANTIMAGIC_FIELD,
  label: 'Antimagic Field',
  description:
    'A 10-foot-radius invisible sphere of antimagic surrounds you. This area is divorced from the magical energy that suffuses the multiverse. Within the sphere, spells can\'t be cast, summoned creatures disappear, and even magic items become mundane.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 8,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ABJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.ANTIMAGIC_FIELD, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ANTIMAGIC_FIELD, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF,
          detail: 'Create the antimagic sphere centered on yourself.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.ANTIMAGIC_FIELD, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.ANTIMAGIC_FIELD, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 1
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.ZONE,
          label: 'Antimagic Field',
          detail: 'Creates a 10-foot-radius sphere in which magic is suppressed.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
