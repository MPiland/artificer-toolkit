import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const youngBronzeDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.YOUNG_BRONZE_DRAGON,
  label: 'Young Bronze Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 21,
    DEXTERITY: 10,
    CONSTITUTION: 19,
    INTELLIGENCE: 14,
    WISDOM: 13,
    CHARISMA: 17
  },
  naturalArmorBonus: 8,
  hitPoints: 142,
  hitDice: {
    count: 15,
    die: 10,
    modifier: 60
  },
  speeds: [...S.walk(40), ...S.fly(80), ...S.swim(40)],
  proficiencies: [
    S.grantedSkillExpertise(304, 4, 'PERCEPTION'),
    S.grantedSaveProficiency(304, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(304, 2, 'INSIGHT', 'STEALTH'),
    S.grantedLanguageProficiency(304, 3, 'COMMON', 'DRACONIC')
  ],
  damageImmunities: ['lightning'],
  senses: [S.blindsight(30), S.darkvision(120)],
  passivePerception: 17,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(304, 1),
      label: 'Amphibious',
      description: 'Amphibious. The dragon can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(304, 2),
      label: 'Multiattack',
      description: 'The dragon makes three attacks: one with its bite and two with its claws.',
      order: 2
    },
    {
      id: S.featureId(304, 3),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +8 to hit, reach 10 ft., one target. Hit: 16 (2d10 + 5) piercing damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 304,
          localIndex: 1,
          kind: 'MELEE',
          feet: 10,
          damageType: 'PIERCING',
          diceConfig: '2d10',
          ability: 'STRENGTH'
        })
      ],
      order: 3
    },
    {
      id: S.featureId(304, 4),
      label: 'Claw',
      description:
        'Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 12 (2d6 + 5) slashing damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 304,
          localIndex: 10,
          kind: 'MELEE',
          feet: 5,
          damageType: 'SLASHING',
          diceConfig: '2d6',
          ability: 'STRENGTH'
        })
      ],
      order: 4
    },
    {
      id: S.featureId(304, 5),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(304, 5)),
      label: 'Breath Weapons (Recharge 5-6)',
      description:
        'The dragon uses one of the following breath weapons. Lightning Breath. The dragon exhales lightning in a 60-foot line that is 5 feet wide. Each creature in that line must make a DC 15 Dexterity saving throw, taking 55 (10d10) lightning damage on a failed save, or half as much damage on a successful one. Repulsion Breath. The dragon exhales repulsion energy in a 30-foot cone. Each creature in that area must succeed on a DC 15 Strength saving throw. On a failed save, the creature is pushed 40 feet away from the dragon.',
      effects: [
        {
          id: S.actionId(304, 20),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(304, 21),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 15
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            ...S.selfLine(S.actionId(304, 22), S.actionId(304, 36), 60, 5)
          },
          paths: [
            {
              id: S.actionId(304, 23),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(304, 23)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(304, 24),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('LIGHTNING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '10d10'
                  }
                ]
              }
            },
            {
              id: S.actionId(304, 25),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(304, 25)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(304, 26),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('LIGHTNING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '10d10',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        },
        {
          id: S.actionId(304, 30),
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(304, 31),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.STRENGTH,
              baseDc: 15
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            ...S.selfCone(S.actionId(304, 32), S.actionId(304, 37), 30)
          },
          paths: [
            {
              id: S.actionId(304, 33),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(304, 33)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(304, 34),
                    effectKind: S.EFFECT_KIND.FORCED_MOVEMENT,
                    direction: 'AWAY_FROM_SOURCE',
                    actionEconomy: 'NONE',
                    distanceMode: 'FIXED_DISTANCE',
                    amount: 40,
                    unit: S.MEASUREMENT_UNIT_CODE.FEET
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
