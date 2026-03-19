import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const mirageArcane: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MIRAGE_ARCANE,
  label: 'Mirage Arcane',
  description:
    'You make terrain in an area up to 1 mile square look, sound, smell, and even feel like some other sort of terrain. The terrain\'s general shape remains the same, however.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
  level: 7,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ILLUSION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.MIRAGE_ARCANE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MIRAGE_ARCANE, 0x201, 1),
          rangeKind: RANGE_KIND.SIGHT
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose the terrain you can see to alter.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.MIRAGE_ARCANE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.MIRAGE_ARCANE, 0x202, 1),
            durationKind: DURATION_KIND.DAY,
            amount: 10
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.ZONE,
          label: 'Mirage Arcane',
          detail:
            'Creates an illusory terrain zone whose general shape remains the same while its appearance changes.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
