import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const airElemental: CreatureAuthored = {
  id: S.CREATURE_IDS.AIR_ELEMENTAL,
  label: 'Air Elemental',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.LARGE,
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 20,
    CONSTITUTION: 14,
    INTELLIGENCE: 6,
    WISDOM: 10,
    CHARISMA: 6,
    SPELLCASTING: 0
  },
  armorClass: 15,
  hitPoints: 90,
  hitDice: '12d10+24',
  speeds: [...S.walk(0), ...S.fly(90)],
  proficiencies: [S.grantedLanguageProficiency(6076, 1, 'AURAN')],
  damageResistances: ['lightning; thunder; bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['poison'],
  conditionImmunities: ['exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(6076, 1),
      label: 'Air Form',
      description: "Air Form. The elemental can enter a hostile creature's space and stop there. It can move through a space as narrow as 1 inch wide without squeezing.",
      order: 1
    },
    {
      id: S.featureId(6076, 2),
      label: 'Whirlwind (Recharge 4-6)',
      description: 'Whirlwind (Recharge 4-6). Each creature in the elemental\'s space must make a Strength saving throw. On a failure, a target takes bludgeoning damage, is flung up to 20 feet away in a random direction, and is knocked prone. If a thrown target strikes an object, it takes additional bludgeoning damage. If the saving throw is successful, the target takes half damage and is not flung or knocked prone.',
      order: 2
    },
    {
      id: S.featureId(6076, 3),
      label: 'Multiattack',
      description: 'Multiattack. The elemental makes two slam attacks.',
      order: 3
    },
    {
      id: S.featureId(6076, 4),
      label: 'Slam',
      description: 'Slam. Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) bludgeoning damage.',
      order: 4
    }
  ]
}

