import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const wraith: CreatureAuthored = {
  id: S.CREATURE_IDS.WRAITH,
  label: 'Wraith',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 6,
    DEXTERITY: 16,
    CONSTITUTION: 16,
    INTELLIGENCE: 12,
    WISDOM: 14,
    CHARISMA: 15,
    SPELLCASTING: 0
  },
  armorClass: 13,
  hitPoints: 67,
  hitDice: '9d8+27',
  speeds: [...S.fly(60)],
  damageResistances: ['acid', 'cold', 'fire', 'lightning', 'thunder', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['necrotic', 'poison'],
  conditionImmunities: ['charmed', 'exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(9601, 1),
      label: 'Incorporeal Movement',
      description: 'Incorporeal Movement. The wraith can move through other creatures and objects as if they were difficult terrain.',
      order: 1
    },
    {
      id: S.featureId(9601, 2),
      label: 'Sunlight Sensitivity',
      description: 'Sunlight Sensitivity. While in sunlight, the wraith has disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight.',
      order: 2
    },
    {
      id: S.featureId(9601, 3),
      label: 'Life Drain',
      description: 'Life Drain. Melee Weapon Attack: +6 to hit, reach 5 ft., one creature. Hit: 21 (4d8 + 3) necrotic damage, and the target’s hit point maximum is reduced by an amount equal to the necrotic damage taken.',
      order: 3
    },
    {
      id: S.featureId(9601, 4),
      label: 'Create Specter',
      description: 'Create Specter. The wraith targets a humanoid it killed; the corpse rises as a specter under the wraith’s control if the body is suitable and the wraith chooses to claim it.',
      order: 4
    }
  ]
}

