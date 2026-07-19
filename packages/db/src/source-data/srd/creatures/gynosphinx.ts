import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const gynosphinx: CreatureAuthored = {
  id: S.CREATURE_IDS.GYNOSPHINX,
  label: 'Gynosphinx',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000400000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 15,
    CONSTITUTION: 16,
    INTELLIGENCE: 18,
    WISDOM: 18,
    CHARISMA: 18,
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 136,
  hitDice: '16d10+48',
  speeds: [...S.walk(40), ...S.fly(60)],
  proficiencies: [
    S.grantedSkillProficiency(3029, 1, 'ARCANA', 'HISTORY', 'PERCEPTION', 'RELIGION'),
    S.grantedLanguageProficiency(3029, 2, 'COMMON', 'SPHINX')
  ],
  damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['psychic'],
  conditionImmunities: ['charmed', 'frightened'],
  senses: ['truesight 120 ft.'],
  passivePerception: 18,
  challengeRatingId: S.CR.CR_11,
  xp: 7200,
  features: [
    {
      id: S.featureId(157, 1),
      label: 'Inscrutable',
      description: 'Inscrutable. The sphinx is immune to any effect that would sense its emotions or read its thoughts, as well as any divination spell that it refuses. Wisdom (Insight) checks made to ascertain the sphinx\'s intentions or sincerity have disadvantage.',
      order: 1
    },
    {
      id: S.featureId(157, 2),
      label: 'Magic Weapons',
      description: 'Magic Weapons. The sphinx\'s weapon attacks are magical.',
      order: 2
    },
    {
      id: S.featureId(157, 3),
      label: 'Spellcasting',
      description: 'Spellcasting. The sphinx is a 9th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 16, +8 to hit with spell attacks). It requires no material components to cast its spells. The sphinx has the following wizard spells prepared: Cantrips (at will): mage hand, minor illusion, prestidigitation. 1st level (4 slots): detect magic, identify, shield. 2nd level (3 slots): darkness, locate object, suggestion. 3rd level (3 slots): dispel magic, remove curse, tongues. 4th level (3 slots): banishment, greater invisibility. 5th level (1 slot): legend lore.',
      order: 3
    },
    {
      id: S.featureId(157, 4),
      label: 'Multiattack',
      description: 'Multiattack. The sphinx makes two claw attacks.',
      order: 4
    },
    {
      id: S.featureId(157, 5),
      label: 'Claw',
      description: 'Claw. Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) slashing damage.',
      order: 5
    },
    {
      id: S.featureId(157, 6),
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      description: 'Legendary Actions. The sphinx can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature\'s turn. The sphinx regains spent legendary actions at the start of its turn. Claw Attack. The sphinx makes one claw attack. Teleport (Costs 2 Actions). The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see. Cast a Spell (Costs 3 Actions). The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.',
      order: 6
    }
  ]
}

