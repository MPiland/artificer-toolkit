import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  NUMERIC_EXPR_CODE,
  RANGE_KIND,
  SCALABLE_SCALING_KIND,
  SCALING_SOURCE,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SIZE_CODE } from '../sizes.js'
import { SRD_SPEEDS } from '../vocabulary.js'
import {
  creatureTypeId,
  damageTypeId,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId)
  throw new Error('SRD WALK speed vocabulary entry is required for Animate Objects source data.')

const fixed = (value: number) => ({ kind: NUMERIC_EXPR_CODE.FIXED, value })

/** The objects a 5th-level cast animates, and the two more each slot level above 5th adds. */
const BASE_OBJECT_BUDGET = 10
const BASE_SLOT_LEVEL = 5
const OBJECTS_PER_HIGHER_SLOT = 2

/**
 * How many objects of a size one cast animates with a slot of `level`: the cast's budget of objects,
 * each of the size counting as `weight` of them (a Medium counts as two).
 */
const animatedCount = (weight: number, level: number) =>
  Math.floor((BASE_OBJECT_BUDGET + OBJECTS_PER_HIGHER_SLOT * (level - BASE_SLOT_LEVEL)) / weight)

/**
 * The Animated Object table: each size's weight against the cast's object budget and its stat block.
 * Armor class is the one the table prints; the rest of the creature (Constitution 10, Intelligence 3,
 * Wisdom 3, Charisma 1, a 30-foot speed) is common to every size.
 */
const ANIMATED_OBJECT_SIZES = [
  {
    label: 'Tiny',
    size: SIZE_CODE.TINY,
    weight: 1,
    hitPoints: 20,
    armorClass: 18,
    strength: 4,
    dexterity: 18,
    attackBonus: 8,
    damage: '1d4+4'
  },
  {
    label: 'Small',
    size: SIZE_CODE.SMALL,
    weight: 1,
    hitPoints: 25,
    armorClass: 16,
    strength: 6,
    dexterity: 14,
    attackBonus: 6,
    damage: '1d8+2'
  },
  {
    label: 'Medium',
    size: SIZE_CODE.MEDIUM,
    weight: 2,
    hitPoints: 40,
    armorClass: 13,
    strength: 10,
    dexterity: 12,
    attackBonus: 5,
    damage: '2d6+1'
  },
  {
    label: 'Large',
    size: SIZE_CODE.LARGE,
    weight: 4,
    hitPoints: 50,
    armorClass: 10,
    strength: 14,
    dexterity: 10,
    attackBonus: 6,
    damage: '2d10+2'
  },
  {
    label: 'Huge',
    size: SIZE_CODE.HUGE,
    weight: 8,
    hitPoints: 80,
    armorClass: 10,
    strength: 18,
    dexterity: 6,
    attackBonus: 8,
    damage: '2d12+4'
  }
] as const

export const animateObjects: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ANIMATE_OBJECTS,
  label: 'Animate Objects',
  description:
    "<p>Objects come to life at your command. Choose up to ten nonmagical objects within range that are not being worn or carried. Medium targets count as two objects, Large targets count as four objects, Huge targets count as eight objects. You can't animate any object larger than Huge. Each target animates and becomes a creature under your control until the spell ends or until reduced to 0 hit points. As a bonus action, you can mentally command any creature you made with this spell if the creature is within 500 feet of you (if you control multiple creatures, you can command any or all of them at the same time, issuing the same command to each one). You decide what action the creature will take and where it will move during its next turn, or you can issue a general command, such as to guard a</p><p>An animated object is a construct with AC, hit points, attacks, Strength, and Dexterity determined by its size. Its Constitution is 10 and its Intelligence and Wisdom are 3, and its Charisma is 1. Its speed is 30 feet; if the object lacks legs or other appendages it can use for locomotion, it instead has a flying speed of 30 feet and can hover. If the object is securely attached to a surface or a larger object, such as a chain bolted to a wall, its speed is 0. It has blindsight with a radius of 30 feet and is blind beyond that distance. When the animated object drops to 0 hit points, it reverts to its original object form, and any remaining damage carries over to its original object form. If you command an object to attack, it can make a single melee attack against a creature within 5 feet of it. It makes a slam attack with an attack bonus and bludgeoning damage determined by its size. The GM might rule that a specific object inflicts slashing or piercing damage based on its form. At Higher Levels. If you cast this spell using a spell slot of 6th level or higher, you can animate two additional objects for each slot level above 5th.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.ANIMATE_OBJECTS, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ANIMATE_OBJECTS, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.ANIMATE_OBJECTS, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.ANIMATE_OBJECTS, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.ANIMATE_OBJECTS, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.ANIMATE_OBJECTS, 0x212, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.SUMMON,
                // The objects take their own turn in the initiative order, like a conjured group.
                turnTiming: 'OWN_INITIATIVE',
                // The caster picks one size and how many of its objects to animate (at most as many
                // as the cast's slot allows), each standing in the object's own stat block.
                forms: ANIMATED_OBJECT_SIZES.map((entry, index) => ({
                  id: spellChildId(SPELL_IDS.ANIMATE_OBJECTS, 0x214, index + 1),
                  order: index + 1,
                  label: `${entry.label} objects`,
                  maxTargets: animatedCount(entry.weight, BASE_SLOT_LEVEL),
                  maxTargetsScaling: {
                    scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
                    scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                    breakpoints: Array.from({ length: 4 }, (_, row) => ({
                      id: spellChildId(
                        SPELL_IDS.ANIMATE_OBJECTS,
                        0x216,
                        (index + 1) * 16 + row + 1
                      ),
                      level: BASE_SLOT_LEVEL + row + 1,
                      order: row + 1,
                      value: { amount: animatedCount(entry.weight, BASE_SLOT_LEVEL + row + 1) }
                    }))
                  },
                  statBlock: {
                    creatureTypeId: creatureTypeId('CONSTRUCT'),
                    size: entry.size,
                    armorClass: fixed(entry.armorClass),
                    hitPoints: fixed(entry.hitPoints),
                    speeds: [
                      { speedId: walkSpeedId, amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }
                    ],
                    abilityScores: {
                      STRENGTH: fixed(entry.strength),
                      DEXTERITY: fixed(entry.dexterity),
                      CONSTITUTION: fixed(10),
                      INTELLIGENCE: fixed(3),
                      WISDOM: fixed(3),
                      CHARISMA: fixed(1)
                    },
                    attacks: [
                      {
                        id: spellChildId(SPELL_IDS.ANIMATE_OBJECTS, 0x215, index + 1),
                        order: 1,
                        label: 'Slam',
                        attackBonus: entry.attackBonus,
                        reachFeet: 5,
                        damageTypeId: damageTypeId('BLUDGEONING'),
                        diceConfig: entry.damage
                      }
                    ]
                  }
                }))
              }
            ]
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
