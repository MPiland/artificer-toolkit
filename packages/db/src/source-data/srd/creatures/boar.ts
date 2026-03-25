import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const boar: CreatureAuthored = {
  id: S.CREATURE_IDS.BOAR,
  label: 'Boar',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 13,
    DEXTERITY: 11,
    CONSTITUTION: 12,
    INTELLIGENCE: 2,
    WISDOM: 9,
    CHARISMA: 5,
    SPELLCASTING: 0
  },
  armorClass: 11,
  armorClassNote: 'natural armor',
  hitPoints: 11,
  hitDice: '2d8+2',
  speeds: [...S.walk(40)],
  passivePerception: 9,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(51, 1),
      label: 'Charge',
      description: 'Charge. If the boar moves at least 20 feet straight toward a target and then hits it with a tusk attack on the same turn, the target takes an extra 3 (1d6) slashing damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone.',
      order: 1
    },
    {
      id: S.featureId(51, 2),
      label: 'Relentless (Recharges after a Short or Long Rest)',
      description: 'Relentless (Recharges after a Short or Long Rest). If the boar takes 7 damage or less that would reduce it to 0 hit points, it is reduced to 1 hit point instead.',
      order: 2
    },
    {
      id: S.featureId(51, 3),
      label: 'Tusk',
      description: 'Tusk. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) slashing damage.',
      capabilities: [
        {
          id: S.actionId(51, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(51, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(51, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d6',
              bonuses: [
                {
                  id: S.actionId(51, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 3
    }
  ],
}
