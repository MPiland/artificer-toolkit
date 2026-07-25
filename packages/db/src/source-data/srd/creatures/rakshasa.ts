import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const rakshasa: CreatureAuthored = {
  id: S.CREATURE_IDS.RAKSHASA,
  label: 'Rakshasa',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 17,
    CONSTITUTION: 18,
    INTELLIGENCE: 13,
    WISDOM: 16,
    CHARISMA: 20,
  },
  armorClass: 16,
  armorClassNote: 'natural armor',
  hitPoints: 110,
  hitDice: {
    count: 13,
    die: 8,
    modifier: 52,
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillProficiency(230, 1, 'DECEPTION', 'INSIGHT'),
    S.grantedLanguageProficiency(230, 2, 'COMMON', 'INFERNAL')
  ],
  damageVulnerabilities: ['piercing from magic weapons wielded by good creatures'],
  damageImmunities: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_13,
  xp: 10000,
  features: [
    {
      id: S.featureId(230, 1),
      label: 'Limited Magic Immunity',
      description: "Limited Magic Immunity. The rakshasa can't be affected or detected by spells of 6th level or lower unless it wishes to be. It has advantage on saving throws against all other spells and magical effects.",
      order: 1
    },
    {
      id: S.featureId(230, 2),
      label: 'Innate Spellcasting',
      description: "Innate Spellcasting. The rakshasa's innate spellcasting ability is Charisma (spell save DC 18, +10 to hit with spell attacks). The rakshasa can innately cast the following spells, requiring no material components: At will: detect thoughts, disguise self, mage hand, minor illusion. 3/day each: charm person, detect magic, invisibility, major image, suggestion. 1/day each: dominate person, fly, plane shift, true seeing.",
      order: 2
    },
    {
      id: S.featureId(230, 3),
      label: 'Multiattack',
      description: 'The rakshasa makes two claw attacks.',
      order: 3
    },
    {
      id: S.featureId(230, 4),
      label: 'Claw',
      description: "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 9 (2d6 + 2) slashing damage, and the target is cursed if it is a creature. The magical curse takes effect whenever the target takes a short or long rest, filling the target's thoughts with horrible images and dreams. The cursed target gains no benefit from finishing a short or long rest. The curse lasts until it is lifted by a remove curse spell or similar magic.",
      order: 4
    }
  ]
}

