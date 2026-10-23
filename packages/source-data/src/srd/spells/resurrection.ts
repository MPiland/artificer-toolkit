import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
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
import {
  conditionTypeId,
  returnFromDeathPenaltyGrants,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'
export const resurrection: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.RESURRECTION,
  label: 'Resurrection',
  description:
    "<p>You touch a dead creature that has been dead for no more than a century, that didn't die of old age, and that isn't undead. If its soul is free and willing, the target returns to life with all its hit points. This spell neutralizes any poisons and cures normal diseases afflicting the creature when it died. It doesn't, however, remove magical diseases, curses, and the like; if such effects aren't removed prior to casting the spell, they afflict the target on its return to life. This spell closes all mortal wounds and restores any missing body parts. Coming back from the dead is an ordeal. The target takes a -4 penalty to all attack rolls, saving throws, and ability checks. Every time the target finishes a long rest, the penalty is reduced by 1 until it disappears. Casting this spell to restore life to a creature that has been dead for one year or longer taxes you greatly. Until you finish a long rest, you can't cast spells again, and you have disadvantage on all attack rolls, ability checks, and saving throws.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a diamond worth at least 1,000 gp, which the spell consumes',
  magicSchoolId: schoolId('NECROMANCY'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.RESURRECTION, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.RESURRECTION, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.RESURRECTION, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.RESURRECTION, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.RESURRECTION, 0x2f0, 1),
                effectKind: EFFECT_KIND.REVIVE,
                valueKind: 'MAXIMUM' as const
              },
              {
                id: spellChildId(SPELL_IDS.RESURRECTION, 0x2f1, 1),
                effectKind: EFFECT_KIND.END_EFFECTS,
                scope: 'ALL' as const,
                conditionIds: [conditionTypeId('POISONED')]
              },
              {
                id: spellChildId(SPELL_IDS.RESURRECTION, 0x212, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Resolve the Soul',
                reasonCode: 'EXTERNAL_WORLD_STATE' as const,
                instructions:
                  'If its soul is free and willing, the target returns to life with all its hit points.'
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.RESURRECTION, 0x214, 1),
          order: 2,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.RESURRECTION, 0x214, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            lifecycle: { stepDown: { trigger: 'LONG_REST' as const, step: 1 } },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.RESURRECTION, 0x215, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: returnFromDeathPenaltyGrants((entry) =>
                    spellChildId(SPELL_IDS.RESURRECTION, 0x216, entry)
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
