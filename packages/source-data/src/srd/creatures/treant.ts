import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'
export const treant: CreatureAuthored = {
  id: S.CREATURE_IDS.TREANT,
  label: 'Treant',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.PLANT,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000300000000',
  abilityScores: {
    STRENGTH: 23,
    DEXTERITY: 8,
    CONSTITUTION: 21,
    INTELLIGENCE: 12,
    WISDOM: 16,
    CHARISMA: 12
  },
  naturalArmorBonus: 7,
  hitPoints: 138,
  details: [],
  senses: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 12,
    die: 12,
    modifier: 60
  },
  speeds: [...S.walk(30)],
  proficiencies: [S.grantedLanguageProficiency(271, 1, 'COMMON', 'DRUIDIC', 'ELVISH', 'SYLVAN')],
  damageVulnerabilities: ['fire'],
  damageResistances: ['bludgeoning', 'piercing'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_9,
  xp: 5000,
  features: [
    {
      id: S.featureId(271, 1),
      label: 'False Appearance',
      description:
        'False Appearance. While the treant remains motionless, it is indistinguishable from a normal tree.',
      order: 1
    },
    {
      id: S.featureId(271, 2),
      label: 'Siege Monster',
      description: 'Siege Monster. The treant deals double damage to objects and structures.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(271, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(271, 203), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Siege Monster',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          instructions:
            'The treant deals double damage to objects and structures: the GM doubles the damage its attacks deal to an object or structure.'
        })
      ],
      order: 2
    },
    {
      id: S.featureId(271, 3),
      label: 'Animate Trees (1/Day)',
      description:
        "Animate Trees (1/Day). The treant magically animates one or two trees it can see within 60 feet of it. These trees have the same statistics as a treant, except they have Intelligence and Charisma scores of 1, they can't speak, and they have only the Slam action option. An animated tree acts as an ally of the treant. The tree remains animate for 1 day or until it dies; until the treant dies or is more than 120 feet from the tree; or until the treant takes a bonus action to turn it back into an inanimate tree. The tree then takes root if possible.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(271, 204),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.LONG_REST,
        amount: 1
      },
      effects: [
        // The GM adds the animated trees with REINFORCE (D198).
        S.manualAdjudicationEffect({
          id: S.actionId(271, 205),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(271, 206),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 60,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            }
          },
          label: 'Animate Trees',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          instructions:
            'The GM adds one or two animated trees within 60 feet of the treant to the encounter as its allies, each with the treant’s statistics except Intelligence and Charisma 1, no speech and only the Slam action. A tree reverts after 1 day, when it dies, when the treant dies or is more than 120 feet from it, or when the treant turns it back as a bonus action; the GM then removes it.'
        })
      ],
      order: 3
    },
    {
      id: S.featureId(271, 4),
      label: 'Multiattack',
      description: 'Multiattack. The treant makes two slam attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(271, 5) }] }] }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(271, 5),
      label: 'Slam',
      description:
        'Slam. Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 16 (3d6 + 6) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(6752, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(6752, 2),
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
              id: S.actionId(6752, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(6752, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(6752, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6+6'
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
      id: S.featureId(271, 6),
      label: 'Rock',
      description:
        'Rock. Ranged Weapon Attack: +10 to hit, range 60/180 ft., one target. Hit: 28 (4d10 + 6) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(271, 214),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(271, 215),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 60,
              longAmount: 180,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(271, 216),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(271, 217),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(271, 218),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d10+6'
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
