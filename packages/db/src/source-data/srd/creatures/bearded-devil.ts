import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const beardedDevil: CreatureAuthored = {
  id: S.CREATURE_IDS.BEARDED_DEVIL,
  label: 'Bearded Devil',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 15,
    CONSTITUTION: 15,
    INTELLIGENCE: 9,
    WISDOM: 11,
    CHARISMA: 11,
    SPELLCASTING: 0
  },
  armorClass: 13,
  armorClassNote: 'natural armor',
  hitPoints: 52,
  hitDice: '8d8+16',
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSaveProficiency(3602, 1, 'STRENGTH', 'CONSTITUTION', 'WISDOM'),
    S.grantedLanguageProficiency(3602, 2, 'INFERNAL')
  ],
  damageResistances: ['cold; bludgeoning, piercing, and slashing from nonmagical attacks that aren\'t silvered'],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: ['darkvision 120 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(3602, 1),
      label: "Devil's Sight",
      description: "Devil's Sight. Magical darkness doesn't impede the devil's darkvision.",
      order: 1
    },
    {
      id: S.featureId(3602, 2),
      label: 'Magic Resistance',
      description: 'Magic Resistance. The devil has advantage on saving throws against spells and other magical effects.',
      order: 2
    },
    {
      id: S.featureId(3602, 3),
      label: 'Steadfast',
      description: "Steadfast. The devil can't be frightened while it can see an allied creature within 30 feet of it.",
      order: 3
    },
    {
      id: S.featureId(3602, 4),
      label: 'Multiattack',
      description: 'Multiattack. The devil makes two attacks: one with its beard and one with its glaive.',
      order: 4
    },
    {
      id: S.featureId(3602, 5),
      label: 'Beard',
      description: "Beard. Melee Weapon Attack: +5 to hit, reach 5 ft., one creature. Hit: 6 (1d8 + 2) piercing damage, and the target must succeed on a DC 12 Constitution saving throw or be poisoned for 1 minute. While poisoned in this way, the target can't regain hit points. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.",
      capabilities: [
        {
          id: S.actionId(3602, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3602, 2),
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
              id: S.actionId(3602, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8',
              bonuses: [
                {
                  id: S.actionId(3602, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.PROFICIENCY_BONUS,
                  order: 1
                }
              ]
            },
            {
              id: S.actionId(3602, 5),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.CONDITION,
              conditionId: conditionTypeId('POISONED'),
              duration: {
                id: S.actionId(3602, 6),
                durationKind: DURATION_KIND.MINUTE,
                amount: 1
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(3602, 6),
      label: 'Glaive',
      description: 'Glaive. Melee Weapon Attack: +5 to hit, reach 10 ft., one target. Hit: 8 (1d10 + 3) slashing damage. If the target is a creature other than an undead or a construct, it must succeed on a DC 12 Constitution saving throw or lose 5 (1d10) hit points at the start of each of its turns due to an infernal wound. Each time the devil hits the wounded target with this attack, the damage dealt by the wound increases by 5 (1d10). Any creature can take an action to stanch the wound with a successful DC 12 Wisdom (Medicine) check. The wound also closes if the target receives magical healing.',
      capabilities: [
        {
          id: S.actionId(3602, 7),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3602, 8),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(3602, 9),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d10',
              bonuses: [
                {
                  id: S.actionId(3602, 10),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 6
    }
  ]
}
