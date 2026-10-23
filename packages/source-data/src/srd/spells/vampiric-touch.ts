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
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const ATTACK_PATH_KEY = 0x212
const DAMAGE_OUTCOME_ID = spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, ATTACK_PATH_KEY, 1)
const REPEATED_PATH_IDS = [spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, ATTACK_PATH_KEY, 1)]

/**
 * The effect the cast leaves on the target: it grants nothing and offers the caster an Action repeat
 * of the attack until the Concentration ends. One per attack result, authored alike.
 */
function repeatCarrierPath(
  pathCode: typeof PATH_CODE.ON_HIT | typeof PATH_CODE.ON_MISS,
  idKey: number,
  order: number
) {
  return {
    id: spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, idKey, 1),
    order,
    pathCode,
    groupType: PATH_GROUP_TYPE.SEQUENTIAL,
    originKind: 'SOURCE' as const,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, idKey, 1) + '__result',
      resultKind: 'SEQUENCE' as const,
      duration: {
        id: spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, idKey, 2),
        durationKind: DURATION_KIND.MINUTE,
        amount: 1
      },
      lifecycle: {
        effectOffers: [
          {
            kind: 'REPEAT_SOURCE_PATH' as const,
            offeredTo: 'SOURCE' as const,
            activation: ACTIVATION_CODE.ACTION,
            pathIds: REPEATED_PATH_IDS
          }
        ]
      },
      outcomes: [
        {
          id: spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, idKey, 1),
          effectKind: EFFECT_KIND.APPLY_GRANT,
          grants: {}
        }
      ]
    }
  }
}

export const vampiricTouch: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.VAMPIRIC_TOUCH,
  label: 'Vampiric Touch',
  description:
    '<p>The touch of your shadow-wreathed hand can siphon life force from others to heal your wounds. Make a melee spell attack against a creature within your reach. On a hit, the target takes 3d6 necrotic damage, and you regain hit points equal to half the amount of necrotic damage dealt. Until the spell ends, you can make the attack again on each of your turns as an action. At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('NECROMANCY'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, ATTACK_PATH_KEY, 1),
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, ATTACK_PATH_KEY, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: DAMAGE_OUTCOME_ID,
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('NECROTIC'),
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [3, 4, 5, 6, 7, 8, 9].map((level, index) => ({
                  id: spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, ATTACK_PATH_KEY, 2 + index),
                  level,
                  order: index + 1,
                  diceConfig: `${level}d6`
                }))
              },
              {
                id: spellChildId(SPELL_IDS.VAMPIRIC_TOUCH, ATTACK_PATH_KEY, 20),
                effectKind: EFFECT_KIND.HEAL,
                valueKind: 'DAMAGE_DEALT' as const,
                scalingKind: SCALING.NONE,
                damageOutcomeId: DAMAGE_OUTCOME_ID,
                fraction: { numerator: 1, denominator: 2 },
                recipient: 'SOURCE' as const
              }
            ]
          }
        },
        repeatCarrierPath(PATH_CODE.ON_HIT, 0x213, 2),
        repeatCarrierPath(PATH_CODE.ON_MISS, 0x214, 3)
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
