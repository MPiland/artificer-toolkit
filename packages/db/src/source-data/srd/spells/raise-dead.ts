import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  DURATION_KIND,
  EFFECT_KIND,
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
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const raiseDead: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.RAISE_DEAD,
  label: 'Raise Dead',
  description:
    'You return a dead creature you touch to life, provided it has been dead no longer than 10 days. The creature returns with 1 hit point, and the spell also neutralizes poisons and cures nonmagical diseases that affected it at the time of death.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a diamond worth at least 500 gp, which the spell consumes',
  magicSchoolId: schoolId('NECROMANCY'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  effects: [
    {
      id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x213, 1),
              durationKind: DURATION_KIND.INSTANTANEOUS
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x212, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION
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
