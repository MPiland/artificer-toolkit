import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
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
import {
  conditionTypeId,
  returnFromDeathPenaltyGrants,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'
export const raiseDead: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.RAISE_DEAD,
  label: 'Raise Dead',
  description:
    "<p>You return a dead creature you touch to life, provided that it has been dead no longer than 10 days. If the creature's soul is both willing and at liberty to rejoin the body, the creature returns to life with 1 hit point. This spell also neutralizes any poisons and cures nonmagical diseases that affected the creature at the time it died. This spell doesn't, however, remove magical diseases, curses, or similar effects; if these aren't first removed prior to casting the spell, they take effect when the creature returns to life. The spell can't return an undead creature to life. This spell closes all mortal wounds, but it doesn't restore missing body parts. If the creature is lacking body parts or organs integral for its survival-its head, for instance-the spell automatically fails. Coming back from the dead is an ordeal. The target takes a -4 penalty to all attack rolls, saving throws, and ability checks. Every time the target finishes a long rest, the penalty is reduced by 1 until it disappears.</p>",
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
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x2f0, 1),
                effectKind: EFFECT_KIND.REVIVE,
                valueKind: 'FIXED' as const,
                amount: 1
              },
              {
                id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x2f1, 1),
                effectKind: EFFECT_KIND.END_EFFECTS,
                scope: 'ALL' as const,
                conditionIds: [conditionTypeId('POISONED')]
              },
              {
                id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x212, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Resolve the Soul',
                reasonCode: 'EXTERNAL_WORLD_STATE' as const,
                instructions:
                  'If the creature\u0027s soul is both willing and at liberty to rejoin the body, the creature returns to life with 1 hit point.'
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x214, 1),
          order: 2,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x214, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            lifecycle: { stepDown: { trigger: 'LONG_REST' as const, step: 1 } },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.RAISE_DEAD, 0x215, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: returnFromDeathPenaltyGrants((entry) =>
                    spellChildId(SPELL_IDS.RAISE_DEAD, 0x216, entry)
                  )
                }
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
