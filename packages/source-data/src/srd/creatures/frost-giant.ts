import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const frostGiant: CreatureAuthored = {
  id: S.CREATURE_IDS.FROST_GIANT,
  label: 'Frost Giant',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.GIANT,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 23,
    DEXTERITY: 9,
    CONSTITUTION: 21,
    INTELLIGENCE: 9,
    WISDOM: 10,
    CHARISMA: 12
  },
  armorClass: 15,
  armorClassNote: 'patchwork armor',
  hitPoints: 138,
  hitDice: {
    count: 12,
    die: 12,
    modifier: 60
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSaveProficiency(107, 1, 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(107, 2, 'ATHLETICS', 'PERCEPTION'),
    S.grantedLanguageProficiency(107, 3, 'GIANT')
  ],
  damageImmunities: ['cold'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(107, 1),
      label: 'Multiattack',
      description: 'The giant makes two greataxe attacks.',
      order: 1
    },
    {
      id: S.featureId(107, 2),
      label: 'Greataxe',
      description:
        'Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 25 (3d12 + 6) slashing damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 107,
          localIndex: 1,
          kind: 'MELEE',
          feet: 10,
          damageType: 'SLASHING',
          diceConfig: '3d12',
          ability: 'STRENGTH'
        })
      ],
      order: 2
    },
    {
      id: S.featureId(107, 3),
      label: 'Rock',
      description:
        'Ranged Weapon Attack: +9 to hit, range 60/240 ft., one target. Hit: 28 (4d10 + 6) bludgeoning damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 107,
          localIndex: 11,
          kind: 'RANGED',
          feet: 60,
          longFeet: 240,
          damageType: 'BLUDGEONING',
          diceConfig: '4d10',
          ability: 'STRENGTH'
        })
      ],
      order: 3
    }
  ]
}
