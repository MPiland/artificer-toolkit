import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
/** One hit point tier: the conditions a failed save leaves on a target at most `atMost` hit points. */
function divineWordTier(order: number, atMost: number, minutes: number, conditionCodes: string[]) {
  return {
    id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x218, order),
    order,
    atMost,
    resultBlock: {
      id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x219, order),
      resultKind: 'SEQUENCE' as const,
      duration: {
        id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x21a, order),
        durationKind: DURATION_KIND.MINUTE,
        amount: minutes
      },
      outcomes: conditionCodes.map((code, index) => ({
        id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x21b, order * 10 + index),
        order: index + 1,
        effectKind: EFFECT_KIND.CONDITION,
        conditionId: conditionTypeId(code)
      }))
    }
  }
}

export const divineWord: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DIVINE_WORD,
  label: 'Divine Word',
  description:
    "<p>You utter a divine word, imbued with the power that shaped the world at the dawn of creation. Choose any number of creatures you can see within range. Each creature that can hear you must make a Charisma saving throw. On a failed save, a creature suffers an effect based on its current hit points: * 50 hit points or fewer: deafened for 1 minute * 40 hit points or fewer: deafened and blinded for 10 minutes * 30 hit points or fewer: blinded, deafened, and stunned for 1 hour * 20 hit points or fewer: killed instantly Regardless of its current hit points, a celestial, an elemental, a fey, or a fiend that fails its save is forced back to its plane of origin (if it isn't there already) and can't return to your current plane for 24 hours by any means short of a wish spell.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x214, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CHARISMA
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
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'HIT_POINT_TIERS' as const,
          rows: [
            divineWordTier(1, 50, 1, ['DEAFENED']),
            divineWordTier(2, 40, 10, ['DEAFENED', 'BLINDED']),
            divineWordTier(3, 30, 60, ['BLINDED', 'DEAFENED', 'STUNNED']),
            {
              id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x218, 4),
              order: 4,
              atMost: 20,
              resultBlock: {
                id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x219, 4),
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: spellChildId(SPELL_IDS.DIVINE_WORD, 0x21b, 40),
                    effectKind: EFFECT_KIND.KILL
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
