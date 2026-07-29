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
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
import { spellChildId } from './shared.js'
export const dispelEvilAndGood: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DISPEL_EVIL_AND_GOOD,
  label: 'Dispel Evil and Good',
  description:
    'Shimmering energy surrounds and protects you from celestials, elementals, fey, fiends, and undead. While the spell lasts, those creatures have disadvantage on attack rolls against you, and you can end the spell early to break enchantment or attempt dismissal.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'holy water or powdered silver and iron',
  magicSchoolId: schoolId('ABJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x212, 1),
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
