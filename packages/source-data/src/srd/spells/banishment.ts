import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  DURATION_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const banishment: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.BANISHMENT,
  label: 'Banishment',
  description:
    "<p>You attempt to send one creature that you can see within range to another plane of existence. The target must succeed on a Charisma saving throw or be banished.</p><p>If the target is native to the plane of existence you're on, you banish the target to a harmless demiplane. While there, the target is incapacitated. The target remains there until the spell ends, at which point the target reappears in the space it left or in the nearest unoccupied space if that space is occupied. If the target is native to a different plane of existence than the one you're on, the target is banished with a faint popping noise, returning to its home plane. If the spell ends before 1 minute has passed, the target reappears in the space it left or in the nearest unoccupied space if that space is occupied. Otherwise, the target doesn't return. At Higher Levels. When you cast this spell using a spell slot of 5th level or higher, you can target one additional creature for each slot level above 4th.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [
    CLASS_IDS.CLERIC,
    CLASS_IDS.PALADIN,
    CLASS_IDS.SORCERER,
    CLASS_IDS.WARLOCK,
    CLASS_IDS.WIZARD
  ],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'an item distasteful to the target',
  magicSchoolId: schoolId('ABJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.BANISHMENT, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.BANISHMENT, 0x214, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CHARISMA
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.BANISHMENT, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.BANISHMENT, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.BANISHMENT, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.BANISHMENT, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.BANISHMENT, 0x212, 1),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('INCAPACITATED')
              },
              {
                id: spellChildId(SPELL_IDS.BANISHMENT, 0x215, 1),
                effectKind: EFFECT_KIND.REMOVE_FROM_PLAY,
                keepsTurn: false
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
