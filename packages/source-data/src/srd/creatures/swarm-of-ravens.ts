import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const swarmOfRavens: CreatureAuthored = {
  id: S.CREATURE_IDS.SWARM_OF_RAVENS,
  label: 'Swarm of Ravens',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 6,
    DEXTERITY: 14,
    CONSTITUTION: 8,
    INTELLIGENCE: 3,
    WISDOM: 12,
    CHARISMA: 6
  },
  naturalArmorBonus: 0,
  hitPoints: 24,
  hitDice: {
    count: 7,
    die: 8,
    modifier: -7
  },
  speeds: [...S.walk(10), ...S.fly(50)],
  proficiencies: [S.grantedSkillExpertise(317, 1, 'PERCEPTION')],
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
  passivePerception: 15,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(317, 1),
      label: 'Swarm',
      description:
        "Swarm. The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny raven. The swarm can't regain hit points or gain temporary hit points.",
      order: 1
    },
    {
      id: S.featureId(317, 2),
      label: 'Beaks',
      description:
        "Beaks. Melee Weapon Attack: +4 to hit, reach 5 ft., one target in the swarm's space. Hit: 7 (2d6) piercing damage, or 3 (1d6) piercing damage if the swarm has half of its hit points or fewer.",
      effects: [
        S.weaponAttack({
          creatureIndex: 317,
          localIndex: 1,
          kind: 'MELEE',
          feet: 5,
          damageType: 'PIERCING',
          diceConfig: '2d6',
          halfHitPointsDiceConfig: '1d6',
          ability: null
        })
      ],
      order: 2
    }
  ]
}
