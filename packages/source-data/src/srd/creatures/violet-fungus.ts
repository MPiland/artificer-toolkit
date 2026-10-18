import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const violetFungus: CreatureAuthored = {
  id: S.CREATURE_IDS.VIOLET_FUNGUS,
  label: 'Violet Fungus',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.PLANT,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 3,
    DEXTERITY: 1,
    CONSTITUTION: 10,
    INTELLIGENCE: 1,
    WISDOM: 3,
    CHARISMA: 1
  },
  naturalArmorBonus: 0,
  hitPoints: 18,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 4,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(5)],
  conditionImmunities: ['blinded', 'deafened', 'frightened'],
  senses: [S.blindsight(30, '(blind beyond this radius)')],
  passivePerception: 6,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(280, 1),
      label: 'False Appearance',
      description:
        'False Appearance. While the violet fungus remains motionless, it is indistinguishable from an ordinary fungus.',
      order: 1
    },
    {
      id: S.featureId(280, 2),
      label: 'Multiattack',
      description: 'Multiattack. The fungus makes 1d4 Rotting Touch attacks.',
      order: 2
    },
    {
      id: S.featureId(280, 3),
      label: 'Rotting Touch',
      description:
        'Rotting Touch. Melee Weapon Attack: +2 to hit, reach 10 ft., one creature. Hit: 4 (1d8) necrotic damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 280,
          localIndex: 1,
          kind: 'MELEE',
          feet: 10,
          damageType: 'NECROTIC',
          diceConfig: '1d8',
          ability: null
        })
      ],
      order: 3
    }
  ]
}
