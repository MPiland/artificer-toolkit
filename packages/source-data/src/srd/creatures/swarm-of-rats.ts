import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const swarmOfRats: CreatureAuthored = {
  id: S.CREATURE_IDS.SWARM_OF_RATS,
  label: 'Swarm of Rats',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 9,
    DEXTERITY: 11,
    CONSTITUTION: 9,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 3
  },
  armorClass: 10,
  hitPoints: 24,
  hitDice: {
    count: 7,
    die: 8,
    modifier: -7
  },
  speeds: [...S.walk(30)],
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
  senses: ['darkvision 30 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(316, 1),
      label: 'Keen Smell',
      description:
        'Keen Smell. The swarm has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 1
    },
    {
      id: S.featureId(316, 2),
      label: 'Swarm',
      description:
        "Swarm. The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny rat. The swarm can't regain hit points or gain temporary hit points.",
      order: 2
    },
    {
      id: S.featureId(316, 3),
      label: 'Bites',
      description:
        "Bites. Melee Weapon Attack: +2 to hit, reach 0 ft., one target in the swarm's space. Hit: 7 (2d6) piercing damage, or 3 (1d6) piercing damage if the swarm has half of its hit points or fewer.",
      effects: [
        S.weaponAttack({
          creatureIndex: 316,
          localIndex: 1,
          kind: 'MELEE',
          feet: 0,
          damageType: 'PIERCING',
          diceConfig: '2d6',
          ability: null
        })
      ],
      order: 3
    }
  ]
}
