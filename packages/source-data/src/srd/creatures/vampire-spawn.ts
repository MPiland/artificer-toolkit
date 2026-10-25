import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'
export const vampireSpawn: CreatureAuthored = {
  id: S.CREATURE_IDS.VAMPIRE_SPAWN,
  label: 'Vampire Spawn',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 16,
    CONSTITUTION: 16,
    INTELLIGENCE: 11,
    WISDOM: 10,
    CHARISMA: 12
  },
  naturalArmorBonus: 2,
  hitPoints: 82,
  details: [],
  damageVulnerabilities: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 11,
    die: 8,
    modifier: 33
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSaveProficiency(1668, 2, 'DEXTERITY', 'WISDOM'),
    S.grantedSkillProficiency(1668, 1, 'PERCEPTION', 'STEALTH')
  ],
  damageResistances: ['necrotic', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
  senses: [S.darkvision(60)],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(278, 1),
      label: 'Regeneration',
      description:
        "Regeneration. The vampire regains 10 hit points at the start of its turn if it has at least 1 hit point and isn't in sunlight or running water. If the vampire takes radiant damage or damage from holy water, this trait doesn't function at the start of the vampire's next turn.",
      effects: [
        {
          id: S.actionId(278, 200),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.START_OF_TURN,
            range: { id: S.actionId(278, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(278, 202),
              order: 1,
              pathCode: S.PATH_CODE.PASSIVE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(278, 203),
                resultKind: 'SINGLE',
                gate: { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 1 },
                suppressedByDamageTypeIds: [S.damageTypeId('RADIANT')],
                outcomes: [
                  {
                    id: S.actionId(278, 204),
                    effectKind: S.EFFECT_KIND.HEAL,
                    valueKind: 'FIXED',
                    scalingKind: S.SCALING.NONE,
                    amount: 10
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
      id: S.featureId(278, 2),
      label: 'Spider Climb',
      description:
        'Spider Climb. The vampire can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(278, 206),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(278, 207), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Spider Climb',
          reasonCode: MANUAL_ADJUDICATION_REASON.EXTERNAL_WORLD_STATE,
          instructions:
            'The vampire can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.'
        })
      ],
      order: 2
    },
    {
      id: S.featureId(278, 3),
      label: 'Bite',
      description:
        "Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one willing creature, or a creature that is grappled by the vampire, incapacitated, or restrained. Hit: 6 (1d6 + 3) piercing damage plus 7 (2d6) necrotic damage. The target's hit point maximum is reduced by an amount equal to the necrotic damage taken, and the vampire regains hit points equal to that amount. The reduction lasts until the target finishes a long rest. The target dies if this effect reduces its hit point maximum to 0.",
      effects: [
        {
          id: S.actionId(278, 208),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(278, 209),
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
              id: S.actionId(278, 210),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(278, 211),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(278, 212),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+3'
                  },
                  {
                    id: S.actionId(278, 213),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('NECROTIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6'
                  },
                  {
                    id: S.actionId(278, 214),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Life drain',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      "The bite works only on a willing creature or one that is grappled, incapacitated, or restrained by the vampire spawn. The target's hit point maximum is reduced by the necrotic damage taken, and the vampire spawn regains hit points equal to that amount. The reduction lasts until the target finishes a long rest, and the target dies if its hit point maximum drops to 0."
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
      id: S.featureId(278, 4),
      label: 'Claws',
      description:
        'Claws. Melee Weapon Attack: +6 to hit, reach 5 ft., one creature. Hit: 8 (2d4 + 3) slashing damage. Instead of dealing damage, the vampire can grapple the target (escape DC 13).',
      effects: [
        {
          id: S.actionId(1668, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(1668, 2),
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
              id: S.actionId(1668, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.CHOICE,
              originKind: 'SOURCE' as const,
              selectionKind: 'CHOICE' as const,
              options: [
                {
                  id: S.actionId(1668, 4),
                  order: 1,
                  label: 'Damage',
                  description: 'Deals 8 (2d4 + 3) slashing damage.',
                  resultBlock: {
                    id: S.actionId(1668, 3) + '__result',
                    resultKind: 'SINGLE' as const,
                    outcomes: [
                      {
                        id: S.actionId(1668, 3),
                        effectKind: S.EFFECT_KIND.DAMAGE,
                        damageTypeId: S.damageTypeId('SLASHING'),
                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                        scalingKind: S.SCALING.NONE,
                        diceConfig: '2d4+3'
                      }
                    ]
                  }
                },
                {
                  id: S.actionId(1668, 5),
                  order: 2,
                  label: 'Grapple',
                  description: 'Instead of dealing damage, grapples the target (escape DC 13).',
                  resultBlock: {
                    id: S.actionId(1668, 6),
                    resultKind: 'SINGLE' as const,
                    outcomes: [
                      S.grappledOutcome(1668, { localIndex: 1, escapeDc: 13, heldAtOnce: 1 })
                    ]
                  }
                }
              ]
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(278, 5),
      label: 'Vampire Weaknesses',
      description: 'Vampire Weaknesses. The vampire has the following flaws:',
      order: 5
    },
    {
      id: S.featureId(278, 6),
      label: 'Forbiddance',
      description:
        "Forbiddance. The vampire can't enter a residence without an invitation from one of the occupants.",
      order: 6
    },
    {
      id: S.featureId(278, 7),
      label: 'Harmed by Running Water',
      description:
        'Harmed by Running Water. The vampire takes 20 acid damage when it ends its turn in running water.',
      order: 7
    },
    {
      id: S.featureId(278, 8),
      label: 'Stake to the Heart',
      description:
        'Stake to the Heart. The vampire is destroyed if a piercing weapon made of wood is driven into its heart while it is incapacitated in its resting place.',
      order: 8
    },
    {
      id: S.featureId(278, 9),
      label: 'Sunlight Hypersensitivity',
      description:
        'Sunlight Hypersensitivity. The vampire takes 20 radiant damage when it starts its turn in sunlight. While in sunlight, it has disadvantage on attack rolls and ability checks.',
      order: 9
    },
    {
      id: S.featureId(278, 10),
      label: 'Multiattack',
      description:
        'Multiattack. The vampire makes two attacks, only one of which can be a bite attack.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(278, 4) }] }] },
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(278, 4) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(278, 3) }] }
            ]
          }
        ]
      },
      order: 10
    }
  ]
}
