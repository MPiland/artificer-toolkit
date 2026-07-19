import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const wight: CreatureAuthored = {
  id: S.CREATURE_IDS.WIGHT,
  label: 'Wight',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 14,
    CONSTITUTION: 16,
    INTELLIGENCE: 10,
    WISDOM: 13,
    CHARISMA: 15,
  },
  armorClass: 14,
  armorClassNote: 'chain mail',
  hitPoints: 45,
  hitDice: '6d8+18',
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillProficiency(9377, 1, 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(9377, 2, 'COMMON')
  ],
  damageResistances: ['necrotic'],
  conditionImmunities: ['exhaustion', 'poisoned'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(293, 1),
      label: 'Sunlight Sensitivity',
      description: 'Sunlight Sensitivity. While in sunlight, the wight has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
      order: 1
    },
    {
      id: S.featureId(293, 2),
      label: 'Life Drain',
      description: 'Life Drain. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) necrotic damage, and the target’s hit point maximum is reduced by an amount equal to the necrotic damage taken.',
      order: 2
    },
    {
      id: S.featureId(293, 3),
      label: 'Multiattack',
      description: 'Multiattack. The wight makes two longsword attacks or two longbow attacks. It can use Life Drain in place of one of the attacks.',
      order: 3
    },
    {
      id: S.featureId(293, 4),
      label: 'Longsword',
      description: 'Longsword. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage.',
      order: 4
    },
    {
      id: S.featureId(293, 5),
      label: 'Longbow',
      description: 'Longbow. Ranged Weapon Attack: +4 to hit, range 150/600 ft., one target. Hit: 6 (1d8 + 2) piercing damage.',
      order: 5
    },
    {
      id: S.featureId(293, 6),
      label: 'Create Specter',
      description: 'Create Specter. The wight targets a humanoid it killed; the corpse rises as a specter under the wight’s control if the wight chooses and the body is suitable.',
      order: 6
    }
  ]
}

