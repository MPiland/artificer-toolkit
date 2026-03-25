import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const plesiosaurus: CreatureAuthored = {
  id: S.CREATURE_IDS.PLESIOSAURUS,
  label: 'Plesiosaurus',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 15,
    CONSTITUTION: 16,
    INTELLIGENCE: 2,
    WISDOM: 12,
    CHARISMA: 5,
    SPELLCASTING: 0
  },
  armorClass: 13,
  armorClassNote: 'natural armor',
  hitPoints: 68,
  hitDice: '8d10+24',
  speeds: [...S.walk(20), ...S.swim(40)],
  proficiencies: [
    S.grantedSkillProficiency(221, 1, 'PERCEPTION', 'STEALTH')
  ],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(221, 1),
      label: 'Hold Breath',
      description: 'Hold Breath. The plesiosaurus can hold its breath for 1 hour.',
      order: 1
    },
    {
      id: S.featureId(221, 2),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 14 (3d6 + 4) piercing damage.',
      capabilities: [
        {
          id: S.actionId(221, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(221, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(221, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '3d6+4'
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
