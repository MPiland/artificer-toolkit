import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const specter: CreatureAuthored = {
  id: S.CREATURE_IDS.SPECTER,
  label: 'Specter',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 1,
    DEXTERITY: 14,
    CONSTITUTION: 11,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 11,
    SPELLCASTING: 0
  },
  armorClass: 12,
  hitPoints: 22,
  hitDice: '5d8',
  speeds: [...S.fly(50)],
  damageResistances: ['acid', 'fire', 'lightning', 'thunder', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['necrotic', 'poison'],
  conditionImmunities: ['charmed', 'exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(6522, 1),
      label: 'Incorporeal Movement',
      description: 'Incorporeal Movement. The specter can move through other creatures and objects as if they were difficult terrain.',
      order: 1
    },
    {
      id: S.featureId(6522, 2),
      label: 'Sunlight Sensitivity',
      description: 'Sunlight Sensitivity. While in sunlight, the specter has disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight.',
      order: 2
    },
    {
      id: S.featureId(6522, 3),
      label: 'Life Drain',
      description: 'Life Drain. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 10 (3d6) necrotic damage, and the target’s hit point maximum is reduced by an amount equal to the damage taken.',
      capabilities: [
        {
          id: S.actionId(6522, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(6522, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(6522, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('NECROTIC'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '3d6'
            }
          ]
        }
      ],
      order: 3
    }
  ]
}
