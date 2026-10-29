import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
import { startOfTurnSaveAuraEffect } from './turnAura.js'
export const seaHag: CreatureAuthored = {
  id: S.CREATURE_IDS.SEA_HAG,
  label: 'Sea Hag',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FEY,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 13,
    CONSTITUTION: 16,
    INTELLIGENCE: 12,
    WISDOM: 12,
    CHARISMA: 13
  },
  naturalArmorBonus: 3,
  hitPoints: 52,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 7,
    die: 8,
    modifier: 21
  },
  speeds: [...S.walk(30), ...S.swim(40)],
  proficiencies: [S.grantedLanguageProficiency(248, 1, 'AQUAN', 'COMMON', 'GIANT')],
  senses: [S.darkvision(60)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(248, 1),
      label: 'Amphibious',
      description: 'Amphibious. The hag can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(248, 2),
      label: 'Horrific Appearance',
      description:
        "Horrific Appearance. Any humanoid that starts its turn within 30 feet of the hag and can see the hag's true form must make a DC 11 Wisdom saving throw. On a failed save, the creature is frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, with disadvantage if the hag is within line of sight, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the hag's Horrific Appearance for the next 24 hours. Unless the target is surprised or the revelation of the hag's true form is sudden, the target can avert its eyes and avoid making the initial saving throw. Until the start of its next turn, a creature that averts its eyes has disadvantage on attack rolls against the hag.",
      effects: [
        startOfTurnSaveAuraEffect(248, {
          localIndex: 1300,
          label: 'Horrific Appearance',
          componentLabel: "A creature starts its turn in view of the hag's true form",
          radiusFeet: 30,
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
          dc: 11,
          condition: 'FRIGHTENED',
          duration: {
            kind: 'MINUTE',
            repeatRollInfluence: {
              influence: 'DISADVANTAGE',
              when: {
                kind: 'PERCEPTION',
                observer: 'TARGET',
                subject: 'SOURCE',
                requirement: 'SEE'
              }
            }
          },
          requiredSight: ['OCCUPANT_SEES_SOURCE']
        })
      ],
      order: 2
    },
    {
      id: S.featureId(248, 3),
      label: 'Illusory Appearance',
      description:
        'Illusory Appearance. The hag covers herself and anything she is wearing or carrying with a magical illusion that makes her look like an ugly creature of her general size and humanoid shape. The effect ends if the hag takes a bonus action to end it or if she dies.',
      order: 3
    },
    {
      id: S.featureId(248, 4),
      label: 'Claws',
      description:
        'Claws. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(3648, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3648, 2),
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
              id: S.actionId(3648, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(3648, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(3648, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+3'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(248, 5),
      label: 'Death Glare',
      description:
        'Death Glare. The hag targets one frightened creature she can see within 30 feet of her. If the target can see the hag, it must succeed on a DC 11 Wisdom saving throw against this magic or drop to 0 hit points.',
      effects: [
        {
          id: S.actionId(248, 504),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            savingThrow: {
              id: S.actionId(248, 605),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 11
            },
            range: {
              id: S.actionId(248, 606),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 30,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY,
              // A target that cannot see the hag is unaffected, so it is never a valid target.
              targetRequirements: [
                {
                  kind: 'HAS_CONDITION',
                  conditionIds: [conditionTypeId('FRIGHTENED')],
                  source: 'ANY'
                },
                { kind: 'SIGHT', direction: 'ACTOR_SEES_TARGET' },
                { kind: 'SIGHT', direction: 'TARGET_SEES_ACTOR' }
              ]
            }
          },
          paths: [
            {
              id: S.actionId(248, 607),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(248, 608),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(248, 609),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Drop to 0 hit points',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      'The target drops to 0 hit points; the GM reduces its hit points to 0.'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
