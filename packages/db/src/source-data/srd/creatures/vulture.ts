import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const vulture: CreatureAuthored = {
  id: S.CREATURE_IDS.VULTURE,
  label: 'Vulture',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 7,
    DEXTERITY: 10,
    CONSTITUTION: 13,
    INTELLIGENCE: 2,
    WISDOM: 12,
    CHARISMA: 4,
    SPELLCASTING: 0
  },
  armorClass: 10,
  hitPoints: 5,
  hitDice: '1d8+1',
  speeds: [...S.walk(10), ...S.fly(50)],
  proficiencies: [
    S.grantedSkillProficiency(282, 1, 'PERCEPTION')
  ],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(282, 1),
      label: 'Keen Sight and Smell',
      description: 'Keen Sight and Smell. The vulture has advantage on Wisdom (Perception) checks that rely on sight or smell.',
      order: 1
    },
    {
      id: S.featureId(282, 2),
      label: 'Pack Tactics',
      description: "Pack Tactics. The vulture has advantage on an attack roll against a creature if at least one of the vulture's allies is within 5 feet of the creature and the ally isn't incapacitated.",
      order: 2
    },
    {
      id: S.featureId(282, 3),
      label: 'Beak',
      description: 'Beak. Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) piercing damage.',
      capabilities: [
        {
          id: S.actionId(282, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(282, 2),
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
              id: S.actionId(282, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d4'
            }
          ]
        }
      ],
      order: 3
    }
  ],
  
}
