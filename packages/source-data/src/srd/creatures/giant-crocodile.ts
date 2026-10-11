import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const giantCrocodile: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_CROCODILE,
  label: 'Giant Crocodile',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 21,
    DEXTERITY: 9,
    CONSTITUTION: 17,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 7
  },
  naturalArmorBonus: 5,
  hitPoints: 85,
  hitDice: {
    count: 9,
    die: 12,
    modifier: 27
  },
  speeds: [...S.walk(30), ...S.swim(50)],
  proficiencies: [S.grantedSkillExpertise(10120, 1, 'STEALTH')],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(120, 1),
      label: 'Hold Breath',
      description: 'Hold Breath. The crocodile can hold its breath for 30 minutes.',
      order: 1
    },
    {
      id: S.featureId(120, 2),
      label: 'Multiattack',
      description:
        'Multiattack. The crocodile makes two attacks: one with its bite and one with its tail.',
      order: 2
    },
    {
      id: S.featureId(120, 3),
      label: 'Bite',
      description:
        "Bite. Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 21 (3d10 + 5) piercing damage, and the target is grappled (escape DC 16). Until this grapple ends, the target is restrained, and the crocodile can't bite another target.",
      effects: [
        S.weaponAttack({
          creatureIndex: 120,
          localIndex: 21,
          kind: 'MELEE',
          feet: 5,
          damageType: 'PIERCING',
          diceConfig: '3d10',
          ability: 'STRENGTH',
          grapple: { localIndex: 1, escapeDc: 16, heldAtOnce: 1, untilEnds: ['RESTRAINED'] }
        })
      ],
      order: 3
    },
    {
      id: S.featureId(120, 4),
      label: 'Tail',
      description:
        'Tail. Melee Weapon Attack: +8 to hit, reach 10 ft., one target not grappled by the crocodile. Hit: 14 (2d8 + 5) bludgeoning damage. If the target is a creature, it must succeed on a DC 16 Strength saving throw or be knocked prone.',
      effects: [
        {
          id: S.actionId(120, 8),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(120, 9),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(120, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(120, 10) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(120, 10),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8+5'
                  },
                  S.conditionSave({
                    id: S.actionId(120, 11),
                    savingThrowId: S.actionId(120, 901),
                    ability: 'STRENGTH',
                    dc: 16,
                    conditionOutcomeId: S.actionId(120, 902),
                    conditionId: conditionTypeId('PRONE'),
                    repeatsAtTurnEnd: false
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 4
    }
  ]
}
