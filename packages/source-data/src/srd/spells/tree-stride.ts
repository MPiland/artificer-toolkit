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
            resultKind: 'SINGLE',
            duration: {
              id: spellChildId(SPELL_IDS.TREE_STRIDE, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.TREE_STRIDE, 0x214, 1),
                effectKind: EFFECT_KIND.TREE_STRIDE,
                destinationDistance: { amount: 500, unit: MEASUREMENT_UNIT_CODE.FEET },
                entryMovementCost: { amount: 5, unit: MEASUREMENT_UNIT_CODE.FEET },
                exitMovementCost: { amount: 5, unit: MEASUREMENT_UNIT_CODE.FEET },
                sameTreeKind: true,
                livingTreesOnly: true,
                minimumTreeSizeRelativeToTraveler: true,
                usesPerRound: 1,
                mustEndTurnOutside: true
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
