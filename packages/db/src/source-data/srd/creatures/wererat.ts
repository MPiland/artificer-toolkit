import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const wererat: CreatureAuthored = {
  id: S.CREATURE_IDS.WERERAT,
  label: 'Wererat',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['human', 'shapechanger'],
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 15,
    CONSTITUTION: 12,
    INTELLIGENCE: 11,
    WISDOM: 10,
    CHARISMA: 8,
    SPELLCASTING: 0
  },
  armorClass: 12,
  hitPoints: 33,
  hitDice: '6d8+6',
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillProficiency(289, 1, 'PERCEPTION', 'STEALTH')
  ],
  damageImmunities: ['bludgeoning, piercing, and slashing from nonmagical attacks not made with silvered weapons'],
  senses: ['darkvision 60 ft. (rat form only)'],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(289, 1),
      label: 'Shapechanger',
      description: "Shapechanger. The wererat can use its action to polymorph into a rat-humanoid hybrid or into a giant rat, or back into its true form, which is humanoid. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
      order: 1
    },
    {
      id: S.featureId(289, 2),
      label: 'Keen Smell',
      description: 'Keen Smell. The wererat has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 2
    },
    {
      id: S.featureId(289, 3),
      label: 'Speech Limitation',
      description: 'Common (can\'t speak in rat form).',
      grants: {
        proficiencies: [
          S.grantedLanguageProficiency(289, 2, 'COMMON')
        ]
      },
      order: 3
    },
    {
      id: S.featureId(289, 4),
      label: 'Multiattack (Humanoid or Hybrid Form Only)',
      description: 'Multiattack (Humanoid or Hybrid Form Only). The wererat makes two attacks, only one of which can be a bite.',
      order: 4
    },
    {
      id: S.featureId(289, 5),
      label: 'Bite (Rat or Hybrid Form Only)',
      description: 'Bite (Rat or Hybrid Form Only). Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage. If the target is a humanoid, it must succeed on a DC 11 Constitution saving throw or be cursed with wererat lycanthropy.',
      order: 5
    },
    {
      id: S.featureId(289, 6),
      label: 'Hand Crossbow (Humanoid or Hybrid Form Only)',
      description: 'Hand Crossbow (Humanoid or Hybrid Form Only). Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      order: 6
    },
    {
      id: S.featureId(289, 7),
      label: 'Shortsword (Humanoid or Hybrid Form Only)',
      description: 'Shortsword (Humanoid or Hybrid Form Only). Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      capabilities: [
        {
          id: S.actionId(289, 4),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(289, 14),
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
              id: S.actionId(289, 15),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d6',
              bonuses: [
                {
                  id: S.actionId(289, 16),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 7
    }
  ]
}
