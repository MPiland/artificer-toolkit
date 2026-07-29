import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const mummyLord: CreatureAuthored = {
  id: S.CREATURE_IDS.MUMMY_LORD,
  label: 'Mummy Lord',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 10,
    CONSTITUTION: 17,
    INTELLIGENCE: 11,
    WISDOM: 18,
    CHARISMA: 16
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 97,
  hitDice: {
    count: 13,
    die: 8,
    modifier: 39
  },
  speeds: [...S.walk(20)],
  proficiencies: [
    S.grantedSaveProficiency(2129, 1, 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(2129, 2, 'HISTORY', 'RELIGION')
  ],
  damageVulnerabilities: ['fire'],
  damageImmunities: ['necrotic', 'poison', 'bludgeoning', 'piercing', 'slashing'],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_15,
  xp: 13000,
  features: [
    {
      id: S.featureId(202, 1),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The mummy lord has advantage on saving throws against spells and other magical effects.',
      order: 1
    },
    {
      id: S.featureId(202, 2),
      label: 'Rejuvenation',
      description:
        "Rejuvenation. A destroyed mummy lord gains a new body in 24 hours if its heart is intact, regaining all its hit points and becoming active again. The new body appears within 5 feet of the mummy lord's heart.",
      order: 2
    },
    {
      id: S.featureId(202, 3),
      label: 'Spellcasting',
      description:
        'Spellcasting. The mummy lord is a 10th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 17, +9 to hit with spell attacks). The mummy lord has the following cleric spells prepared: Cantrips (at will): sacred flame, thaumaturgy. 1st level (4 slots): command, guiding bolt, shield of faith. 2nd level (3 slots): hold person, silence, spiritual weapon. 3rd level (3 slots): animate dead, dispel magic. 4th level (3 slots): divination, guardian of faith. 5th level (2 slots): contagion, insect plague. 6th level (1 slot): harm.',
      order: 3
    },
    {
      id: S.featureId(202, 4),
      label: 'Multiattack',
      description:
        'Multiattack. The mummy lord can use its Dreadful Glare and makes one attack with its rotting fist.',
      order: 4
    },
    {
      id: S.featureId(202, 5),
      label: 'Rotting Fist',
      description:
        "Rotting Fist. Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 14 (3d6 + 4) bludgeoning damage plus 21 (6d6) necrotic damage. If the target is a creature, it must succeed on a DC 16 Constitution saving throw or be cursed with mummy rot. The cursed target can't regain hit points, and its hit point maximum decreases by 10 (3d6) for every 24 hours that elapse. If the curse reduces the target's hit point maximum to 0, the target dies, and its body turns to dust. The curse lasts until removed by the remove curse spell or other magic.",
      order: 5
    },
    {
      id: S.featureId(202, 6),
      label: 'Dreadful Glare',
      description:
        "Dreadful Glare. The mummy lord targets one creature it can see within 60 feet of it. If the target can see the mummy lord, it must succeed on a DC 16 Wisdom saving throw against this magic or become frightened until the end of the mummy lord's next turn. If the target fails the saving throw by 5 or more, it is also paralyzed for the same duration. A target that succeeds on the saving throw is immune to the Dreadful Glare of all mummies and mummy lords for the next 24 hours.",
      order: 6
    },
    {
      id: S.featureId(202, 7),
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      description:
        "Legendary Actions. The mummy lord can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The mummy lord regains spent legendary actions at the start of its turn. Attack. The mummy lord makes one attack with its rotting fist or uses its Dreadful Glare. Blinding Dust. Blinding dust and sand swirls magically around the mummy lord. Each creature within 5 feet of the mummy lord must succeed on a DC 16 Constitution saving throw or be blinded until the end of the creature's next turn. Blasphemous Word (Costs 2 Actions). The mummy lord utters a blasphemous word. Each non-undead creature within 10 feet of the mummy lord that can hear the magical utterance must succeed on a DC 16 Constitution saving throw or be stunned until the end of the mummy lord's next turn. Channel Negative Energy (Costs 2 Actions). The mummy lord magically unleashes negative energy. Creatures within 60 feet of the mummy lord, including ones behind barriers and around corners, can't regain hit points until the end of the mummy lord's next turn. Whirlwind of Sand (Costs 2 Actions). The mummy lord magically transforms into a whirlwind of sand, moves up to 60 feet, and reverts to its normal form.",
      order: 7
    }
  ]
}
