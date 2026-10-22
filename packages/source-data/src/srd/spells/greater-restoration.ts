import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { conditionTypeId, spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}
export const greaterRestoration: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.GREATER_RESTORATION,
  label: 'Greater Restoration',
  description:
    "<p>You imbue a creature you touch with positive energy to undo a debilitating effect. You can reduce the target's exhaustion level by one, or end one of the following effects on the target: * One effect that charmed or petrified the target * One curse, including the target's attunement to a cursed magic item * Any reduction to one of the target's ability scores * One effect reducing the target's hit point maximum</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'diamond dust worth at least 100 gp, which the spell consumes',
  magicSchoolId: schoolId('ABJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.GREATER_RESTORATION, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GREATER_RESTORATION, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.GREATER_RESTORATION, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.GREATER_RESTORATION, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.GREATER_RESTORATION, 0x212, 1),
                effectKind: EFFECT_KIND.END_EFFECTS,
                scope: 'ONE_CHOSEN' as const,
                conditionIds: ['CHARMED', 'PETRIFIED'].map(conditionTypeId)
              },
              {
                id: spellChildId(SPELL_IDS.GREATER_RESTORATION, 0x214, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Greater Restoration',
                reasonCode: 'GM_CHOICE' as const,
                instructions:
                  "You can reduce the target's exhaustion level by one, or end one of the following effects on the target: * One effect that charmed or petrified the target * One curse, including the target's attunement to a cursed magic item * Any reduction to one of the target's ability scores * One effect reducing the target's hit point maximum"
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
