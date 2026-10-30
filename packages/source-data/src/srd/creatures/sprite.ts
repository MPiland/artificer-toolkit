import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
import { indefiniteInvisibilityEffect } from './indefiniteInvisibility.js'
export const sprite: CreatureAuthored = {
  id: S.CREATURE_IDS.SPRITE,
  label: 'Sprite',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FEY,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000200000000',
  abilityScores: {
    STRENGTH: 3,
    DEXTERITY: 18,
    CONSTITUTION: 10,
    INTELLIGENCE: 14,
    WISDOM: 13,
    CHARISMA: 11
  },
  naturalArmorBonus: 0,
  hitPoints: 2,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 1,
    die: 4,
    modifier: 0
  },
  speeds: [...S.walk(10), ...S.fly(40)],
  proficiencies: [
    S.grantedLanguageProficiency(9803, 3, 'COMMON', 'ELVISH', 'SYLVAN'),
    S.grantedSkillExpertise(9803, 2, 'STEALTH'),
    S.grantedSkillProficiency(9803, 1, 'PERCEPTION')
  ],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(260, 1),
      label: 'Heart Sight',
      description:
        "Heart Sight. The sprite touches a creature and magically knows the creature's current emotional state. If the target fails a DC 10 Charisma saving throw, the sprite also knows the creature's alignment. Celestials, fiends, and undead automatically fail the saving throw.",
      effects: [
        {
          id: S.actionId(260, 200),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(260, 201),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CHARISMA,
              baseDc: 10
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(260, 202), rangeKind: S.RANGE_KIND.TOUCH },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(260, 203),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(260, 204),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(260, 205),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Reveal current emotional state and alignment',
                    reasonCode: 'EXTERNAL_WORLD_STATE',
                    instructions:
                      "Heart Sight. The sprite touches a creature and magically knows the creature's current emotional state. If the target fails a DC 10 Charisma saving throw, the sprite also knows the creature's alignment."
                  }
                ]
              }
            },
            {
              id: S.actionId(260, 207),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(260, 208),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(260, 209),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Reveal current emotional state',
                    reasonCode: 'EXTERNAL_WORLD_STATE',
                    instructions:
                      "Heart Sight. The sprite touches a creature and magically knows the creature's current emotional state."
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 1
    },
    {
      id: S.featureId(260, 2),
      label: 'Invisibility',
      description:
        'Invisibility. The sprite magically turns invisible until it attacks or casts a spell, or until its concentration ends (as if concentrating on a spell). Any equipment the sprite wears or carries is invisible with it.',
      effects: [
        indefiniteInvisibilityEffect({
          effectId: S.actionId(260, 210),
          rangeId: S.actionId(260, 211),
          pathId: S.actionId(260, 221),
          endTriggers: [
            { event: 'LIFECYCLE' as const, timing: 'END' as const, code: 'ON_ATTACK_ROLL' },
            { event: 'LIFECYCLE' as const, timing: 'END' as const, code: 'ON_CAST_SPELL' }
          ]
        })
      ],
      order: 2
    },
    {
      id: S.featureId(260, 3),
      label: 'Shortbow',
      description:
        'Shortbow. Ranged Weapon Attack: +6 to hit, range 40/160 ft., one target. Hit: 1 piercing damage, and the target must succeed on a DC 10 Constitution saving throw or become poisoned for 1 minute. If its saving throw result is 5 or lower, the poisoned target falls unconscious for the same duration, or until it takes damage or another creature takes an action to shake it awake.',
      effects: [
        {
          id: S.actionId(260, 212),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(260, 213),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 40,
              longAmount: 160,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(260, 214),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(260, 215),
                resultKind: 'SEQUENCE',
                // Poisoned for 1 minute (D62.2); a save of 5 or lower (failing DC 10 by 5 or more)
                // also knocks it unconscious.
                duration: {
                  id: S.actionId(260, 218),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(260, 216),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.FIXED,
                    scalingKind: S.SCALING.NONE,
                    amount: 1
                  },
                  {
                    ...S.conditionSave({
                      id: S.actionId(260, 217),
                      savingThrowId: S.actionId(260, 219),
                      ability: 'CONSTITUTION',
                      dc: 10,
                      conditionOutcomeId: S.actionId(260, 220),
                      conditionId: conditionTypeId('POISONED'),
                      repeatsAtTurnEnd: false
                    }),
                    failureMarginRider: {
                      id: S.actionId(260, 222),
                      failedBy: 5,
                      endsWithOutcomeId: S.actionId(260, 220),
                      outcomes: [
                        {
                          id: S.actionId(260, 223),
                          effectKind: S.EFFECT_KIND.CONDITION,
                          conditionId: conditionTypeId('UNCONSCIOUS')
                        }
                      ],
                      lifecycle: { endTriggers: S.WAKE_END_TRIGGERS }
                    }
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
      id: S.featureId(260, 4),
      label: 'Longsword',
      description:
        'Longsword. Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 1 slashing damage.',
      effects: [
        {
          id: S.actionId(9803, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(9803, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(9803, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(9803, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(9803, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    }
  ]
}
