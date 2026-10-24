import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const ATTACK_EFFECT_KEY = 0x220
const ATTACK_EFFECT_ID = spellChildId(SPELL_IDS.FLAME_BLADE, ATTACK_EFFECT_KEY, 1)
const ATTACK_PATH_KEY = 0x222

export const flameBlade: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FLAME_BLADE,
  label: 'Flame Blade',
  description:
    '<p>You evoke a fiery blade in your free hand. The blade is similar in size and shape to a scimitar, and it lasts for the duration. If you let go of the blade, it disappears, but you can evoke the blade again as a bonus action. You can use your action to make a melee spell attack with the fiery blade. On a hit, the target takes 3d6 fire damage. The flaming blade sheds bright light in a 10-foot radius and dim light for an additional 10 feet. At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for every two slot levels above 2nd.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'leaf of sumac',
  magicSchoolId: schoolId('EVOCATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 10
            },
            // The blade lasts for the duration: on each of your turns you can use your action to attack with it.
            lifecycle: {
              effectOffers: [
                {
                  kind: 'REPEAT_SOURCE_PATH' as const,
                  offeredTo: 'SOURCE' as const,
                  activation: ACTIVATION_CODE.ACTION,
                  effectId: ATTACK_EFFECT_ID,
                  target: 'INVOCATION' as const
                }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {}
              }
            ]
          }
        }
      ]
    },
    {
      id: ATTACK_EFFECT_ID,
      order: 2,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FLAME_BLADE, ATTACK_EFFECT_KEY + 1, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.FLAME_BLADE, ATTACK_PATH_KEY, 1),
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.FLAME_BLADE, ATTACK_PATH_KEY, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.FLAME_BLADE, ATTACK_PATH_KEY, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('FIRE'),
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                // 3d6, and 1d6 more for every two slot levels above 2nd.
                levels: [2, 3, 4, 5, 6, 7, 8, 9].map((level, index) => ({
                  id: spellChildId(SPELL_IDS.FLAME_BLADE, ATTACK_PATH_KEY, 2 + index),
                  level,
                  order: index + 1,
                  diceConfig: `${3 + Math.floor((level - 2) / 2)}d6`
                }))
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
