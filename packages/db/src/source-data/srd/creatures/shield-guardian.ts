import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const shieldGuardian: CreatureAuthored = {
  id: S.CREATURE_IDS.SHIELD_GUARDIAN,
  label: 'Shield Guardian',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 8,
    CONSTITUTION: 18,
    INTELLIGENCE: 7,
    WISDOM: 10,
    CHARISMA: 3,
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 142,
  hitDice: {
    count: 15,
    die: 10,
    modifier: 60,
  },
  speeds: [...S.walk(30)],
  damageImmunities: ['poison'],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
  senses: ['blindsight 10 ft.', 'darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_7,
  xp: 2900,
  features: [
    {
      id: S.featureId(252, 1),
      label: 'Bound',
      description: "Bound. The shield guardian is magically bound to an amulet. As long as the guardian and its amulet are on the same plane of existence, the amulet's wearer can telepathically call the guardian to travel to it, and the guardian knows the distance and direction to the amulet. If the guardian is within 60 feet of the amulet's wearer, half of any damage the wearer takes (rounded up) is transferred to the guardian.",
      order: 1
    },
    {
      id: S.featureId(252, 2),
      label: 'Regeneration',
      description: 'Regeneration. The shield guardian regains 10 hit points at the start of its turn if it has at least 1 hit point.',
      order: 2
    },
    {
      id: S.featureId(252, 3),
      label: 'Spell Storing',
      description: "Spell Storing. A spellcaster who wears the shield guardian's amulet can cause the guardian to store one spell of 4th level or lower. To do so, the wearer must cast the spell on the guardian. The spell has no effect but is stored within the guardian. When commanded by the wearer, the guardian casts the spell using the spellcaster's spell save DC and spell attack bonus, with the original spell's targets, range, and other parameters, requiring no components.",
      order: 3
    },
    {
      id: S.featureId(252, 4),
      label: 'Language Limitation',
      description: 'Understands the languages of its creator but can\'t speak.',
      order: 4
    },
    {
      id: S.featureId(252, 5),
      label: 'Multiattack',
      description: 'The guardian makes two fist attacks.',
      order: 5
    },
    {
      id: S.featureId(252, 6),
      label: 'Fist',
      description: 'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage.',
      order: 6
    },
    {
      id: S.featureId(252, 7),
      label: 'Shield',
      description: "When a creature makes an attack against the wearer of the guardian's amulet, the guardian grants a +2 bonus to the wearer's AC against that attack, provided the guardian is within 5 feet of the wearer.",
      order: 7
    }
  ]
}

