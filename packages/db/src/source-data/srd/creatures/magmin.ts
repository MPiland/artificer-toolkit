import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const magmin: CreatureAuthored = {
  id: S.CREATURE_IDS.MAGMIN,
  label: 'Magmin',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 7,
    DEXTERITY: 15,
    CONSTITUTION: 12,
    INTELLIGENCE: 8,
    WISDOM: 11,
    CHARISMA: 10,
    SPELLCASTING: 0
  },
  armorClass: 14,
  armorClassNote: 'natural armor',
  hitPoints: 9,
  hitDice: '2d6+2',
  speeds: [...S.walk(30)],
  proficiencies: [S.grantedLanguageProficiency(3713, 1, 'IGNAN')],
  damageResistances: ['bludgeoning', 'piercing', 'slashing'],
  damageImmunities: ['fire'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(3713, 1),
      label: 'Death Burst',
      description: 'Death Burst. When the magmin dies, it explodes in a burst of fire and magma. Each creature within 10 feet of it must make a DC 11 Dexterity saving throw, taking 7 (2d6) fire damage on a failed save, or half as much damage on a successful one. Flammable objects that aren\'t being worn or carried in that area are ignited.',
      order: 1
    },
    {
      id: S.featureId(3713, 2),
      label: 'Ignited Illumination',
      description: 'Ignited Illumination. As a bonus action, the magmin can set itself ablaze or extinguish its flames. While ablaze, the magmin sheds bright light in a 10-foot radius and dim light for an additional 10 feet.',
      order: 2
    },
    {
      id: S.featureId(3713, 3),
      label: 'Touch',
      description: 'Touch. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d6) fire damage. If the target is a creature or a flammable object, it ignites. Until a creature takes an action to douse the fire, the target takes 3 (1d6) fire damage at the end of each of its turns.',
      order: 3
    }
  ]
}
