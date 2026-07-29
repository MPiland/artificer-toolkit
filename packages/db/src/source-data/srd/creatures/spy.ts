import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const spy: CreatureAuthored = {
  id: S.CREATURE_IDS.SPY,
  label: 'Spy',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.NPC,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 15,
    CONSTITUTION: 10,
    INTELLIGENCE: 12,
    WISDOM: 14,
    CHARISMA: 16
  },
  armorClass: 12,
  hitPoints: 27,
  hitDice: {
    count: 6,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(30)],
  proficiencies: [S.grantedSkillProficiency(261, 1, 'DECEPTION', 'INSIGHT', 'INVESTIGATION')],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(261, 1),
      label: 'Cunning Action',
      description:
        'Cunning Action. On each of its turns, the spy can use a bonus action to take the Dash, Disengage, or Hide action.',
      order: 1
    },
    {
      id: S.featureId(261, 2),
      label: 'Sneak Attack (1/Turn)',
      description:
        "Sneak Attack (1/Turn). The spy deals an extra 7 (2d6) damage when it hits a target with a weapon attack and has advantage on the attack roll, or when the target is within 5 feet of an ally of the spy that isn't incapacitated and the spy doesn't have disadvantage on the attack roll.",
      order: 2
    },
    {
      id: S.featureId(261, 3),
      label: 'Language Knowledge',
      description: 'Any two languages.',
      order: 3
    },
    {
      id: S.featureId(261, 4),
      label: 'Multiattack',
      description: 'The spy makes two melee attacks.',
      order: 4
    },
    {
      id: S.featureId(261, 5),
      label: 'Shortsword',
      description:
        'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      order: 5
    },
    {
      id: S.featureId(261, 6),
      label: 'Hand Crossbow',
      description:
        'Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      order: 6
    }
  ]
}
