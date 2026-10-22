import {
  DURATION_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  type CreatureAuthored
} from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const lamia: CreatureAuthored = {
  id: S.CREATURE_IDS.LAMIA,
  label: 'Lamia',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 13,
    CONSTITUTION: 15,
    INTELLIGENCE: 14,
    WISDOM: 15,
    CHARISMA: 16
  },
  naturalArmorBonus: 2,
  hitPoints: 97,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 13,
    die: 10,
    modifier: 26
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillExpertise(181, 3, 'DECEPTION'),
    S.grantedSkillProficiency(181, 1, 'INSIGHT', 'STEALTH'),
    S.grantedLanguageProficiency(181, 2, 'ABYSSAL', 'COMMON')
  ],
  senses: [S.darkvision(60)],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(181, 1),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The lamia's innate spellcasting ability is Charisma (spell save DC 13). It can innately cast the following spells, requiring no material components. At will: disguise self (any humanoid form), major image 3/day each: charm person, mirror image, scrying, suggestion 1/day: geas",
      grants: {
        spells: [
          {
            id: S.actionId(181, 701),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DISGUISE_SELF, S.SPELL_IDS.MAJOR_IMAGE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            order: 0
          },
          {
            id: S.actionId(181, 702),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.CHARM_PERSON,
              S.SPELL_IDS.MIRROR_IMAGE,
              S.SPELL_IDS.SCRYING,
              S.SPELL_IDS.SUGGESTION
            ],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: S.actionId(181, 703),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 3
            },
            order: 1
          },
          {
            id: S.actionId(181, 704),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.GEAS],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: S.actionId(181, 705),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 1
            },
            order: 2
          }
        ]
      },
      order: 1
    },
    {
      id: S.featureId(181, 2),
      label: 'Multiattack',
      description:
        'Multiattack. The lamia makes two attacks: one with its claws and one with its dagger or Intoxicating Touch.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(181, 3) }] },
              {
                count: 1,
                fillers: [
                  { kind: 'FEATURE', featureId: S.featureId(181, 4) },
                  { kind: 'FEATURE', featureId: S.featureId(181, 5) }
                ]
              }
            ]
          }
        ]
      },
      order: 2
    },
    {
      id: S.featureId(181, 3),
      label: 'Claws',
      description:
        'Claws. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 14 (2d10 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(181, 502),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(181, 602),
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
              id: S.actionId(181, 802),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(181, 802) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(181, 920),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10',
                    bonuses: [
                      {
                        id: S.actionId(181, 970),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
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
      id: S.featureId(181, 4),
      label: 'Dagger',
      description:
        'Dagger. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 5 (1d4 + 3) piercing damage.',
      effects: [
        {
          id: S.actionId(181, 503),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(181, 603),
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
              id: S.actionId(181, 803),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(181, 803) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(181, 930),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(181, 980),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
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
      id: S.featureId(181, 5),
      label: 'Intoxicating Touch',
      description:
        'Intoxicating Touch. Melee Spell Attack: +5 to hit, reach 5 ft., one creature. Hit: The target is magically cursed for 1 hour. Until the curse ends, the target has disadvantage on Wisdom saving throws and all ability checks.',
      effects: [
        {
          id: S.actionId(181, 504),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_SPELL_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(181, 604),
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
              id: S.actionId(181, 505),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(181, 506),
                resultKind: 'SINGLE' as const,
                duration: {
                  id: S.actionId(181, 507),
                  durationKind: DURATION_KIND.HOUR,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(181, 508),
                    effectKind: S.EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: S.actionId(181, 509),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                          domain: { ability: S.ABILITY_CODE.WISDOM },
                          modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                          payload: { influence: 'DISADVANTAGE' },
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          order: 1
                        },
                        {
                          id: S.actionId(181, 510),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
                          domain: {},
                          modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                          payload: { influence: 'DISADVANTAGE' },
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          order: 2
                        }
                      ]
                    }
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
