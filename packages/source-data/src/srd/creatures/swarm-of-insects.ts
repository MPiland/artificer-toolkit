import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const swarmOfInsects: CreatureAuthored = {
  id: S.CREATURE_IDS.SWARM_OF_INSECTS,
  label: 'Swarm of Insects',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 3,
    DEXTERITY: 13,
    CONSTITUTION: 10,
    INTELLIGENCE: 1,
    WISDOM: 7,
    CHARISMA: 1
  },
  armorClass: 12,
  armorClassNote: 'natural armor',
  hitPoints: 22,
  hitDice: {
    count: 5,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(20), ...S.climb(20)],
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
  senses: ['blindsight 10 ft.'],
  passivePerception: 8,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(313, 1),
      label: 'Swarm',
      description:
        "Swarm. The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny insect. The swarm can't regain hit points or gain temporary hit points.",
      order: 1
    },
    {
      id: S.featureId(313, 2),
      label: 'Bites',
      description:
        "Bites. Melee Weapon Attack: +3 to hit, reach 0 ft., one target in the swarm's space. Hit: 10 (4d4) piercing damage, or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer.",
      effects: [
        S.weaponAttack({
          creatureIndex: 313,
          localIndex: 1,
          kind: 'MELEE',
          feet: 0,
          damageType: 'PIERCING',
          diceConfig: '4d4',
          ability: null
        })
      ],
      order: 2
    }
  ]
}
