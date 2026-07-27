import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const deathDog: CreatureAuthored = {
  id: S.CREATURE_IDS.DEATH_DOG,
  label: 'Death Dog',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.MEDIUM,
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 14,
    CONSTITUTION: 14,
    INTELLIGENCE: 3,
    WISDOM: 13,
    CHARISMA: 6
  },
  armorClass: 12,
  hitPoints: 39,
  hitDice: {
    count: 6,
    die: 8,
    modifier: 12
  },
  speeds: [...S.walk(40)],
  proficiencies: [S.grantedSkillProficiency(1389, 1, 'PERCEPTION', 'STEALTH')],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(77, 1),
      label: 'Two-Headed',
      description:
        'Two-Headed. The dog has advantage on Wisdom (Perception) checks and on saving throws against being blinded, charmed, deafened, frightened, stunned, or knocked unconscious.',
      order: 1
    },
    {
      id: S.featureId(77, 2),
      label: 'Multiattack',
      description: 'Multiattack. The dog makes two bite attacks.',
      order: 2
    },
    {
      id: S.featureId(77, 3),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage. If the target is a creature, it must succeed on a DC 12 Constitution saving throw against disease or become poisoned until the disease is cured. Every 24 hours that elapse, the target must repeat the saving throw, reducing its hit point maximum by 5 (1d10) on a failure. The target dies if this reduces its hit point maximum to 0.',
      order: 3
    }
  ]
}
