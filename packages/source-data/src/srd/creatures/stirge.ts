import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'
export const stirge: CreatureAuthored = {
  id: S.CREATURE_IDS.STIRGE,
  label: 'Stirge',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 4,
    DEXTERITY: 16,
    CONSTITUTION: 11,
    INTELLIGENCE: 2,
    WISDOM: 8,
    CHARISMA: 6
  },
  naturalArmorBonus: 1,
  hitPoints: 2,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 1,
    die: 4,
    modifier: 0
  },
  speeds: [...S.walk(10), ...S.fly(40)],
  senses: [S.darkvision(60)],
  passivePerception: 9,
  challengeRatingId: S.CR.CR_1_8,
  xp: 25,
  features: [
    {
      id: S.featureId(263, 2),
      label: 'Blood Drain',
      description:
        "Blood Drain. Melee Weapon Attack: +5 to hit, reach 5 ft., one creature. Hit: 5 (1d4 + 3) piercing damage, and the stirge attaches to the target. While attached, the stirge doesn't attack. Instead, at the start of each of the stirge's turns, the target loses 5 (1d4 + 3) hit points due to blood loss. The stirge can detach itself by spending 5 feet of its movement. It does so after it drains 10 hit points of blood from the target or the target dies. A creature, including the target, can use its action to detach the stirge.",
      effects: [
        {
          id: S.actionId(4592, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(4592, 2),
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
              id: S.actionId(4592, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(4592, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(4592, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4+3'
                  },
                  {
                    id: S.actionId(4592, 4),
                    effectKind: S.EFFECT_KIND.ACTOR_RELATIONSHIP,
                    heldAtOnce: 1,
                    modules: [
                      { id: S.actionId(4592, 5), order: 1, kind: 'SOURCE_FOLLOWS_TARGET' },
                      {
                        id: S.actionId(4592, 6),
                        order: 2,
                        kind: 'SOURCE_RELEASE_MOVEMENT_COST',
                        amount: 5,
                        unit: S.MEASUREMENT_UNIT_CODE.FEET
                      }
                    ]
                  },
                  {
                    id: S.actionId(4592, 7),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Drain blood while attached',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      "While attached, the stirge doesn't attack. At the start of each of the stirge's turns, the target loses 5 (1d4 + 3) hit points. The stirge detaches after it drains 10 hit points or the target dies, and any creature, including the target, can use its action to detach it; the GM tracks the drain and ends the attachment then."
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
