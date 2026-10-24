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
  SIZE_CODE,
  SPELLCASTING_ABILITY_REFERENCE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
import { SRD_SPEEDS } from '../vocabulary.js'

const flySpeedId = SRD_SPEEDS.find((speed) => speed.code === 'FLY')?.id
if (!flySpeedId)
  throw new Error('SRD FLY speed vocabulary entry is required for Spiritual Weapon source data.')

const ATTACK_EFFECT_ID = spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x240, 1)

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
          code: ACTIVATION_CODE.BONUS_ACTION,
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
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            // The caster attacks through the weapon, measured from it: free once on the cast turn,
            // then as a bonus action. Moving it with that bonus action, and ending it by casting the
            // spell again, are GM rulings (D190a).
            lifecycle: {
              effectOffers: [
                {
                  kind: 'REPEAT_SOURCE_PATH' as const,
                  offeredTo: 'SOURCE' as const,
                  activation: ACTIVATION_CODE.BONUS_ACTION,
                  effectId: ATTACK_EFFECT_ID,
                  target: 'INVOCATION' as const,
                  origin: 'CONJURED' as const,
                  castTurnUse: 'FREE_ONCE' as const
                }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x214, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.SUMMON,
                label: 'Spiritual Weapon',
                statBlock: {
                  // The SRD names no size; the weapon is drawn in one 5-foot square.
                  size: SIZE_CODE.MEDIUM,
                  speeds: [
                    {
                      speedId: flySpeedId,
                      amount: 20,
                      unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                  ],
                  damageabilityKind: 'INVULNERABLE',
                  occupiesSpace: false
                }
              },
              {
                id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x215, 1),
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
          code: ACTIVATION_CODE.BONUS_ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x241, 1),
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
        {
          id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x244, 1),
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: `${spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x244, 1)}__result`,
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x245, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('FORCE'),
                valueKind: 'DICE' as const,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                // 1d8, and 1d8 more for every two slot levels above 2nd.
                levels: Array.from({ length: 8 }, (_, index) => ({
                  id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x246, index + 1),
                  level: index + 2,
                  order: index + 1,
                  diceConfig: `${1 + Math.floor(index / 2)}d8`
                })),
                bonuses: [
                  {
                    id: spellChildId(SPELL_IDS.SPIRITUAL_WEAPON, 0x247, 1),
                    bonusKind: 'ABILITY_BONUS' as const,
                    ability: SPELLCASTING_ABILITY_REFERENCE,
                    order: 1
                  }
                ]
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
