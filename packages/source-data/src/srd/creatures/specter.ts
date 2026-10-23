import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
import * as R from './rollInfluenceGrants.js'
export const specter: CreatureAuthored = {
  id: S.CREATURE_IDS.SPECTER,
  label: 'Specter',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['hover'],
  abilityScores: {
    STRENGTH: 1,
    DEXTERITY: 14,
    CONSTITUTION: 11,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 11
  },
  naturalArmorBonus: 0,
  hitPoints: 22,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 5,
    die: 8,
    modifier: 0
  },
  speeds: [...S.fly(50)],
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
    'charmed',
    'exhaustion',
    'grappled',
    'paralyzed',
    'petrified',
    'poisoned',
    'prone',
    'restrained',
    'unconscious'
  ],
  senses: [S.darkvision(60)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(257, 1),
      label: 'Incorporeal Movement',
      description:
        'Incorporeal Movement. The specter can move through other creatures and objects as if they were difficult terrain.',
      grants: S.movementPassageGrants(S.actionId(257, 200), {
        creatures: 'ANY',
        mayEndInCreature: false,
        blockingBarriers: true,
        costMultiplier: 2
      }),
      order: 1
    },
    {
      id: S.featureId(257, 2),
      label: 'Sunlight Sensitivity',
      description:
        'Sunlight Sensitivity. While in sunlight, the specter has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
      grants: R.lightSensitivityGrants(257, 100, true),
      order: 2
    },
    {
      id: S.featureId(257, 3),
      label: 'Life Drain',
      description:
        'Life Drain. Melee Spell Attack: +4 to hit, reach 5 ft., one creature. Hit: 10 (3d6) necrotic damage. The target must succeed on a DC 10 Constitution saving throw or its hit point maximum is reduced by an amount equal to the damage taken. This reduction lasts until the creature finishes a long rest. The target dies if this effect reduces its hit point maximum to 0.',
      effects: [
        {
          id: S.actionId(6522, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_SPELL_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(6522, 2),
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
              id: S.actionId(6522, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(6522, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(6522, 5),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('NECROTIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6'
                  },
                  S.lifeDrainSave({
                    id: S.actionId(6522, 4),
                    savingThrowId: S.actionId(6522, 6),
                    dc: 10,
                    reductionOutcomeId: S.actionId(6522, 7),
                    damageOutcomeId: S.actionId(6522, 5)
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 3
    }
  ]
}
