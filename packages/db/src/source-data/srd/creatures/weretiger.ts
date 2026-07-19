import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const weretiger: CreatureAuthored = {
  id: S.CREATURE_IDS.WERETIGER,
  label: 'Weretiger',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['human', 'shapechanger'],
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 15,
    CONSTITUTION: 16,
    INTELLIGENCE: 10,
    WISDOM: 13,
    CHARISMA: 11,
  },
  armorClass: 12,
  hitPoints: 120,
  hitDice: '16d8+48',
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillProficiency(290, 1, 'PERCEPTION', 'STEALTH')
  ],
  damageImmunities: ['bludgeoning, piercing, and slashing from nonmagical attacks not made with silvered weapons'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 15,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(290, 1),
      label: 'Shapechanger',
      description: "Shapechanger. The weretiger can use its action to polymorph into a tiger-humanoid hybrid or into a tiger, or back into its true form, which is humanoid. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
      order: 1
    },
    {
      id: S.featureId(290, 2),
      label: 'Keen Hearing and Smell',
      description: 'Keen Hearing and Smell. The weretiger has advantage on Wisdom (Perception) checks that rely on hearing or smell.',
      order: 2
    },
    {
      id: S.featureId(290, 3),
      label: 'Pounce (Tiger or Hybrid Form Only)',
      description: 'Pounce (Tiger or Hybrid Form Only). If the weretiger moves at least 15 feet straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 14 Strength saving throw or be knocked prone. If the target is prone, the weretiger can make one bite attack against it as a bonus action.',
      order: 3
    },
    {
      id: S.featureId(290, 4),
      label: 'Speech Limitation',
      description: 'Common (can\'t speak in tiger form).',
      grants: {
        proficiencies: [
          S.grantedLanguageProficiency(290, 2, 'COMMON')
        ]
      },
      order: 4
    },
    {
      id: S.featureId(290, 5),
      label: 'Multiattack (Humanoid or Hybrid Form Only)',
      description: 'Multiattack (Humanoid or Hybrid Form Only). In humanoid form, the weretiger makes two scimitar attacks or two longbow attacks. In hybrid form, it can attack like a humanoid or make two claw attacks.',
      order: 5
    },
    {
      id: S.featureId(290, 6),
      label: 'Bite (Tiger or Hybrid Form Only)',
      description: 'Bite (Tiger or Hybrid Form Only). Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (1d10 + 3) piercing damage. If the target is a humanoid, it must succeed on a DC 13 Constitution saving throw or be cursed with weretiger lycanthropy.',
      order: 6
    },
    {
      id: S.featureId(290, 7),
      label: 'Claw (Tiger or Hybrid Form Only)',
      description: 'Claw (Tiger or Hybrid Form Only). Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage.',
      order: 7
    },
    {
      id: S.featureId(290, 8),
      label: 'Scimitar (Humanoid or Hybrid Form Only)',
      description: 'Scimitar (Humanoid or Hybrid Form Only). Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.',
      order: 8
    },
    {
      id: S.featureId(290, 9),
      label: 'Longbow (Humanoid or Hybrid Form Only)',
      description: 'Longbow (Humanoid or Hybrid Form Only). Ranged Weapon Attack: +4 to hit, range 150/600 ft., one target. Hit: 6 (1d8 + 2) piercing damage.',
      order: 9
    }
  ]
}

