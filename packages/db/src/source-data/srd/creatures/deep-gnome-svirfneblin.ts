import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const deepGnomeSvirfneblin: CreatureAuthored = {
  id: S.CREATURE_IDS.DEEP_GNOME_SVIRFNEBLIN,
  label: 'Deep Gnome (Svirfneblin)',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000200000000',
  tags: ['gnome'],
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 14,
    CONSTITUTION: 14,
    INTELLIGENCE: 12,
    WISDOM: 10,
    CHARISMA: 9
  },
  armorClass: 15,
  armorClassNote: 'chain shirt',
  hitPoints: 16,
  hitDice: {
    count: 3,
    die: 6,
    modifier: 6
  },
  speeds: [...S.walk(20)],
  proficiencies: [
    S.grantedSkillProficiency(78, 1, 'INVESTIGATION', 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(78, 2, 'GNOMISH', 'TERRAN', 'UNDERCOMMON')
  ],
  senses: ['darkvision 120 ft.'],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(78, 1),
      label: 'Stone Camouflage',
      description:
        'Stone Camouflage. The gnome has advantage on Dexterity (Stealth) checks made to hide in rocky terrain.',
      order: 1
    },
    {
      id: S.featureId(78, 2),
      label: 'Gnome Cunning',
      description:
        'Gnome Cunning. The gnome has advantage on Intelligence, Wisdom, and Charisma saving throws against magic.',
      order: 2
    },
    {
      id: S.featureId(78, 3),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The gnome's innate spellcasting ability is Intelligence (spell save DC 11). It can innately cast the following spells, requiring no material components: At will: nondetection (self only). 1/day each: blindness/deafness, blur, disguise self.",
      order: 3
    },
    {
      id: S.featureId(78, 4),
      label: 'War Pick',
      description:
        'War Pick. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(78, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(78, 3),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(78, 4),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(78, 4) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(78, 4),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8+2'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(78, 5),
      label: 'Poisoned Dart',
      description:
        'Poisoned Dart. Ranged Weapon Attack: +4 to hit, range 30/120 ft., one creature. Hit: 4 (1d4 + 2) piercing damage, and the target must succeed on a DC 12 Constitution saving throw or be poisoned for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      effects: [
        {
          id: S.actionId(78, 2),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(78, 5),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 120,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(78, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(78, 6) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(78, 6),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4+2'
                  }
                ]
              }
            },
            {
              id: S.actionId(78, 7),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(78, 7) + '__result',
                resultKind: 'SEQUENCE' as const,
                duration: {
                  id: S.actionId(78, 8),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(78, 7),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('POISONED')
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
