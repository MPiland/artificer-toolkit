import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { chargeEffect } from './chargeEffect.js'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import * as S from './shared.js'

export const weretiger: CreatureAuthored = {
  id: S.CREATURE_IDS.WERETIGER,
  label: 'Weretiger',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  tags: ['human', 'shapechanger'],
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 15,
    CONSTITUTION: 16,
    INTELLIGENCE: 10,
    WISDOM: 13,
    CHARISMA: 11
  },
  naturalArmorBonus: 0,
  hitPoints: 120,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 16,
    die: 8,
    modifier: 48
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillExpertise(290, 3, 'PERCEPTION'),
    S.grantedSkillProficiency(290, 1, 'STEALTH')
  ],
  damageImmunities: [
    'bludgeoning, piercing, and slashing from nonmagical attacks not made with silvered weapons'
  ],
  senses: [S.darkvision(60)],
  passivePerception: 15,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(290, 1),
      label: 'Shapechanger',
      description:
        "Shapechanger. The weretiger can use its action to polymorph into a tiger-humanoid hybrid or into a tiger, or back into its true form, which is humanoid. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(290, 200),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(290, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ...CHANGE_SHAPE_RULING.LYCANTHROPE_FORM
        })
      ],
      order: 1
    },
    {
      id: S.featureId(290, 2),
      label: 'Keen Hearing and Smell',
      description:
        'Keen Hearing and Smell. The weretiger has advantage on Wisdom (Perception) checks that rely on hearing or smell.',
      order: 2
    },
    {
      id: S.featureId(290, 3),
      label: 'Pounce (Tiger or Hybrid Form Only)',
      description:
        'Pounce (Tiger or Hybrid Form Only). If the weretiger moves at least 15 feet straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 14 Strength saving throw or be knocked prone. If the target is prone, the weretiger can make one bite attack against it as a bonus action.',
      effects: [
        chargeEffect({
          creatureIndex: 290,
          localIndex: 300,
          ridesFeatureId: S.featureId(290, 7),
          minFeet: 15,
          dc: 14
        })
      ],
      order: 3
    },
    {
      id: S.featureId(290, 4),
      label: 'Speech Limitation',
      description: "Common (can't speak in tiger form)",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(290, 2, 'COMMON')]
      },
      order: 4
    },
    {
      id: S.featureId(290, 5),
      label: 'Multiattack (Humanoid or Hybrid Form Only)',
      description:
        'Multiattack (Humanoid or Hybrid Form Only). In humanoid form, the weretiger makes two scimitar attacks or two longbow attacks. In hybrid form, it can attack like a humanoid or make two claw attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(290, 8) }] }] },
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(290, 9) }] }] },
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(290, 7) }] }] }
        ]
      },
      order: 5
    },
    {
      id: S.featureId(290, 6),
      label: 'Bite (Tiger or Hybrid Form Only)',
      description:
        'Bite (Tiger or Hybrid Form Only). Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (1d10 + 3) piercing damage. If the target is a humanoid, it must succeed on a DC 13 Constitution saving throw or be cursed with weretiger lycanthropy.',
      effects: [
        {
          id: S.actionId(290, 211),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(290, 212),
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
              id: S.actionId(290, 213),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(290, 214),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(290, 215),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10+3'
                  },
                  {
                    id: S.actionId(290, 216),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_WERETIGER_BITE
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 6
    },
    {
      id: S.featureId(290, 7),
      label: 'Claw (Tiger or Hybrid Form Only)',
      description:
        'Claw (Tiger or Hybrid Form Only). Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(290, 217),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(290, 218),
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
              id: S.actionId(290, 219),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(290, 220),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(290, 221),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8+3'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 7
    },
    {
      id: S.featureId(290, 8),
      label: 'Scimitar (Humanoid or Hybrid Form Only)',
      description:
        'Scimitar (Humanoid or Hybrid Form Only). Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(290, 222),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(290, 223),
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
              id: S.actionId(290, 224),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(290, 225),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(290, 226),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+3'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 8
    },
    {
      id: S.featureId(290, 9),
      label: 'Longbow (Humanoid or Hybrid Form Only)',
      description:
        'Longbow (Humanoid or Hybrid Form Only). Ranged Weapon Attack: +4 to hit, range 150/600 ft., one target. Hit: 6 (1d8 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(290, 227),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(290, 228),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 150,
              longAmount: 600,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(290, 229),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(290, 230),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(290, 231),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8+2'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 9
    }
  ]
}
