import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const HURL_EFFECT_KEY = 0x220
const HURL_EFFECT_ID = spellChildId(SPELL_IDS.PRODUCE_FLAME, HURL_EFFECT_KEY, 1)
const HURL_PATH_KEY = 0x222

export const produceFlame: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PRODUCE_FLAME,
  label: 'Produce Flame',
  description:
    "<p>A flickering flame appears in your hand. The flame remains there for the duration and harms neither you nor your equipment. The flame sheds bright light in a 10-foot radius and dim light for an additional 10 feet. The spell ends if you dismiss it as an action or if you cast it again. You can also attack with the flame, although doing so ends the spell. When you cast this spell, or as an action on a later turn, you can hurl the flame at a creature within 30 feet of you. Make a ranged spell attack. On a hit, the target takes 1d8 fire damage. This spell's damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('CONJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.PRODUCE_FLAME, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PRODUCE_FLAME, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.PRODUCE_FLAME, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.PRODUCE_FLAME, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.PRODUCE_FLAME, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 10
            },
            // The flame stays in your hand for the duration: on a later turn you can use your action to hurl it.
            lifecycle: {
              effectOffers: [
                {
                  kind: 'REPEAT_SOURCE_PATH' as const,
                  offeredTo: 'SOURCE' as const,
                  activation: ACTIVATION_CODE.ACTION,
                  effectId: HURL_EFFECT_ID,
                  target: 'INVOCATION' as const
                }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.PRODUCE_FLAME, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {}
              }
            ]
          }
        }
      ]
    },
    {
      id: HURL_EFFECT_ID,
      order: 2,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.RANGED_SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PRODUCE_FLAME, HURL_EFFECT_KEY + 1, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.PRODUCE_FLAME, HURL_PATH_KEY, 1),
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.PRODUCE_FLAME, HURL_PATH_KEY, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.PRODUCE_FLAME, HURL_PATH_KEY, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('FIRE'),
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
                levels: [1, 5, 11, 17].map((level, index) => ({
                  id: spellChildId(SPELL_IDS.PRODUCE_FLAME, HURL_PATH_KEY, 2 + index),
                  level,
                  order: index + 1,
                  diceConfig: `${index + 1}d8`
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
