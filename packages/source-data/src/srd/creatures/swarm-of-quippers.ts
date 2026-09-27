import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const swarmOfQuippers: CreatureAuthored = {
  id: S.CREATURE_IDS.SWARM_OF_QUIPPERS,
  label: 'Swarm of Quippers',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 13,
    DEXTERITY: 16,
    CONSTITUTION: 9,
    INTELLIGENCE: 1,
    WISDOM: 7,
    CHARISMA: 2
  },
  armorClass: 13,
  hitPoints: 28,
  hitDice: {
    count: 8,
    die: 8,
    modifier: -8
  },
  speeds: [...S.walk(0), ...S.swim(40)],
  damageResistances: ['bludgeoning', 'piercing', 'slashing'],
  conditionImmunities: [
    'charmed',
    'frightened',
    'grappled',
    'paralyzed',
    'petrified',
    'prone',
    'restrained',
    'stunned'
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 8,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(315, 1),
      label: 'Blood Frenzy',
      description:
        "Blood Frenzy. The swarm has advantage on melee attack rolls against any creature that doesn't have all its hit points.",
      order: 1
    },
    {
      id: S.featureId(315, 2),
      label: 'Swarm',
      description:
        "Swarm. The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny quipper. The swarm can't regain hit points or gain temporary hit points.",
      order: 2
    },
    {
      id: S.featureId(315, 3),
      label: 'Water Breathing',
      description: 'Water Breathing. The swarm can breathe only underwater.',
      order: 3
    },
    {
      id: S.featureId(315, 4),
      label: 'Bites',
      description:
        "Bites. Melee Weapon Attack: +5 to hit, reach 0 ft., one creature in the swarm's space. Hit: 14 (4d6) piercing damage, or 7 (2d6) piercing damage if the swarm has half of its hit points or fewer.",
      effects: [
        S.weaponAttack({
          creatureIndex: 315,
          localIndex: 1,
          kind: 'MELEE',
          feet: 0,
          damageType: 'PIERCING',
          diceConfig: '4d6',
          halfHitPointsDiceConfig: '2d6',
          ability: null
        })
      ],
      order: 4
    }
  ]
}
