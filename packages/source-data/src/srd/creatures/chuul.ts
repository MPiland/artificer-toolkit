import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const chuul: CreatureAuthored = {
  id: S.CREATURE_IDS.CHUUL,
  label: 'Chuul',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ABERRATION,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 10,
    CONSTITUTION: 16,
    INTELLIGENCE: 5,
    WISDOM: 11,
    CHARISMA: 5
  },
  naturalArmorBonus: 6,
  hitPoints: 93,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 11,
    die: 10,
    modifier: 33
  },
  speeds: [...S.walk(30), ...S.swim(30)],
  proficiencies: [S.grantedSkillExpertise(63, 3, 'PERCEPTION')],
  damageImmunities: ['poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.darkvision(60)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(63, 1),
      label: 'Amphibious',
      description: 'Amphibious. The chuul can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(63, 2),
      label: 'Sense Magic',
      description:
        "Sense Magic. The chuul senses magic within 120 feet of it at will. This trait otherwise works like the detect magic spell but isn't itself magical.",
      order: 2
    },
    {
      id: S.featureId(63, 3),
      label: 'Language Limitation',
      description: "understands Deep Speech but can't speak",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(63, 2, 'DEEP_SPEECH')]
      },
      order: 3
    },
    {
      id: S.featureId(63, 4),
      label: 'Multiattack',
      description:
        'Multiattack. The chuul makes two pincer attacks. If the chuul is grappling a creature, the chuul can also use its tentacles once.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(63, 5) }] },
              {
                count: 1,
                fillers: [{ kind: 'FEATURE', featureId: S.featureId(63, 6) }],
                optional: true
              }
            ]
          }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(63, 5),
      label: 'Pincer',
      description:
        "Pincer. Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage. The target is grappled (escape DC 14) if it is a Large or smaller creature and the chuul doesn't have two other creatures grappled.",
      effects: [
        {
          id: S.actionId(63, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(63, 5),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(63, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(63, 6) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(63, 6),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+4'
                  }
                ]
              }
            },
            {
              id: S.actionId(63, 7),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(63, 7) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  S.grappledOutcome(63, {
                    localIndex: 1,
                    escapeDc: 14,
                    heldAtOnce: 2,
                    largestTarget: S.SIZE_CODE.LARGE
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(63, 6),
      label: 'Tentacles',
      description:
        'Tentacles. One creature grappled by the chuul must succeed on a DC 13 Constitution saving throw or be poisoned for 1 minute. Until this poison ends, the target is paralyzed. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      effects: [
        {
          id: S.actionId(63, 8),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(63, 11),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 13
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(63, 9),
              // The held creature is within the Pincer's reach.
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY,
              heldBySource: true as const
            }
          },
          paths: [
            {
              id: S.actionId(63, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(63, 17),
                resultKind: 'SEQUENCE' as const,
                duration: {
                  id: S.actionId(63, 12),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(63, 10),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('POISONED')
                  },
                  {
                    id: S.actionId(63, 13),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('PARALYZED')
                  },
                  {
                    id: S.actionId(63, 14),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'TARGET_TURN_END',
                    savingThrow: {
                      id: S.actionId(63, 15),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 13
                    },
                    attempts: { kind: 'ONCE', repeatOnFailure: true },
                    onSuccess: { kind: 'END' },
                    onFailure: { kind: 'CONTINUE' }
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 6
    }
  ]
}
