import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const web: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.WEB,
  label: 'Web',
  description:
    'You conjure a mass of thick, sticky webbing at a point you choose within range. The webs fill a 20-foot cube from that point for the duration and can restrain creatures trapped in them.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.WEB, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.WEB, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.WEB, 0x212, 1),
          shapeKind: SHAPE_KIND.CUBE,
          edgeLength: {
            amount: 20,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        },
        targeting: {
          selectionKind: 'AREA_CONTENTS',
          detail: 'Choose a point within range and fill a 20-foot cube with sticky webbing.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.WEB, 0x213, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.WEB, 0x214, 1),
            durationKind: 'HOUR',
            amount: 1
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.ZONE,
          label: 'Web',
          detail:
            'Creates a zone of sticky webbing that is difficult terrain and can restrain creatures that enter or begin their turn in it.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
