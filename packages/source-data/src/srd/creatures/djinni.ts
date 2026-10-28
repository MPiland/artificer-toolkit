import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const djinni: CreatureAuthored = {
  id: S.CREATURE_IDS.DJINNI,
  label: 'Djinni',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000300000000',
  abilityScores: {
    STRENGTH: 21,
    DEXTERITY: 15,
    CONSTITUTION: 22,
    INTELLIGENCE: 15,
    WISDOM: 16,
    CHARISMA: 20
  },
  naturalArmorBonus: 5,
  hitPoints: 161,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 14,
    die: 10,
    modifier: 84
  },
  speeds: [...S.walk(30), ...S.fly(90)],
  proficiencies: [
    S.grantedSaveProficiency(2690, 1, 'DEXTERITY', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(2690, 2, 'AURAN')
  ],
  damageImmunities: ['lightning', 'thunder'],
  senses: [S.darkvision(120)],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_11,
  xp: 7200,
  features: [
    {
      id: S.featureId(82, 1),
      label: 'Elemental Demise',
      description:
        'Elemental Demise. If the djinni dies, its body disintegrates into a warm breeze, leaving behind only equipment the djinni was wearing or carrying.',
      order: 1
    },
    {
      id: S.featureId(82, 2),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The djinni's innate spellcasting ability is Charisma (spell save DC 17, +9 to hit with spell attacks). It can innately cast the following spells, requiring no material components: At will: detect evil and good, detect magic, thunderwave 3/day each: create food and water (can create wine instead of water), tongues, wind walk 1/day each: conjure elemental (air elemental only), creation, gaseous form, invisibility, major image, plane shift",
      grants: {
        spells: [
          {
            id: S.actionId(82, 301),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.DETECT_EVIL_AND_GOOD,
              S.SPELL_IDS.DETECT_MAGIC,
              S.SPELL_IDS.THUNDERWAVE
            ],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 17,
            order: 0
          },
          ...(
            [S.SPELL_IDS.CREATE_FOOD_AND_WATER, S.SPELL_IDS.TONGUES, S.SPELL_IDS.WIND_WALK] as const
          ).map((spellId, index) => ({
            id: S.actionId(82, 302 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [spellId],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 17,
            charges: {
              id: S.actionId(82, 402 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 3
            },
            order: index + 1
          })),
          ...(
            [
              S.SPELL_IDS.CONJURE_ELEMENTAL,
              S.SPELL_IDS.CREATION,
              S.SPELL_IDS.GASEOUS_FORM,
              S.SPELL_IDS.INVISIBILITY,
              S.SPELL_IDS.MAJOR_IMAGE,
              S.SPELL_IDS.PLANE_SHIFT
            ] as const
          ).map((spellId, index) => ({
            id: S.actionId(82, 305 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [spellId],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 17,
            charges: {
              id: S.actionId(82, 405 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 1
            },
            order: index + 4
          }))
        ]
      },
      order: 2
    },
    {
      id: S.featureId(82, 3),
      label: 'Multiattack',
      description: 'Multiattack. The djinni makes three scimitar attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 3, fillers: [{ kind: 'FEATURE', featureId: S.featureId(82, 4) }] }] }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(82, 4),
      label: 'Scimitar',
      description:
        "Scimitar. Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 12 (2d6 + 5) slashing damage plus 3 (1d6) lightning or thunder damage (djinni's choice).",
      effects: [
        {
          id: S.actionId(2690, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2690, 2),
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
              id: S.actionId(2690, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2690, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2690, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(2690, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: S.actionId(2690, 5),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2690, 5) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2690, 5),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('LIGHTNING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6'
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
      id: S.featureId(82, 6),
      label: 'Create Whirlwind',
      description:
        'Create Whirlwind. A 5-foot-radius, 30-foot-tall cylinder of swirling air magically forms on a point the djinni can see within 120 feet of it. The whirlwind lasts as long as the djinni maintains concentration (as if concentrating on a spell). Any creature but the djinni that enters the whirlwind must succeed on a DC 18 Strength saving throw or be restrained by it. The djinni can move the whirlwind up to 60 feet as an action, and creatures restrained by the whirlwind move with it. The whirlwind ends if the djinni loses sight of it. A creature can use its action to free a creature restrained by the whirlwind, including itself, by succeeding on a DC 18 Strength check. If the check succeeds, the creature is no longer restrained and moves to the nearest space outside the whirlwind.',
      effects: [
        {
          id: S.actionId(82, 206),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(82, 207),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH,
              baseDc: 18
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(82, 1206),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 120,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            shape: {
              id: S.actionId(82, 1207),
              shapeKind: 'CYLINDER',
              radius: { amount: 5, unit: S.MEASUREMENT_UNIT_CODE.FEET },
              height: { amount: 30, unit: S.MEASUREMENT_UNIT_CODE.FEET }
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(82, 208),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(82, 209),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(82, 210),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('RESTRAINED')
                  },
                  {
                    id: S.actionId(82, 211),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_CHECK,
                    label: 'free a creature restrained by the whirlwind',
                    activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                    ability: S.ABILITY_CODE.STRENGTH,
                    fixedDc: 18,
                    actorKinds: ['TARGET', 'CREATURE_WITHIN_REACH'],
                    repeatable: true,
                    onSuccess: { kind: 'END' },
                    onFailure: { kind: 'CONTINUE' }
                  },
                  {
                    id: S.actionId(82, 212),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_DJINNI_CREATE_WHIRLWIND
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
