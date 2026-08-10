import {
  ACTIVATION_CODE,
  DURATION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SPELLCASTING_ABILITY_REFERENCE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type ManifestBehaviorAuthored,
  type NonManifestOutcomeAuthored,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const manifestId = spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x214, 1)
const initialAttackBehaviorId = spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x220, 1)

function createDamageOutcome(scope: number, critical: boolean): NonManifestOutcomeAuthored {
  return {
    id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope, 1),
    effectKind: EFFECT_KIND.DAMAGE,
    damageTypeId: damageTypeId('FORCE'),
    valueKind: 'DICE',
    scalingKind: SCALING.PER_LEVEL,
    scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
    levels: Array.from({ length: 8 }, (_, index) => {
      const diceCount = (1 + Math.floor(index / 2)) * (critical ? 2 : 1)
      return {
        id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope + 1, index + 1),
        level: index + 2,
        order: index + 1,
        diceConfig: `${diceCount}d8`
      }
    }),
    bonuses: [
      {
        id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope + 2, 1),
        bonusKind: 'ABILITY_BONUS',
        ability: SPELLCASTING_ABILITY_REFERENCE,
        order: 1
      }
    ]
  }
}

function createAttackBehavior(
  scope: number,
  activation: 'FREE' | 'BONUS_ACTION',
  canMove: boolean
): ManifestBehaviorAuthored {
  return {
    id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope, 1),
    order: activation === 'FREE' ? 1 : 2,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.SPELL_ATTACK,
      activation:
        activation === 'FREE'
          ? { code: ACTIVATION_CODE.FREE }
          : { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
      range: {
        id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope + 1, 1),
        rangeKind: RANGE_KIND.DISTANCE,
        amount: 5,
        unit: MEASUREMENT_UNIT_CODE.FEET
      },
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.ANY
      }
    },
    paths: [
      ...(canMove
        ? [
            {
              id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope + 2, 1),
              order: 1,
              pathCode: PATH_CODE.ON_ATTACK,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope + 2, 1)}__result`,
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope + 3, 1),
                    effectKind: EFFECT_KIND.MOVE_MANIFEST,
                    manifestId,
                    amount: 20,
                    unit: MEASUREMENT_UNIT_CODE.FEET,
                    upTo: true
                  }
                ]
              }
            }
          ]
        : []),
      {
        id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope + 4, 1),
        order: canMove ? 2 : 1,
        pathCode: PATH_CODE.ON_HIT,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope + 4, 1)}__result`,
          resultKind: 'SINGLE',
          outcomes: [createDamageOutcome(scope + 5, false)]
        }
      },
      {
        id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope + 8, 1),
        order: canMove ? 3 : 2,
        pathCode: PATH_CODE.ON_CRIT,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, scope + 8, 1)}__result`,
          resultKind: 'SINGLE',
          outcomes: [createDamageOutcome(scope + 9, true)]
        }
      }
    ]
  }
}
export const spiritualWeapon: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SPIRITUAL_WEAPON,
  label: 'Spiritual Weapon',
  description:
    "<p>You create a floating, spectral weapon within range that lasts for the duration or until you cast this spell again. When you cast the spell, you can make a melee spell attack against a creature within 5 feet of the weapon. On a hit, the target takes force damage equal to 1d8 + your spellcasting ability modifier. As a bonus action on your turn, you can move the weapon up to 20 feet and repeat the attack against a creature within 5 feet of it. The weapon can take whatever form you choose. Clerics of deities who are associated with a particular weapon (as St. Cuthbert is known for his mace and Thor for his hammer) make this spell's effect resemble that weapon. At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the damage increases by 1d8 for every two slot levels above 2nd.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: manifestId,
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.WEAPON,
                label: 'Spiritual Weapon',
                attachmentKind: 'PLACED_SPACE',
                behaviors: [
                  createAttackBehavior(0x220, 'FREE', false),
                  createAttackBehavior(0x240, 'BONUS_ACTION', true)
                ]
              },
              {
                id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x215, 1),
                effectKind: EFFECT_KIND.COMMAND_MANIFEST,
                manifestId,
                behaviorId: initialAttackBehaviorId
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
