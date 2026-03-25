import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const flyingSword: CreatureAuthored = {
  id: S.CREATURE_IDS.FLYING_SWORD,
  label: 'Flying Sword',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  tags: ['hover'],
  abilityScores: {
    STRENGTH: 12,
    DEXTERITY: 15,
    CONSTITUTION: 11,
    INTELLIGENCE: 1,
    WISDOM: 5,
    CHARISMA: 1,
    SPELLCASTING: 0
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 17,
  hitDice: '5d6',
  speeds: [...S.walk(0), ...S.fly(50)],
  proficiencies: [
    S.grantedSaveProficiency(105, 1, 'DEXTERITY')
  ],
  damageImmunities: ['poison', 'psychic'],
  conditionImmunities: ['blinded', 'charmed', 'deafened', 'frightened', 'paralyzed', 'petrified', 'poisoned'],
  senses: ['blindsight 60 ft. (blind beyond this radius)'],
  passivePerception: 7,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(105, 1),
      label: 'Antimagic Susceptibility',
      description: "Antimagic Susceptibility. The sword is incapacitated while in the area of an antimagic field. If targeted by dispel magic, the sword must succeed on a Constitution saving throw against the caster's spell save DC or fall unconscious for 1 minute.",
      order: 1
    },
    {
      id: S.featureId(105, 2),
      label: 'False Appearance',
      description: "False Appearance. While the sword remains motionless and isn't flying, it is indistinguishable from a normal sword.",
      order: 2
    },
    {
      id: S.featureId(105, 3),
      label: 'Longsword',
      description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) slashing damage.',
      capabilities: [
        {
          id: S.actionId(105, 2),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(105, 3),
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
              id: S.actionId(105, 4),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8',
              bonuses: [
                {
                  id: S.actionId(105, 5),
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
  ]
}
