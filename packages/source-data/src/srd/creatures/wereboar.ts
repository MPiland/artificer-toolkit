import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { damageInterceptionGrants } from './damageInterceptionGrants.js'
import { chargeEffect } from './chargeEffect.js'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import { lycanthropyCurseOutcome } from './lycanthropyCurse.js'
import * as S from './shared.js'
export const wereboar: CreatureAuthored = {
  id: S.CREATURE_IDS.WEREBOAR,
  label: 'Wereboar',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  tags: ['human', 'shapechanger'],
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 10,
    CONSTITUTION: 15,
    INTELLIGENCE: 10,
    WISDOM: 11,
    CHARISMA: 8
  },
  naturalArmorBonus: 0,
  hitPoints: 78,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 12,
    die: 8,
    modifier: 24
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedLanguageProficiency(288, 2, 'COMMON'),
    S.grantedSkillProficiency(288, 1, 'PERCEPTION')
  ],
  damageImmunities: [
    'bludgeoning, piercing, and slashing from nonmagical attacks not made with silvered weapons'
  ],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(288, 1),
      label: 'Shapechanger',
      description:
        'Shapechanger. The wereboar can use its action to polymorph into a boar-humanoid hybrid or into a boar, or back into its true form, which is humanoid.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(288, 200),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(288, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ...CHANGE_SHAPE_RULING.LYCANTHROPE_FORM
        })
      ],
      order: 1
    },
    {
      id: S.featureId(288, 2),
      label: 'Charge (Boar or Hybrid Form Only)',
      description:
        'Charge (Boar or Hybrid Form Only). If the wereboar moves at least 15 feet straight toward a target and then hits it with its tusks on the same turn, the target takes an extra 7 (2d6) slashing damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone.',
      effects: [
        chargeEffect({
          creatureIndex: 288,
          localIndex: 300,
          ridesFeatureId: S.featureId(288, 4),
          minFeet: 15,
          damageType: 'SLASHING',
          diceConfig: '2d6',
          dc: 13
        })
      ],
      order: 2
    },
    {
      id: S.featureId(288, 3),
      label: 'Relentless (Recharges after a Short or Long Rest)',
      description:
        'Relentless (Recharges after a Short or Long Rest). If the wereboar takes 14 damage or less that would reduce it to 0 hit points, it is reduced to 1 hit point instead.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(288, 206),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.SHORT_REST,
        amount: 1
      },
      grants: damageInterceptionGrants(S.actionId(288, 204), {
        dropToHitPoints: 1,
        negatesKill: false,
        maxDamageTaken: 14
      }),
      order: 3
    },
    {
      id: S.featureId(288, 4),
      label: 'Tusks (Boar or Hybrid Form Only)',
      description:
        'Tusks (Boar or Hybrid Form Only). Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage. If the target is a humanoid, it must succeed on a DC 12 Constitution saving throw or be cursed with wereboar lycanthropy.',
      effects: [
        {
          id: S.actionId(6929, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(6929, 2),
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
              id: S.actionId(6929, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(6929, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(6929, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+3'
                  },
                  lycanthropyCurseOutcome(S.actionId(6929, 4), 'wereboar', 12)
                ]
              }
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(288, 5),
      label: 'Maul (Humanoid or Hybrid Form Only)',
      description:
        'Maul (Humanoid or Hybrid Form Only). Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(288, 206),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(288, 207),
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
              id: S.actionId(288, 208),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(288, 209),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(288, 210),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
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
      order: 5
    },
    {
      id: S.featureId(288, 6),
      label: 'Multiattack (Humanoid or Hybrid Form Only)',
      description:
        'Multiattack (Humanoid or Hybrid Form Only). The wereboar makes two attacks, only one of which can be with its tusks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(288, 5) }] }] },
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(288, 5) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(288, 4) }] }
            ]
          }
        ]
      },
      order: 6
    }
  ]
}
