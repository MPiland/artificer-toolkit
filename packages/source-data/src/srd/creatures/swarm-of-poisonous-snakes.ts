import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const swarmOfPoisonousSnakes: CreatureAuthored = {
  id: S.CREATURE_IDS.SWARM_OF_POISONOUS_SNAKES,
  label: 'Swarm of Poisonous Snakes',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 8,
    DEXTERITY: 18,
    CONSTITUTION: 11,
    INTELLIGENCE: 1,
    WISDOM: 10,
    CHARISMA: 3
  },
  naturalArmorBonus: 0,
  hitPoints: 36,
  hitDice: {
    count: 8,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(30), ...S.swim(30)],
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
  passivePerception: 10,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(314, 1),
      label: 'Swarm',
      description:
        "Swarm. The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny snake. The swarm can't regain hit points or gain temporary hit points.",
      order: 1
    },
    {
      id: S.featureId(314, 2),
      label: 'Bites',
      description:
        "Bites. Melee Weapon Attack: +6 to hit, reach 0 ft., one creature in the swarm's space. Hit: 7 (2d6) piercing damage, or 3 (1d6) piercing damage if the swarm has half of its hit points or fewer. The target must make a DC 10 Constitution saving throw, taking 14 (4d6) poison damage on a failed save, or half as much damage on a successful one.",
      effects: [
        S.weaponAttack({
          creatureIndex: 314,
          localIndex: 1,
          kind: 'MELEE',
          feet: 0,
          damageType: 'PIERCING',
          diceConfig: '2d6',
          halfHitPointsDiceConfig: '1d6',
          ability: null,
          followUpSave: S.constitutionPoisonDamageSave({
            id: S.actionId(314, 10),
            savingThrowId: S.actionId(314, 11),
            dc: 10,
            failureDamageId: S.actionId(314, 12),
            successDamageId: S.actionId(314, 13),
            diceConfig: '4d6'
          })
        })
      ],
      order: 2
    }
  ]
}
