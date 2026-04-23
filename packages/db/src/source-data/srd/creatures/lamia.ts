import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const lamia: CreatureAuthored = {
  id: S.CREATURE_IDS.LAMIA,
  label: 'Lamia',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 13,
    CONSTITUTION: 15,
    INTELLIGENCE: 14,
    WISDOM: 15,
    CHARISMA: 16,
    SPELLCASTING: 0
  },
  armorClass: 13,
  armorClassNote: 'natural armor',
  hitPoints: 97,
  hitDice: '13d10+26',
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillProficiency(181, 1, 'DECEPTION', 'INSIGHT', 'STEALTH'),
    S.grantedLanguageProficiency(181, 2, 'ABYSSAL', 'COMMON')
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(181, 1),
      label: 'Innate Spellcasting',
      description: "Innate Spellcasting. The lamia's innate spellcasting ability is Charisma (spell save DC 13). It can innately cast the following spells, requiring no material components: At will: disguise self (any humanoid form), major image. 3/day each: charm person, mirror image, scrying, suggestion. 1/day each: geas.",
      order: 1
    },
    {
      id: S.featureId(181, 2),
      label: 'Multiattack',
      description: 'Multiattack. The lamia makes two attacks: one with its claws and one with its dagger or Intoxicating Touch.',
      order: 2
    },
    {
      id: S.featureId(181, 3),
      label: 'Claws',
      description: 'Claws. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 14 (2d10 + 3) slashing damage.',
      order: 3
    },
    {
      id: S.featureId(181, 4),
      label: 'Dagger',
      description: 'Dagger. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 5 (1d4 + 3) piercing damage.',
      order: 4
    },
    {
      id: S.featureId(181, 5),
      label: 'Intoxicating Touch',
      description: 'Intoxicating Touch. Melee Spell Attack: +5 to hit, reach 5 ft., one creature. Hit: The target is magically cursed for 1 hour. Until the curse ends, the target has disadvantage on Wisdom saving throws and all ability checks.',
      order: 5
    }
  ]
}

