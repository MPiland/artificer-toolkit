import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const invisibility: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.INVISIBILITY,
  label: 'Invisibility',
  description:
    "<p>A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target's person. The spell ends for a target that attacks or casts a spell. At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, you can target one additional creature for each slot level above 2nd.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'an eyelash encased in gum arabic',
  magicSchoolId: schoolId('ILLUSION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.INVISIBILITY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.INVISIBILITY, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.INVISIBILITY, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.INVISIBILITY, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.INVISIBILITY, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            lifecycle: {
              endTriggers: [
                { event: 'LIFECYCLE' as const, timing: 'END' as const, code: 'ON_ATTACK_ROLL' },
                { event: 'LIFECYCLE' as const, timing: 'END' as const, code: 'ON_CAST_SPELL' }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.INVISIBILITY, 0x212, 1),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('INVISIBLE')
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
