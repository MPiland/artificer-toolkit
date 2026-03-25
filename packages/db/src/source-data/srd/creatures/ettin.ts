import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const ettin: CreatureAuthored = {
  id: S.CREATURE_IDS.ETTIN,
  label: 'Ettin',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
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
    CHARISMA: 8,
    SPELLCASTING: 0
  },
  armorClass: 12,
  armorClassNote: 'natural armor',
  hitPoints: 85,
  hitDice: '10d10+30',
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillProficiency(100, 1, 'PERCEPTION'),
    S.grantedLanguageProficiency(100, 2, 'GIANT', 'ORC')
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(100, 1),
      label: 'Two Heads',
      description: 'Two Heads. The ettin has advantage on Wisdom (Perception) checks and on saving throws against being blinded, charmed, deafened, frightened, stunned, and knocked unconscious.',
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
      description: 'Multiattack. The ettin makes two attacks: one with its battleaxe and one with its morningstar.',
      order: 3
    },
    {
      id: S.featureId(100, 4),
      label: 'Battleaxe',
      description: 'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) slashing damage.',
      order: 4
    },
    {
      id: S.featureId(100, 5),
      label: 'Morningstar',
      description: 'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) piercing damage.',
      capabilities: [
        {
          id: S.actionId(100, 8),
          order: 1,
          invocation: {
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
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(100, 10),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
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
      ],
      order: 5
    }
  ],
}
