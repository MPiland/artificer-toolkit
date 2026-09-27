import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const gnoll: CreatureAuthored = {
  id: S.CREATURE_IDS.GNOLL,
  label: 'Gnoll',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['gnoll'],
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 12,
    CONSTITUTION: 11,
    INTELLIGENCE: 6,
    WISDOM: 10,
    CHARISMA: 7
  },
  armorClass: 15,
  armorClassNote: 'hide armor, shield',
  hitPoints: 22,
  hitDice: {
    count: 5,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(30)],
  proficiencies: [S.grantedLanguageProficiency(144, 1, 'GNOLL')],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(144, 1),
      label: 'Rampage',
      description:
        'Rampage. When the gnoll reduces a creature to 0 hit points with a melee attack on its turn, the gnoll can take a bonus action to move up to half its speed and make a bite attack.',
      order: 1
    },
    {
      id: S.featureId(144, 2),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 4 (1d4 + 2) piercing damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 144,
          localIndex: 1,
          kind: 'MELEE',
          feet: 5,
          damageType: 'PIERCING',
          diceConfig: '1d4',
          ability: 'STRENGTH'
        })
      ],
      order: 2
    },
    {
      id: S.featureId(144, 3),
      label: 'Spear',
      description:
        'Spear. Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 5 (1d6 + 2) piercing damage, or 6 (1d8 + 2) piercing damage if used with two hands to make a melee attack.',
      effects: [
        S.weaponAttack({
          creatureIndex: 144,
          localIndex: 11,
          kind: 'MELEE',
          feet: 5,
          damageType: 'PIERCING',
          diceConfig: '1d6',
          ability: 'STRENGTH'
        }),
        S.weaponAttack({
          creatureIndex: 144,
          localIndex: 21,
          kind: 'RANGED',
          feet: 20,
          damageType: 'PIERCING',
          diceConfig: '1d6',
          ability: 'STRENGTH'
        })
      ],
      order: 3
    },
    {
      id: S.featureId(144, 4),
      label: 'Longbow',
      description:
        'Longbow. Ranged Weapon Attack: +3 to hit, range 150/600 ft., one target. Hit: 5 (1d8 + 1) piercing damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 144,
          localIndex: 31,
          kind: 'RANGED',
          feet: 150,
          damageType: 'PIERCING',
          diceConfig: '1d8',
          ability: 'DEXTERITY'
        })
      ],
      order: 4
    }
  ]
}
