import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const greenHag: CreatureAuthored = {
  id: S.CREATURE_IDS.GREEN_HAG,
  label: 'Green Hag',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FEY,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 12,
    CONSTITUTION: 16,
    INTELLIGENCE: 13,
    WISDOM: 14,
    CHARISMA: 14,
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 82,
  hitDice: {
    count: 11,
    die: 8,
    modifier: 33,
  },
  speeds: [...S.walk(30), ...S.swim(30)],
  proficiencies: [
    S.grantedSkillProficiency(4388, 1, 'ARCANA', 'DECEPTION', 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(4388, 2, 'COMMON', 'DRACONIC', 'SYLVAN')
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(151, 1),
      label: 'Amphibious',
      description: 'Amphibious. The hag can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(151, 2),
      label: 'Innate Spellcasting',
      description: "Innate Spellcasting. The hag's innate spellcasting ability is Charisma (spell save DC 12). She can innately cast the following spells, requiring no material components: At will: dancing lights, minor illusion, vicious mockery.",
      order: 2
    },
    {
      id: S.featureId(151, 3),
      label: 'Mimicry',
      description: 'Mimicry. The hag can mimic animal sounds and humanoid voices. A creature that hears the sounds can tell they are imitations with a successful DC 14 Wisdom (Insight) check.',
      order: 3
    },
    {
      id: S.featureId(151, 4),
      label: 'Claws',
      description: 'Claws. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) slashing damage.',
      order: 4
    },
    {
      id: S.featureId(151, 5),
      label: 'Illusory Appearance',
      description: 'Illusory Appearance. The hag covers herself and anything she is wearing or carrying with a magical illusion that makes her look like another creature of her general size and humanoid shape. The illusion ends if the hag takes a bonus action to end it or if she dies. The changes wrought by this effect fail to hold up to physical inspection. Otherwise, a creature must take an action to visually inspect the illusion and succeed on a DC 20 Intelligence (Investigation) check to discern that the hag is disguised.',
      order: 5
    },
    {
      id: S.featureId(151, 6),
      label: 'Invisible Passage',
      description: 'Invisible Passage. The hag magically turns invisible until she attacks or casts a spell, or until her concentration ends (as if concentrating on a spell). While invisible, she leaves no physical evidence of her passage, so she can be tracked only by magic. Any equipment she wears or carries is invisible with her.',
      order: 6
    }
  ]
}

