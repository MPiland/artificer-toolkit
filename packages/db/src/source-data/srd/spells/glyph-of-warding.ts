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

export const glyphOfWarding: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.GLYPH_OF_WARDING,
  label: 'Glyph of Warding',
  description:
    'When you cast this spell, you inscribe a glyph that harms other creatures, either upon a surface or within an object that can be closed. If you choose a surface, the glyph can cover an area of the surface no larger than 10 feet in diameter.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ABJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.GLYPH_OF_WARDING, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GLYPH_OF_WARDING, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.GLYPH_OF_WARDING, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.GLYPH_OF_WARDING, 0x213, 1),
            durationKind: DURATION_KIND.UNTIL_DISPELLED
          },
          effectKind: EFFECT_KIND.RULE,
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
