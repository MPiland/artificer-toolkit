import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SPELL_COMPONENT,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const STRIDE_EFFECT_KEY = 0x220
const STRIDE_EFFECT_ID = spellChildId(SPELL_IDS.TREE_STRIDE, STRIDE_EFFECT_KEY, 1)
const STRIDE_PATH_KEY = 0x222

export const treeStride: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.TREE_STRIDE,
  label: 'Tree Stride',
  description:
    "<p>You gain the ability to enter a tree and move from inside it to inside another tree of the same kind within 500 feet. Both trees must be living and at least the same size as you. You must use 5 feet of movement to enter a tree. You instantly know the location of all other trees of the same kind within 500 feet and, as part of the move used to enter the tree, can either pass into one of those trees or step out of the tree you're in. You appear in a spot of your choice within 5 feet of the destination tree, using another 5 feet of movement. If you have no movement left, you appear within 5 feet of the tree you entered. You can use this transportation ability once per round for the duration. You must end each turn outside a tree.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.RANGER],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.TREE_STRIDE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: spellChildId(SPELL_IDS.TREE_STRIDE, 0x211, 1), rangeKind: RANGE_KIND.SELF },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.TREE_STRIDE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: `${spellChildId(SPELL_IDS.TREE_STRIDE, 0x212, 1)}__result`,
            resultKind: 'SEQUENCE',
            duration: {
              id: spellChildId(SPELL_IDS.TREE_STRIDE, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            // Once per round for the duration, the caster travels from tree to tree within 500 feet.
            lifecycle: {
              effectOffers: [
                {
                  kind: 'REPEAT_SOURCE_PATH',
                  offeredTo: 'SOURCE',
                  activation: ACTIVATION_CODE.FREE,
                  usesPerTurn: 1,
                  effectId: STRIDE_EFFECT_ID,
                  target: 'INVOCATION'
                }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.TREE_STRIDE, 0x214, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {}
              },
              {
                id: spellChildId(SPELL_IDS.TREE_STRIDE, 0x215, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Resolve Tree Travel',
                instructions:
                  'Each stride starts and ends at a living tree of the same kind, at least as large as the traveler. Entering costs 5 feet of movement and stepping out within 5 feet of the destination tree costs 5 more; with no movement left, the traveler appears within 5 feet of the tree entered. The traveler must end each turn outside a tree.',
                reasonCode: 'EXTERNAL_WORLD_STATE'
              }
            ]
          }
        }
      ]
    },
    {
      id: STRIDE_EFFECT_ID,
      order: 2,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.FREE, amount: 1 },
        range: {
          id: spellChildId(SPELL_IDS.TREE_STRIDE, STRIDE_EFFECT_KEY + 1, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 500,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.TREE_STRIDE, STRIDE_PATH_KEY, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: `${spellChildId(SPELL_IDS.TREE_STRIDE, STRIDE_PATH_KEY, 1)}__result`,
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.TREE_STRIDE, STRIDE_PATH_KEY + 1, 1),
                effectKind: EFFECT_KIND.TELEPORT,
                targetKind: 'SELF',
                destinationKind: 'SPECIFIED_POINT'
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
