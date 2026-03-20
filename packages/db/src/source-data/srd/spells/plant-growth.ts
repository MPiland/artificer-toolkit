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

export const plantGrowth: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PLANT_GROWTH,
  label: 'Plant Growth',
  description:
    'This spell channels vitality into plants within a specific area. If you cast it using 1 action, normal plants in a 100-foot radius become thick and overgrown; if you cast it over 8 hours, you enrich the land for 1 year.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.RANGER],
  magicSchoolId: schoolId('TRANSMUTATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 150,
          unit: 'FEET'
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose a point within range where plants grow thick and overgrown.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x213, 1),
            durationKind: DURATION_KIND.INSTANTANEOUS
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Plant Growth',
          description:
            'The chosen area is affected under the spell’s normal growth rules, but the alternate 8-hour enrichment mode remains a rules fallback.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
