import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const efreeti: CreatureAuthored = {
  id: S.CREATURE_IDS.EFREETI,
  label: 'Efreeti',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 22,
    DEXTERITY: 12,
    CONSTITUTION: 24,
    INTELLIGENCE: 16,
    WISDOM: 15,
    CHARISMA: 16,
    SPELLCASTING: 0
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 200,
  hitDice: '16d10+112',
  speeds: [...S.walk(40), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(95, 1, 'INTELLIGENCE', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(95, 2, 'IGNAN')
  ],
  damageImmunities: ['fire'],
  senses: ['darkvision 120 ft.'],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_11,
  xp: 7200,
  features: [
    {
      id: S.featureId(95, 1),
      label: 'Elemental Demise',
      description: 'Elemental Demise. If the efreeti dies, its body disintegrates in a flash of fire and puff of smoke, leaving behind only equipment the efreeti was wearing or carrying.',
      order: 1
    },
    {
      id: S.featureId(95, 2),
      label: 'Innate Spellcasting',
      description: "Innate Spellcasting. The efreeti's innate spellcasting ability is Charisma (spell save DC 15, +7 to hit with spell attacks). It can innately cast the following spells, requiring no material components: At will: detect magic. 3/day each: enlarge/reduce, tongues. 1/day each: conjure elemental (fire elemental only), gaseous form, invisibility, major image, plane shift, wall of fire.",
      order: 2
    },
    {
      id: S.featureId(95, 3),
      label: 'Multiattack',
      description: 'Multiattack. The efreeti makes two scimitar attacks or uses its Hurl Flame twice.',
      order: 3
    },
    {
      id: S.featureId(95, 4),
      label: 'Scimitar',
      description: 'Scimitar. Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 13 (2d6 + 6) slashing damage plus 7 (2d6) fire damage.',
      order: 4
    },
    {
      id: S.featureId(95, 5),
      label: 'Hurl Flame',
      description: 'Hurl Flame. Ranged Spell Attack: +7 to hit, range 120 ft., one target. Hit: 17 (5d6) fire damage.',
      order: 5
    }
  ]
}

