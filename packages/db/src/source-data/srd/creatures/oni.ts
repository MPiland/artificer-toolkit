import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const oni: CreatureAuthored = {
  id: S.CREATURE_IDS.ONI,
  label: 'Oni',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.GIANT,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 11,
    CONSTITUTION: 16,
    INTELLIGENCE: 14,
    WISDOM: 12,
    CHARISMA: 15
  },
  armorClass: 16,
  armorClassNote: 'chain mail',
  hitPoints: 110,
  hitDice: {
    count: 13,
    die: 10,
    modifier: 39
  },
  speeds: [...S.walk(30), ...S.fly(30)],
  proficiencies: [
    S.grantedSkillProficiency(3186, 1, 'ARCANA', 'DECEPTION', 'PERCEPTION'),
    S.grantedLanguageProficiency(3186, 2, 'COMMON', 'GIANT', 'INFERNAL')
  ],
  damageResistances: ['cold'],
  senses: ['darkvision 120 ft.'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_7,
  xp: 2900,
  features: [
    {
      id: S.featureId(211, 2),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The oni's innate spellcasting ability is Charisma (spell save DC 13). The oni can innately cast the following spells, requiring no material components: At will: darkness, invisibility 1/day each: charm person, cone of cold, gaseous form, sleep",
      grants: {
        spells: [
          {
            id: S.actionId(211, 701),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DARKNESS, S.SPELL_IDS.INVISIBILITY],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            order: 0
          },
          {
            id: S.actionId(211, 702),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.CHARM_PERSON,
              S.SPELL_IDS.CONE_OF_COLD,
              S.SPELL_IDS.GASEOUS_FORM,
              S.SPELL_IDS.SLEEP
            ],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: S.actionId(211, 703),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 1
            },
            order: 1
          }
        ]
      },
      effects: [
        S.closedRuleEffect({
          id: S.actionId(211, 704),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(211, 705), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_ONI_INNATE_SPELLCASTING
        })
      ],
      order: 2
    },
    {
      id: S.featureId(211, 3),
      label: 'Regeneration',
      description:
        'Regeneration. The oni regains 10 hit points at the start of its turn if it has at least 1 hit point.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(211, 501),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(211, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_ONI_REGENERATION
        })
      ],
      order: 3
    },
    {
      id: S.featureId(211, 4),
      label: 'Shapechanger',
      description:
        'Change Shape. The oni magically polymorphs into a Small or Medium humanoid, into a Large giant, or back into its true form. Other than its size, its statistics are the same in each form. The only equipment that is transformed is its glaive, which shrinks so that it can be wielded in humanoid form. If the oni dies, it reverts to its true form, and its glaive reverts to its normal size.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(211, 502),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(211, 602), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_ONI_SHAPECHANGER
        })
      ],
      order: 4
    },
    {
      id: S.featureId(211, 5),
      label: 'Multiattack',
      description: 'Multiattack. The oni makes two attacks, either with its claws or its glaive.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(211, 503),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(211, 603), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_ONI_MULTIATTACK
        })
      ],
      order: 5
    },
    {
      id: S.featureId(211, 6),
      label: 'Claw',
      description:
        'Claw (Oni Form Only). Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) slashing damage.',
      effects: [
        {
          id: S.actionId(3186, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3186, 2),
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
              id: S.actionId(3186, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(3186, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(3186, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8',
                    bonuses: [
                      {
                        id: S.actionId(3186, 4),
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
      order: 6
    }
  ]
}
