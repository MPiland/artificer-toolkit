import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const thug: CreatureAuthored = {
  id: S.CREATURE_IDS.THUG,
  label: 'Thug',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.NPC,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 11,
    CONSTITUTION: 14,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 11,
  },
  armorClass: 11,
  armorClassNote: 'leather armor',
  hitPoints: 32,
  hitDice: {
    count: 5,
    die: 8,
    modifier: 10,
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillProficiency(269, 1, 'INTIMIDATION')
  ],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(269, 1),
      label: 'Pack Tactics',
      description: "Pack Tactics. The thug has advantage on an attack roll against a creature if at least one of the thug's allies is within 5 feet of the creature and the ally isn't incapacitated.",
      order: 1
    },
    {
      id: S.featureId(269, 2),
      label: 'Language Knowledge',
      description: 'Any one language (usually Common).',
      grants: {
        proficiencies: [
          S.grantedLanguageProficiency(269, 2, 'COMMON')
        ]
      },
      order: 2
    },
    {
      id: S.featureId(269, 3),
      label: 'Multiattack',
      description: 'The thug makes two melee attacks.',
      order: 3
    },
    {
      id: S.featureId(269, 4),
      label: 'Mace',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.',
      order: 4
    },
    {
      id: S.featureId(269, 5),
      label: 'Heavy Crossbow',
      description: 'Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage.',
      order: 5
    }
  ]
}

