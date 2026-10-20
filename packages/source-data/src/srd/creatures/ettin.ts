import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const ettin: CreatureAuthored = {
  id: S.CREATURE_IDS.ETTIN,
  label: 'Ettin',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.GIANT,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 21,
    DEXTERITY: 8,
    CONSTITUTION: 17,
    INTELLIGENCE: 6,
    WISDOM: 10,
    CHARISMA: 8
  },
  naturalArmorBonus: 3,
  hitPoints: 85,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 10,
    die: 10,
    modifier: 30
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillExpertise(100, 3, 'PERCEPTION'),
    S.grantedLanguageProficiency(100, 2, 'GIANT', 'ORC')
  ],
  senses: [S.darkvision(60)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(100, 1),
      label: 'Two Heads',
      description:
        'Two Heads. The ettin has advantage on Wisdom (Perception) checks and on saving throws against being blinded, charmed, deafened, frightened, stunned, and knocked unconscious.',
      order: 1
    },
    {
      id: S.featureId(100, 2),
      label: 'Wakeful',
      description: "Wakeful. When one of the ettin's heads is asleep, its other head is awake.",
      order: 2
    },
    {
      id: S.featureId(100, 3),
      label: 'Multiattack',
      description:
        'Multiattack. The ettin makes two attacks: one with its battleaxe and one with its morningstar.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(100, 4) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(100, 5) }] }
            ]
          }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(100, 4),
      label: 'Battleaxe',
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) slashing damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 100,
          localIndex: 21,
          kind: 'MELEE',
          feet: 5,
          damageType: 'SLASHING',
          diceConfig: '2d8',
          ability: 'STRENGTH'
        })
      ],
      order: 4
    },
    {
      id: S.featureId(100, 5),
      label: 'Morningstar',
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) piercing damage.',
      effects: [
        {
          id: S.actionId(100, 8),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(100, 9),
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
              id: S.actionId(100, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(100, 10) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(100, 10),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8',
                    bonuses: [
                      {
                        id: S.actionId(100, 11),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
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
      order: 5
    }
  ]
}
