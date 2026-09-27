import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const swarmOfBats: CreatureAuthored = {
  id: S.CREATURE_IDS.SWARM_OF_BATS,
  label: 'Swarm of Bats',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 5,
    DEXTERITY: 15,
    CONSTITUTION: 10,
    INTELLIGENCE: 2,
    WISDOM: 12,
    CHARISMA: 4
  },
  armorClass: 12,
  hitPoints: 22,
  hitDice: {
    count: 5,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(0), ...S.fly(30)],
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
  senses: ['blindsight 60 ft.'],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(312, 1),
      label: 'Echolocation',
      description: "Echolocation. The swarm can't use its blindsight while deafened.",
      order: 1
    },
    {
      id: S.featureId(312, 2),
      label: 'Keen Hearing',
      description:
        'Keen Hearing. The swarm has advantage on Wisdom (Perception) checks that rely on hearing.',
      order: 2
    },
    {
      id: S.featureId(312, 3),
      label: 'Swarm',
      description:
        "Swarm. The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny bat. The swarm can't regain hit points or gain temporary hit points.",
      order: 3
    },
    {
      id: S.featureId(312, 4),
      label: 'Bites',
      description:
        "Bites. Melee Weapon Attack: +4 to hit, reach 0 ft., one creature in the swarm's space. Hit: 5 (2d4) piercing damage, or 2 (1d4) piercing damage if the swarm has half of its hit points or fewer.",
      effects: [
        S.weaponAttack({
          creatureIndex: 312,
          localIndex: 1,
          kind: 'MELEE',
          feet: 0,
          damageType: 'PIERCING',
          diceConfig: '2d4',
          halfHitPointsDiceConfig: '1d4',
          ability: null
        })
      ],
      order: 4
    }
  ]
}
