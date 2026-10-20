import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const stoneGiant: CreatureAuthored = {
  id: S.CREATURE_IDS.STONE_GIANT,
  label: 'Stone Giant',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.GIANT,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 23,
    DEXTERITY: 15,
    CONSTITUTION: 20,
    INTELLIGENCE: 10,
    WISDOM: 12,
    CHARISMA: 9
  },
  naturalArmorBonus: 5,
  hitPoints: 126,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 11,
    die: 12,
    modifier: 55
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedLanguageProficiency(3307, 4, 'GIANT'),
    S.grantedSkillExpertise(3307, 3, 'ATHLETICS'),
    S.grantedSaveProficiency(3307, 2, 'DEXTERITY', 'CONSTITUTION', 'WISDOM'),
    S.grantedSkillProficiency(3307, 1, 'PERCEPTION')
  ],
  senses: [S.darkvision(60)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_7,
  xp: 2900,
  features: [
    {
      id: S.featureId(264, 1),
      label: 'Stone Camouflage',
      description:
        'Stone Camouflage. The giant has advantage on Dexterity (Stealth) checks made to hide in rocky terrain.',
      order: 1
    },
    {
      id: S.featureId(264, 2),
      label: 'Greatclub',
      description:
        'Greatclub. Melee Weapon Attack: +9 to hit, reach 15 ft., one target. Hit: 19 (3d8 + 6) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(3307, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3307, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 15,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(3307, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(3307, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(3307, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8+6'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 2
    },
    {
      id: S.featureId(264, 3),
      label: 'Rock',
      description:
        'Rock. Ranged Weapon Attack: +9 to hit, range 60/240 ft., one target. Hit: 28 (4d10 + 6) bludgeoning damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 264,
          localIndex: 1,
          kind: 'RANGED',
          feet: 60,
          longFeet: 240,
          damageType: 'BLUDGEONING',
          diceConfig: '4d10',
          ability: 'STRENGTH'
        })
      ],
      order: 3
    },
    {
      id: S.featureId(264, 4),
      label: 'Multiattack',
      description: 'Multiattack. The giant makes two greatclub attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(264, 2) }] }] }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(264, 5),
      label: 'Rock Catching',
      description:
        'Rock Catching. If a rock or similar object is hurled at the giant, the giant can, with a successful DC 10 Dexterity saving throw, catch the missile and take no bludgeoning damage from it.',
      order: 5
    }
  ]
}
