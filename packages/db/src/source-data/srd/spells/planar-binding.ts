import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const planarBinding: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PLANAR_BINDING,
  label: 'Planar Binding',
  description:
    'With this spell, you attempt to bind a celestial, an elemental, a fey, or a fiend to your service. The creature must be within range for the entire casting of the spell.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ABJURATION'),
  materialDescription: 'a jewel worth at least 1,000 gp, which the spell consumes',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x211, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.CHARISMA
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x212, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Choose a celestial, elemental, fey, or fiend within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x213, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x214, 1),
            durationKind: DURATION_KIND.DAY,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Planar Binding',
          description:
            'The chosen creature is bound to your service for the spell duration, subject to the spell’s special terms.'
        },
        {
          id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x215, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'No Binding',
          description: 'The creature resists the binding and remains free.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
