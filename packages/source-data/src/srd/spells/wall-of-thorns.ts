import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
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
  SCALING_AMOUNT_KIND,
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

const FIVE_FEET = { amount: 5, unit: MEASUREMENT_UNIT_CODE.FEET }

/** The slashing damage: 7d8 at the 6th level, and 1d8 more for each slot level above it. */
const thornDamage = (kind: number, half: boolean) => ({
  id: spellChildId(SPELL_IDS.WALL_OF_THORNS, kind, 1),
  effectKind: EFFECT_KIND.DAMAGE,
  damageTypeId: damageTypeId('SLASHING'),
  valueKind: DAMAGE_VALUE_KIND.DICE,
  scalingKind: SCALING.PER_LEVEL,
  scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
  ...(half ? { amountKind: SCALING_AMOUNT_KIND.HALF } : {}),
  levels: Array.from({ length: 4 }, (_, index) => ({
    id: spellChildId(SPELL_IDS.WALL_OF_THORNS, kind, index + 2),
    level: index + 6,
    order: index + 1,
    diceConfig: `${index + 7}d8`
  }))
})

/**
 * The wall a creature moves through at four times the cost, saving against the thorns the first
 * time it enters on a turn or ends its turn there.
 */
const createThornManifest = (
  scope: number,
  label: string,
  shape: ShapeAuthored,
  ring = false
): ManifestAuthored => ({
  id: spellChildId(SPELL_IDS.WALL_OF_THORNS, scope, 1),
  effectKind: EFFECT_KIND.MANIFEST,
  manifestKind: MANIFEST_KIND.ZONE,
  attachmentKind: 'PLACED_SPACE',
  label,
  shape,
  ...(ring ? { hollow: true, wallThickness: FIVE_FEET } : {}),
  components: [
    {
      id: spellChildId(SPELL_IDS.WALL_OF_THORNS, scope + 1, 1),
      order: 1,
      label: 'Wall of Thorns',
      interactionKinds: ['ENTER_OR_PASS_THROUGH', 'END_TURN_IN_SPACE'],
      movementCostMultiplier: 4,
      maxApplicationsPerTurn: 1,
      blockingRules: ['BLOCKS_SIGHT'],
      behaviors: [
        {
          id: spellChildId(SPELL_IDS.WALL_OF_THORNS, scope + 0x10, 1),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.SAVING_THROW,
            savingThrow: {
              id: spellChildId(SPELL_IDS.WALL_OF_THORNS, scope + 0x11, 1),
              dcMethod: 'SOURCE_SAVE_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY
            },
            range: {
              id: spellChildId(SPELL_IDS.WALL_OF_THORNS, scope + 0x12, 1),
              rangeKind: RANGE_KIND.SELF
            }
          },
          paths: [
            {
              id: spellChildId(SPELL_IDS.WALL_OF_THORNS, scope + 0x13, 1),
              order: 1,
              pathCode: PATH_CODE.ON_SAVE_FAIL,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.WALL_OF_THORNS, scope + 0x13, 1)}__result`,
                resultKind: 'SINGLE',
                outcomes: [thornDamage(scope + 0x14, false)]
              }
            },
            {
              id: spellChildId(SPELL_IDS.WALL_OF_THORNS, scope + 0x15, 1),
              order: 2,
              pathCode: PATH_CODE.ON_SAVE_SUCCESS,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.WALL_OF_THORNS, scope + 0x15, 1)}__result`,
                resultKind: 'SINGLE',
                outcomes: [thornDamage(scope + 0x16, true)]
              }
            }
          ]
        }
      ]
    }
  ]
})

const WALL_OPTION_DESCRIPTION =
  'You choose to make the wall up to 60 feet long, 10 feet high, and 5 feet thick or a circle that has a 20-foot diameter and is up to 20 feet high and 5 feet thick.'

export const wallOfThorns: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.WALL_OF_THORNS,
  label: 'Wall of Thorns',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    '<p>You create a wall of tough, pliable, tangled brush bristling with needle-sharp thorns. The wall appears within range on a solid surface and lasts for the duration. You choose to make the wall up to 60 feet long, 10 feet high, and 5 feet thick or a circle that has a 20-foot diameter and is up to 20 feet high and 5 feet thick. The wall blocks line of sight.</p><p>When the wall appears, each creature within its area must make a Dexterity saving throw. On a failed save, a creature takes 7d8 piercing damage, or half as much damage on a successful save. A creature can move through the wall, albeit slowly and painfully. For every 1 foot a creature moves through the wall, it must spend 4 feet of movement. Furthermore, the first time a creature enters the wall on a turn or ends its turn there, the creature must make a Dexterity saving throw. It takes 7d8 slashing damage on a failed save, or half as much damage on a successful one. At Higher Levels. When you cast this spell using a spell slot of 7th level or higher, both types of damage increase by 1d8 for each slot level above 6th.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a handful of thorns',
  magicSchoolId: schoolId('CONJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x211, 1),
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
          id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE',
          selectionKind: 'CHOICE',
          options: [
            {
              id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x215, 1),
              order: 1,
              label: 'Straight Wall',
              description: WALL_OPTION_DESCRIPTION,
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x215, 1)}__result`,
                resultKind: 'SINGLE',
                duration: {
                  id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x214, 1),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 10
                },
                outcomes: [
                  createThornManifest(0x400, 'Wall of Thorns', {
                    id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x212, 1),
                    shapeKind: SHAPE_KIND.WALL,
                    length: { amount: 60, unit: MEASUREMENT_UNIT_CODE.FEET },
                    height: { amount: 10, unit: MEASUREMENT_UNIT_CODE.FEET },
                    thickness: FIVE_FEET
                  })
                ]
              }
            },
            {
              id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x215, 2),
              order: 2,
              label: 'Circle',
              description: WALL_OPTION_DESCRIPTION,
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x215, 2)}__result`,
                resultKind: 'SINGLE',
                duration: {
                  id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x214, 2),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 10
                },
                outcomes: [
                  createThornManifest(
                    0x500,
                    'Wall of Thorns Circle',
                    {
                      id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x501, 1),
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
