import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { conditionTypeId } from '../equipment/shared.js'

import * as S from './shared.js'
export const aboleth: CreatureAuthored = {
  id: S.CREATURE_IDS.ABOLETH,
  label: 'Aboleth',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ABERRATION,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 21,
    DEXTERITY: 9,
    CONSTITUTION: 15,
    INTELLIGENCE: 18,
    WISDOM: 15,
    CHARISMA: 18
  },
  naturalArmorBonus: 8,
  hitPoints: 135,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 18,
    die: 10,
    modifier: 36
  },
  speeds: [...S.walk(10), ...S.swim(40)],
  proficiencies: [
    S.grantedSkillExpertise(1, 4, 'HISTORY', 'PERCEPTION'),
    S.grantedSaveProficiency(1, 1, 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM'),
    S.grantedLanguageProficiency(1, 3, 'DEEP_SPEECH')
  ],
  senses: [S.darkvision(120)],
  passivePerception: 20,
  challengeRatingId: S.CR.CR_10,
  xp: 5900,
  features: [
    {
      id: S.featureId(1, 1),
      label: 'Amphibious',
      description: 'Amphibious. The aboleth can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(1, 2),
      label: 'Mucous Cloud',
      description:
        'Mucous Cloud. While underwater, the aboleth is surrounded by transformative mucus. A creature that touches the aboleth or that hits it with a melee attack while within 5 feet of it must make a DC 14 Constitution saving throw. On a failure, the creature is diseased for 1d4 hours. The diseased creature can breathe only underwater.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(1, 103),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(1, 104),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 14
            },
            range: {
              id: S.actionId(1, 105),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          label: 'Mucous Cloud',
          reasonCode: MANUAL_ADJUDICATION_REASON.NARRATIVE_JUDGMENT,
          instructions:
            'While the aboleth is underwater, a creature that touches it or hits it with a melee attack within 5 feet makes a DC 14 Constitution saving throw. On a failure it is diseased for 1d4 hours and can breathe only underwater.'
        })
      ],
      order: 2
    },
    {
      id: S.featureId(1, 3),
      label: 'Probing Telepathy',
      description:
        "Probing Telepathy. If a creature communicates telepathically with the aboleth, the aboleth learns the creature's greatest desires if the aboleth can see the creature.",
      effects: [
        {
          id: S.actionId(1, 106),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(1, 107), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          paths: [
            {
              id: S.actionId(1, 108),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(1, 108)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(1, 109),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Probing Telepathy',
                    instructions:
                      "If a creature communicates telepathically with the aboleth, the aboleth learns the creature's greatest desires if the aboleth can see the creature.",
                    reasonCode: MANUAL_ADJUDICATION_REASON.NARRATIVE_JUDGMENT
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(1, 4),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 4
    },
    {
      id: S.featureId(1, 5),
      label: 'Multiattack',
      description: 'The aboleth makes three tentacle attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 3, fillers: [{ kind: 'FEATURE', featureId: S.featureId(1, 6) }] }] }
        ]
      },
      order: 5
    },
    {
      id: S.featureId(1, 6),
      label: 'Tentacle',
      description:
        "Tentacle. Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 12 (2d6 + 5) bludgeoning damage. If the target is a creature, it must succeed on a DC 14 Constitution saving throw or become diseased. The disease has no effect for 1 minute and can be removed by any magic that cures disease. After 1 minute, the diseased creature's skin becomes translucent and slimy, the creature can't regain hit points unless it is underwater, and the disease can be removed only by heal or another disease-curing spell of 6th level or higher. When the creature is outside a body of water, it takes 6 (1d12) acid damage every 10 minutes unless moisture is applied to the skin before 10 minutes have passed.",
      effects: [
        S.weaponAttack({
          creatureIndex: 1,
          localIndex: 1,
          kind: 'MELEE',
          feet: 10,
          damageType: 'BLUDGEONING',
          diceConfig: '2d6',
          ability: 'STRENGTH'
        })
      ],
      order: 6
    },
    {
      id: S.featureId(1, 7),
      label: 'Tail',
      description:
        'Tail. Melee Weapon Attack: +9 to hit, reach 10 ft. one target. Hit: 15 (3d6 + 5) bludgeoning damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 1,
          localIndex: 10,
          kind: 'MELEE',
          feet: 10,
          damageType: 'BLUDGEONING',
          diceConfig: '3d6',
          ability: 'STRENGTH'
        })
      ],
      order: 7
    },
    {
      id: S.featureId(1, 8),
      label: 'Enslave (3/Day)',
      description:
        "Enslave (3/Day). The aboleth targets one creature it can see within 30 feet of it. The target must succeed on a DC 14 Wisdom saving throw or be magically charmed by the aboleth until the aboleth dies or until it is on a different plane of existence from the target. The charmed target is under the aboleth's control and can't take reactions, and the aboleth and the target can communicate telepathically with each other over any distance. Whenever the charmed target takes damage, the target can repeat the saving throw. On a success, the effect ends. No more than once every 24 hours, the target can also repeat the saving throw when it is at least 1 mile away from the aboleth.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(1, 20),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.DAILY,
        amount: 3
      },
      effects: [
        {
          id: S.actionId(1, 21),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            savingThrow: {
              id: S.actionId(1, 22),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 14
            },
            range: {
              id: S.actionId(1, 23),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 30,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(1, 24),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(1, 24)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(1, 25),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('CHARMED')
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 8
    }
  ]
}
