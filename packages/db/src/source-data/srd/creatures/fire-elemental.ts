import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const fireElemental: CreatureAuthored = {
  id: S.CREATURE_IDS.FIRE_ELEMENTAL,
  label: 'Fire Elemental',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.LARGE,
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 17,
    CONSTITUTION: 16,
    INTELLIGENCE: 6,
    WISDOM: 10,
    CHARISMA: 7,
  },
  armorClass: 13,
  hitPoints: 102,
  hitDice: '12d10+36',
  speeds: [...S.walk(50)],
  proficiencies: [
    S.grantedLanguageProficiency(101, 1, 'IGNAN')
  ],
  damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(101, 1),
      label: 'Fire Form',
      description: "Fire Form. The elemental can move through a space as narrow as 1 inch wide without squeezing. A creature that touches the elemental or hits it with a melee attack while within 5 feet of it takes 5 (1d10) fire damage. In addition, the elemental can enter a hostile creature's space and stop there. The first time it enters a creature's space on a turn, that creature takes 5 (1d10) fire damage and catches fire; until someone takes an action to douse the fire, the creature takes 5 (1d10) fire damage at the start of each of its turns.",
      order: 1
    },
    {
      id: S.featureId(101, 2),
      label: 'Illumination',
      description: 'Illumination. The elemental sheds bright light in a 30-foot radius and dim light in an additional 30 feet.',
      order: 2
    },
    {
      id: S.featureId(101, 3),
      label: 'Water Susceptibility',
      description: 'Water Susceptibility. For every 5 feet the elemental moves in water, or for every gallon of water splashed on it, it takes 1 cold damage.',
      order: 3
    },
    {
      id: S.featureId(101, 4),
      label: 'Multiattack',
      description: 'Multiattack. The elemental makes two touch attacks.',
      order: 4
    },
    {
      id: S.featureId(101, 5),
      label: 'Touch',
      description: 'Touch. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) fire damage. If the target is a creature or a flammable object, it ignites. Until a creature takes an action to douse the fire, the target takes 5 (1d10) fire damage at the start of each of its turns.',
      order: 5
    }
  ]
}

