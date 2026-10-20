import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const earthElemental: CreatureAuthored = {
  id: S.CREATURE_IDS.EARTH_ELEMENTAL,
  label: 'Earth Elemental',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 20,
    DEXTERITY: 8,
    CONSTITUTION: 20,
    INTELLIGENCE: 5,
    WISDOM: 10,
    CHARISMA: 5
  },
  naturalArmorBonus: 8,
  hitPoints: 126,
  details: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 12,
    die: 10,
    modifier: 60
  },
  speeds: [...S.walk(30), ...S.burrow(30)],
  proficiencies: [S.grantedLanguageProficiency(94, 1, 'TERRAN')],
  damageVulnerabilities: ['thunder'],
  damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['poison'],
  conditionImmunities: ['exhaustion', 'paralyzed', 'petrified', 'poisoned', 'unconscious'],
  senses: [S.darkvision(60), S.tremorsense(60)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(94, 1),
      label: 'Earth Glide',
      description:
        "Earth Glide. The elemental can burrow through nonmagical, unworked earth and stone. While doing so, the elemental doesn't disturb the material it moves through.",
      order: 1
    },
    {
      id: S.featureId(94, 2),
      label: 'Siege Monster',
      description: 'Siege Monster. The elemental deals double damage to objects and structures.',
      order: 2
    },
    {
      id: S.featureId(94, 3),
      label: 'Multiattack',
      description: 'Multiattack. The elemental makes two slam attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(94, 4) }] }] }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(94, 4),
      label: 'Slam',
      description:
        'Slam. Melee Weapon Attack: +8 to hit, reach 10 ft., one target. Hit: 14 (2d8 + 5) bludgeoning damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 94,
          localIndex: 1,
          kind: 'MELEE',
          feet: 10,
          damageType: 'BLUDGEONING',
          diceConfig: '2d8',
          ability: 'STRENGTH'
        })
      ],
      order: 4
    }
  ]
}
