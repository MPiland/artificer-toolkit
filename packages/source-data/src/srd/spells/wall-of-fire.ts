import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type ManifestAuthored,
  type ShapeAuthored,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const ONE_FOOT = { amount: 1, unit: MEASUREMENT_UNIT_CODE.FEET }

/**
 * The fire a creature takes, with no save, on entering the wall for the first time on a turn or
 * ending its turn there: 5d8 at the 4th level, and 1d8 more for each slot level above it.
 */
const createFireManifest = (
  scope: number,
  label: string,
  shape: ShapeAuthored,
  ring = false
): ManifestAuthored => ({
  id: spellChildId(SPELL_IDS.WALL_OF_FIRE, scope, 1),
  effectKind: EFFECT_KIND.MANIFEST,
  manifestKind: MANIFEST_KIND.ZONE,
  attachmentKind: 'PLACED_SPACE',
  label,
  shape,
  ...(ring ? { hollow: true, wallThickness: ONE_FOOT } : {}),
  components: [
    {
      id: spellChildId(SPELL_IDS.WALL_OF_FIRE, scope + 1, 1),
      order: 1,
      label: 'Wall of Fire',
      interactionKinds: ['ENTER_OR_PASS_THROUGH', 'END_TURN_IN_SPACE'],
      maxApplicationsPerTurn: 1,
      blockingRules: ['BLOCKS_SIGHT'],
      behaviors: [
        {
          id: spellChildId(SPELL_IDS.WALL_OF_FIRE, scope + 0x10, 1),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: {
              id: spellChildId(SPELL_IDS.WALL_OF_FIRE, scope + 0x11, 1),
              rangeKind: RANGE_KIND.SELF
            }
          },
          paths: [
            {
              id: spellChildId(SPELL_IDS.WALL_OF_FIRE, scope + 0x12, 1),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.WALL_OF_FIRE, scope + 0x12, 1)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: spellChildId(SPELL_IDS.WALL_OF_FIRE, scope + 0x13, 1),
                    effectKind: EFFECT_KIND.DAMAGE,
                    damageTypeId: damageTypeId('FIRE'),
                    valueKind: DAMAGE_VALUE_KIND.DICE,
                    scalingKind: SCALING.PER_LEVEL,
                    scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                    levels: Array.from({ length: 6 }, (_, index) => ({
                      id: spellChildId(SPELL_IDS.WALL_OF_FIRE, scope + 0x13, index + 2),
                      level: index + 4,
                      order: index + 1,
                      diceConfig: `${index + 5}d8`
                    }))
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
})

const WALL_OPTION_DESCRIPTION =
  'You can make the wall up to 60 feet long, 20 feet high, and 1 foot thick, or a ringed wall up to 20 feet in diameter, 20 feet high, and 1 foot thick.'

export const wallOfFire: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.WALL_OF_FIRE,
  label: 'Wall of Fire',
  description:
    '<p>You create a wall of fire on a solid surface within range. You can make the wall up to 60 feet long, 20 feet high, and 1 foot thick, or a ringed wall up to 20 feet in diameter, 20 feet high, and 1 foot thick. The wall is opaque and lasts for the duration. When the wall appears, each creature within its area must make a Dexterity saving throw. On a failed save, a creature takes 5d8 fire damage, or half as much damage on a successful save. One side of the wall, selected by you when you cast this spell, deals 5d8 fire damage to each creature that ends its turn within 10 feet of that side or inside the wall. A creature takes the same damage when it enters the wall for the first time on a turn or ends its turn there. The other side of the wall deals no damage. At Higher Levels. When you cast this spell using a spell slot of 5th level or higher, the damage increases by 1d8 for each slot level above 4th.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a small piece of phosphorus',
  magicSchoolId: schoolId('EVOCATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x211, 1),
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
          id: spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE',
          selectionKind: 'CHOICE',
          options: [
            {
              id: spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x213, 1),
              order: 1,
              label: 'Straight Wall',
              description: WALL_OPTION_DESCRIPTION,
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x213, 1)}__result`,
                resultKind: 'SINGLE',
                duration: {
                  id: spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x214, 1),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  createFireManifest(0x400, 'Wall of Fire', {
                    id: spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x401, 1),
                    shapeKind: SHAPE_KIND.WALL,
                    length: { amount: 60, unit: MEASUREMENT_UNIT_CODE.FEET },
                    height: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET },
                    thickness: ONE_FOOT
                  })
                ]
              }
            },
            {
              id: spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x213, 2),
              order: 2,
              label: 'Ringed Wall',
              description: WALL_OPTION_DESCRIPTION,
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x213, 2)}__result`,
                resultKind: 'SINGLE',
                duration: {
                  id: spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x214, 2),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  createFireManifest(
                    0x500,
                    'Wall of Fire Ring',
                    {
                      id: spellChildId(SPELL_IDS.WALL_OF_FIRE, 0x501, 1),
                      shapeKind: SHAPE_KIND.CYLINDER,
                      radius: { amount: 10, unit: MEASUREMENT_UNIT_CODE.FEET },
                      height: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
                    },
                    true
                  )
                ]
              }
            }
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
