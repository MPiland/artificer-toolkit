import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SPELL_COMPONENT,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { ABILITY_CODE } from '../vocabulary.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const telepathicBond: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.TELEPATHIC_BOND,
  label: 'Telepathic Bond',
  description:
    "<p>You forge a telepathic link among up to eight willing creatures of your choice within range, psychically linking each creature to all the others for the duration. Creatures with Intelligence scores of 2 or less aren't affected by this spell. Until the spell ends, the targets can communicate telepathically through the bond whether or not they have a common language. The communication is possible over any distance, though it can't extend to other planes of existence.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'pieces of eggshell from two different kinds of creatures',
  magicSchoolId: schoolId('DIVINATION'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  effects: [
    {
      id: spellChildId(SPELL_IDS.TELEPATHIC_BOND, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: spellChildId(SPELL_IDS.TELEPATHIC_BOND, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING,
          maxTargets: 8
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.TELEPATHIC_BOND, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: `${spellChildId(SPELL_IDS.TELEPATHIC_BOND, 0x212, 1)}__result`,
            resultKind: 'SINGLE',
            duration: {
              id: spellChildId(SPELL_IDS.TELEPATHIC_BOND, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.TELEPATHIC_BOND, 0x214, 1),
                effectKind: EFFECT_KIND.TELEPATHIC_LINK,
                maximumCreatures: 8,
                excludesAbilityAtOrBelow: { ability: ABILITY_CODE.INTELLIGENCE, score: 2 },
                anyDistance: true,
                crossesPlanes: false,
                requiresSharedLanguage: false
              }
            ]
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
