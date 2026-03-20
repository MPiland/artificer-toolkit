import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
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

export const divineWord: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DIVINE_WORD,
  label: 'Divine Word',
  description:
    'You utter a divine word, imbued with the power that shaped the world at the dawn of creation. Choose any number of creatures you can see within range. Each creature that can hear you must make a Charisma saving throw.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.CLERIC],
  magicSchoolId: schoolId('EVOCATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x214, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.CHARISMA
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          detail: 'Choose any number of creatures you can see within range that can hear you.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x212, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Divine Word',
          description:
            'Each affected creature suffers the spell’s escalating divine consequences under the SRD text.'
        },
        {
          id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x213, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Successful Save',
          description: 'A creature that succeeds on the save is unaffected by the word.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
