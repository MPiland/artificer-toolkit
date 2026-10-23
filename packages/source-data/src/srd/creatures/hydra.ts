import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hydra: CreatureAuthored = {
  id: S.CREATURE_IDS.HYDRA,
  label: 'Hydra',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 20,
    DEXTERITY: 12,
    CONSTITUTION: 20,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 7
  },
  naturalArmorBonus: 4,
  hitPoints: 172,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 15,
    die: 12,
    modifier: 75
  },
  speeds: [...S.walk(30), ...S.swim(30)],
  proficiencies: [S.grantedSkillExpertise(10169, 1, 'PERCEPTION')],
  senses: [S.darkvision(60)],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(169, 1),
      label: 'Hold Breath',
      description: 'Hold Breath. The hydra can hold its breath for 1 hour.',
      order: 1
    },
    {
      id: S.featureId(169, 2),
      label: 'Multiple Heads',
      description:
        'Multiple Heads. The hydra has five heads. While it has more than one head, the hydra has advantage on saving throws against being blinded, charmed, deafened, frightened, stunned, and knocked unconscious. Whenever the hydra takes 25 or more damage in a single turn, one of its heads dies. If all its heads die, the hydra dies. At the end of its turn, it grows two heads for each of its heads that died since its last turn, unless it has taken fire damage since its last turn. The hydra regains 10 hit points for each head regrown in this way.',
      order: 2
    },
    {
      id: S.featureId(169, 3),
      label: 'Reactive Heads',
      description:
        'Reactive Heads. For each head the hydra has beyond one, it gets an extra reaction that can be used only for opportunity attacks.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(169, 203),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(169, 1203), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_HYDRA_REACTIVE_HEADS
        })
      ],
      order: 3
    },
    {
      id: S.featureId(169, 4),
      label: 'Wakeful',
      description: 'Wakeful. While the hydra sleeps, at least one of its heads is awake.',
      order: 4
    },
    {
      id: S.featureId(169, 5),
      label: 'Multiattack',
      description: 'Multiattack. The hydra makes as many bite attacks as it has heads.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              {
                count: 5,
                fillers: [{ kind: 'FEATURE', featureId: S.featureId(169, 6) }],
                optional: true
              }
            ]
          }
        ]
      },
      order: 5
    },
    {
      id: S.featureId(169, 6),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +8 to hit, reach 10 ft., one target. Hit: 10 (1d10 + 5) piercing damage.',
      effects: [
        {
          id: S.actionId(169, 206),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(169, 1206),
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
              id: S.actionId(169, 207),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(169, 208),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(169, 209),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10+5'
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
