import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const shieldGuardian: CreatureAuthored = {
  id: S.CREATURE_IDS.SHIELD_GUARDIAN,
  label: 'Shield Guardian',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 8,
    CONSTITUTION: 18,
    INTELLIGENCE: 7,
    WISDOM: 10,
    CHARISMA: 3
  },
  naturalArmorBonus: 8,
  hitPoints: 142,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 15,
    die: 10,
    modifier: 60
  },
  speeds: [...S.walk(30)],
  damageImmunities: ['poison'],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
  senses: [S.blindsight(10), S.darkvision(60)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_7,
  xp: 2900,
  features: [
    {
      id: S.featureId(252, 1),
      label: 'Bound',
      description:
        "Bound. The shield guardian is magically bound to an amulet. As long as the guardian and its amulet are on the same plane of existence, the amulet's wearer can telepathically call the guardian to travel to it, and the guardian knows the distance and direction to the amulet. If the guardian is within 60 feet of the amulet's wearer, half of any damage the wearer takes (rounded up) is transferred to the guardian.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(252, 200),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(252, 201), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          label: 'Resolve the amulet bond and shared damage',
          reasonCode: 'EXTERNAL_WORLD_STATE',
          instructions:
            "Bound. The amulet's wearer can telepathically call the guardian while both are on the same plane, and the guardian knows the amulet's distance and direction. While the guardian is within 60 feet of the wearer, half of any damage the wearer takes (rounded up) is transferred to the guardian."
        })
      ],
      order: 1
    },
    {
      id: S.featureId(252, 2),
      label: 'Regeneration',
      description:
        'Regeneration. The shield guardian regains 10 hit points at the start of its turn if it has at least 1 hit point.',
      effects: [
        {
          id: S.actionId(252, 202),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.START_OF_TURN,
            range: { id: S.actionId(252, 203), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(252, 204),
              order: 1,
              pathCode: S.PATH_CODE.PASSIVE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(252, 205),
                resultKind: 'SINGLE',
                gate: { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 1 },
                outcomes: [
                  {
                    id: S.actionId(252, 206),
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
      order: 2
    },
    {
      id: S.featureId(252, 3),
      label: 'Spell Storing',
      description:
        "Spell Storing. A spellcaster who wears the shield guardian's amulet can cause the guardian to store one spell of 4th level or lower. To do so, the wearer must cast the spell on the guardian. The spell has no effect but is stored within the guardian. When commanded to do so by the wearer or when a situation arises that was predefined by the spellcaster, the guardian casts the stored spell with any parameters set by the original caster, requiring no components. When the spell is cast or a new spell is stored, any previously stored spell is lost.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(252, 208),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(252, 209), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_SHIELD_GUARDIAN_SPELL_STORING
        })
      ],
      order: 3
    },
    {
      id: S.featureId(252, 4),
      label: 'Language Limitation',
      description: "understands the languages of its creator but can't speak",
      order: 4
    },
    {
      id: S.featureId(252, 5),
      label: 'Multiattack',
      description: 'The guardian makes two fist attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(252, 6) }] }] }
        ]
      },
      order: 5
    },
    {
      id: S.featureId(252, 6),
      label: 'Fist',
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(252, 212),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(252, 213),
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
              id: S.actionId(252, 214),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(252, 215),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(252, 216),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+4'
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
      id: S.featureId(252, 7),
      label: 'Shield',
      description:
        "Shield. When a creature makes an attack against the wearer of the guardian's amulet, the guardian grants a +2 bonus to the wearer's AC if the guardian is within 5 feet of the wearer.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(252, 217),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: {
              id: S.actionId(252, 218),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            }
          },
          label: "Add the guardian's +2 AC bonus to the wearer",
          reasonCode: 'EXTERNAL_WORLD_STATE',
          instructions:
            "Shield. When a creature attacks the wearer of the guardian's amulet and the guardian is within 5 feet of the wearer, the wearer gains a +2 bonus to AC against that attack."
        })
      ],
      order: 7
    }
  ]
}
