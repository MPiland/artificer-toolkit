import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const mimic: CreatureAuthored = {
  id: S.CREATURE_IDS.MIMIC,
  label: 'Mimic',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['shapechanger'],
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 12,
    CONSTITUTION: 15,
    INTELLIGENCE: 5,
    WISDOM: 13,
    CHARISMA: 8,
    SPELLCASTING: 0
  },
  armorClass: 12,
  armorClassNote: 'natural armor',
  hitPoints: 58,
  hitDice: '9d8+18',
  speeds: [...S.walk(15)],
  proficiencies: [
    S.grantedSkillProficiency(197, 1, 'STEALTH')
  ],
  damageImmunities: ['acid'],
  conditionImmunities: ['prone'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(197, 1),
      label: 'Shapechanger',
      description: "Shapechanger. The mimic can use its action to polymorph into an object or back into its true, amorphous form. Its statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
      order: 1
    },
    {
      id: S.featureId(197, 2),
      label: 'Adhesive (Object Form Only)',
      description: 'Adhesive (Object Form Only). The mimic adheres to anything that touches it. A Huge or smaller creature adhered to the mimic is also grappled by it (escape DC 13). Ability checks made to escape this grapple have disadvantage.',
      order: 2
    },
    {
      id: S.featureId(197, 3),
      label: 'False Appearance (Object Form Only)',
      description: 'False Appearance (Object Form Only). While the mimic remains motionless, it is indistinguishable from an ordinary object.',
      order: 3
    },
    {
      id: S.featureId(197, 4),
      label: 'Grappler',
      description: 'Grappler. The mimic has advantage on attack rolls against any creature grappled by it.',
      order: 4
    },
    {
      id: S.featureId(197, 5),
      label: 'Pseudopod',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) bludgeoning damage. If the mimic is in object form, the target is subjected to its Adhesive trait.',
      capabilities: [
        {
          id: S.actionId(197, 3),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(197, 4),
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
              id: S.actionId(197, 5),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8',
              bonuses: [
                {
                  id: S.actionId(197, 6),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            },
            {
              id: S.actionId(197, 7),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.CONDITION,
              conditionId: conditionTypeId('GRAPPLED'),
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(197, 6),
      label: 'Bite',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) piercing damage plus 4 (1d8) acid damage.',
      capabilities: [
        {
          id: S.actionId(197, 8),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(197, 9),
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
              id: S.actionId(197, 10),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8',
              bonuses: [
                {
                  id: S.actionId(197, 11),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            },
            {
              id: S.actionId(197, 12),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('ACID'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8'
            }
          ]
        }
      ],
      order: 6
    }
  ]
}
