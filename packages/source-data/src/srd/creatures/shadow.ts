import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { SRD_BASIC_ACTION_IDS } from '../basicActions.js'
import * as S from './shared.js'
export const shadow: CreatureAuthored = {
  id: S.CREATURE_IDS.SHADOW,
  label: 'Shadow',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 6,
    DEXTERITY: 14,
    CONSTITUTION: 13,
    INTELLIGENCE: 6,
    WISDOM: 10,
    CHARISMA: 8
  },
  naturalArmorBonus: 0,
  hitPoints: 16,
  details: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 3,
    die: 8,
    modifier: 3
  },
  speeds: [...S.walk(40)],
  proficiencies: [S.grantedSkillProficiency(7360, 1, 'STEALTH')],
  damageVulnerabilities: ['radiant'],
  damageResistances: [
    'acid',
    'cold',
    'fire',
    'lightning',
    'thunder',
    'bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  damageImmunities: ['necrotic', 'poison'],
  conditionImmunities: [
    'exhaustion',
    'frightened',
    'grappled',
    'paralyzed',
    'petrified',
    'poisoned',
    'prone',
    'restrained'
  ],
  senses: [S.darkvision(60)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(250, 1),
      label: 'Amorphous',
      description:
        'Amorphous. The shadow can move through a space as narrow as 1 inch wide without squeezing.',
      order: 1
    },
    {
      id: S.featureId(250, 2),
      label: 'Shadow Stealth',
      description:
        'Shadow Stealth. While in dim light or darkness, the shadow can take the Hide action as a bonus action.',
      effects: [
        // The dim-light-or-darkness condition has no automated equivalent; the Feature text states it.
        S.standingGrantedActionsEffect({
          id: S.actionId(250, 502),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(250, 602), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          grantedActions: [
            {
              activation: S.ACTIVATION_CODE.BONUS_ACTION,
              actionDefinitionIds: [SRD_BASIC_ACTION_IDS.HIDE]
            }
          ]
        })
      ],
      order: 2
    },
    {
      id: S.featureId(250, 3),
      label: 'Strength Drain',
      description:
        "Strength Drain. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 9 (2d6 + 2) necrotic damage, and the target's Strength score is reduced by 1d4. The target dies if this reduces its Strength to 0. Otherwise, the reduction lasts until the target finishes a short or long rest. If a non-evil humanoid dies from this attack, a new shadow rises from the corpse 1d4 hours later.",
      effects: [
        {
          id: S.actionId(7360, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7360, 2),
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
              id: S.actionId(7360, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7360, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7360, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('NECROTIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+2'
                  },
                  {
                    id: S.actionId(250, 504),
                    effectKind: S.EFFECT_KIND.SCALAR_REDUCTION,
                    valueDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.STRENGTH,
                    amount: { kind: 'DICE', diceConfig: '1d4' },
                    stacking: 'ADDITIVE',
                    floor: 0,
                    recoveryTriggers: ['SHORT_REST', 'LONG_REST'],
                    terminalConsequence: 'TARGET_DIED'
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
      id: S.featureId(250, 4),
      label: 'Sunlight Weakness',
      description:
        'Sunlight Weakness. While in sunlight, the shadow has disadvantage on attack rolls, ability checks, and saving throws.',
      order: 4
    }
  ]
}
